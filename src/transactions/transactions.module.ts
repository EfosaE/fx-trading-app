import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FxRate } from 'src/fx/entities/fx-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FxRate])],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
