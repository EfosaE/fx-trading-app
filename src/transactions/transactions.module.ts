// import { Module } from '@nestjs/common';
// import { TransactionsService } from './transactions.service';
// import { TransactionsController } from './transactions.controller';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { FxRate } from 'src/fx/entities/fx-rate.entity';

// @Module({
//   imports: [TypeOrmModule.forFeature([FxRate])],
//   providers: [TransactionsService],
//   controllers: [TransactionsController],
// })
// export class TransactionsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionEntity } from './entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionEntity])],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
