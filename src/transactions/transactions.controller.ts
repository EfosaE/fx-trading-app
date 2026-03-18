import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { QueryTransactionsDto } from 'src/transactions/dtos/query-transactions.dto';
import { AuthenticatedRequest } from 'src/common/types';
import { ok } from 'src/common/http/response.helpers';

@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private txService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated transaction history' })
  async getTransactions(
    @Request() req: AuthenticatedRequest,
    @Query() query: QueryTransactionsDto,
  ) {
    const data = await this.txService.findAll(req.user.userId, query);
    return ok(data.data, 'Transactions retrieved', data.meta);
  }
}
