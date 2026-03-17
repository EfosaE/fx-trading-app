import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletBalance } from './entities/wallet.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { FxModule } from 'src/fx/fx.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletBalance, TransactionEntity]),
    FxModule,
  ],
  providers: [WalletService],
  controllers: [WalletController],
})
export class WalletModule {}
