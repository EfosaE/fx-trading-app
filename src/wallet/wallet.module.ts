import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletBalance } from './entities/wallet.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WalletBalance, TransactionEntity])],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [TypeOrmModule],
})
export class WalletModule {}
