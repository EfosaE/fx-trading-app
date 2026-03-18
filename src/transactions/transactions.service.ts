import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { QueryTransactionsDto } from 'src/transactions/dtos/query-transactions.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(TransactionEntity)
    private txRepo: Repository<TransactionEntity>,
  ) {}

  async findAll(userId: string, query: QueryTransactionsDto) {
    // const { type, status, page, limit } = query;
    // const skip = (page - 1) * limit;
    const { type, status, page = 1, limit = 20 } = query;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const skip = (safePage - 1) * safeLimit;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (type) qb.andWhere('tx.type = :type', { type });
    if (status) qb.andWhere('tx.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();

    this.logger.log(
      { userId, page, limit, total },
      'Transaction history fetched',
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
