import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { Currency } from 'src/common/types';

export class FundWalletDto {
  @IsEnum(Currency)
  currency: Currency;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}
