import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { FxService } from '../fx/fx.service';
import { WalletBalance } from 'src/wallet/entities/wallet.entity';
import { FundWalletDto } from 'src/wallet/dtos/fund-wallet.dto';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { TransactionStatus, TransactionType } from 'src/common/types';
import { ConvertCurrencyDto } from 'src/wallet/dtos/convert-currency.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletBalance)
    private walletRepo: Repository<WalletBalance>,
    private dataSource: DataSource,
    private fxService: FxService,
  ) {}

  async getBalances(userId: string) {
    const wallets = await this.walletRepo.find({ where: { userId } });
    return wallets.map((w) => ({
      currency: w.currency,
      balance: new Decimal(w.balance).toFixed(2),
      updatedAt: w.updatedAt,
    }));
  }

  async fund(userId: string, dto: FundWalletDto) {
    return this.dataSource.transaction(async (manager) => {
      let wallet = await manager.findOne(WalletBalance, {
        where: { userId, currency: dto.currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        wallet = manager.create(WalletBalance, {
          userId,
          currency: dto.currency,
          balance: '0',
        });
        await manager.save(wallet);
      }

      wallet.balance = new Decimal(wallet.balance).plus(dto.amount).toFixed(6);
      await manager.save(wallet);

      const tx = manager.create(TransactionEntity, {
        userId,
        walletBalanceId: wallet.id,
        type: TransactionType.FUNDING,
        fromCurrency: dto.currency,
        toCurrency: dto.currency,
        fromAmount: new Decimal(dto.amount).toFixed(6),
        toAmount: new Decimal(dto.amount).toFixed(6),
        status: TransactionStatus.COMPLETED,
      });
      await manager.save(tx);

      return {
        message: 'Wallet funded successfully',
        currency: dto.currency,
        amountCredited: new Decimal(dto.amount).toFixed(2),
        newBalance: new Decimal(wallet.balance).toFixed(2),
      };
    });
  }

  async convert(userId: string, dto: ConvertCurrencyDto) {
    const fxRate = await this.fxService.getRate(
      dto.fromCurrency,
      dto.toCurrency,
    );
    const rate = new Decimal(fxRate.rate);
    const deductAmount = new Decimal(dto.amount);
    const creditAmount = deductAmount.times(rate);

    return this.dataSource.transaction(async (manager) => {
      const fromWallet = await manager.findOne(WalletBalance, {
        where: { userId, currency: dto.fromCurrency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromWallet) {
        throw new NotFoundException(
          `You don't have a ${dto.fromCurrency} wallet. Fund it first.`,
        );
      }

      const fromBalance = new Decimal(fromWallet.balance);
      if (fromBalance.lessThan(deductAmount)) {
        throw new UnprocessableEntityException(
          `Insufficient ${dto.fromCurrency} balance. ` +
            `Available: ${fromBalance.toFixed(2)}, Required: ${deductAmount.toFixed(2)}`,
        );
      }

      let toWallet = await manager.findOne(WalletBalance, {
        where: { userId, currency: dto.toCurrency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!toWallet) {
        toWallet = manager.create(WalletBalance, {
          userId,
          currency: dto.toCurrency,
          balance: '0',
        });
        await manager.save(toWallet);
      }

      fromWallet.balance = fromBalance.minus(deductAmount).toFixed(6);
      toWallet.balance = new Decimal(toWallet.balance)
        .plus(creditAmount)
        .toFixed(6);

      await manager.save(fromWallet);
      await manager.save(toWallet);

      const tx = manager.create(TransactionEntity, {
        userId,
        walletBalanceId: fromWallet.id,
        fxRateId: fxRate.id,
        type: TransactionType.CONVERSION,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        fromAmount: deductAmount.toFixed(6),
        toAmount: creditAmount.toFixed(6),
        rateUsed: rate.toFixed(8),
        status: TransactionStatus.COMPLETED,
      });
      await manager.save(tx);

      return {
        message: 'Conversion successful',
        from: { currency: dto.fromCurrency, debited: deductAmount.toFixed(2) },
        to: { currency: dto.toCurrency, credited: creditAmount.toFixed(2) },
        rate: rate.toFixed(8),
        rateExpiresAt: fxRate.expiresAt,
      };
    });
  }
}
