import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { FxService } from './fx.service';

import { Currency } from 'src/common/types';
import { IsEnum } from 'class-validator';

class GetRateQuery {
  @IsEnum(Currency)
  from: Currency;

  @IsEnum(Currency)
  to: Currency;
}

@ApiTags('FX Rates')
@ApiBearerAuth('access-token')
@Controller('fx')
export class FxController {
  constructor(private fxService: FxService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get all current cached FX rates' })
  getAllRates() {
    return this.fxService.getAllRates();
  }

  @Get('rate')
  @ApiOperation({ summary: 'Get a specific FX rate pair' })
  @ApiQuery({ name: 'from', enum: Currency })
  @ApiQuery({ name: 'to', enum: Currency })
  getRate(@Query() query: GetRateQuery) {
    return this.fxService.getRate(query.from, query.to);
  }
}
