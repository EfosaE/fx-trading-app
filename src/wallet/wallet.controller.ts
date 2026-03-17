import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ConvertCurrencyDto } from 'src/wallet/dtos/convert-currency.dto';
import { FundWalletDto } from 'src/wallet/dtos/fund-wallet.dto';
import { AuthenticatedRequest } from 'src/common/types';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('access-token')
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  getBalances(@Request() req: AuthenticatedRequest) {
    return this.walletService.getBalances(req.user.userId);
  }

  @Post('fund')
  @HttpCode(HttpStatus.OK)
  fund(@Request() req: AuthenticatedRequest, @Body() dto: FundWalletDto) {
    return this.walletService.fund(req.user.userId, dto);
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  convert(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ConvertCurrencyDto,
  ) {
    return this.walletService.convert(req.user.userId, dto);
  }
}
