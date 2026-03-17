import {
  IsEnum,
  IsNumber,
  IsPositive,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Currency } from 'src/common/types';

@ValidatorConstraint({ name: 'differentCurrency', async: false })
class DifferentCurrencyConstraint implements ValidatorConstraintInterface {
  validate(toCurrency: Currency, args: ValidationArguments) {
    const object = args.object as ConvertCurrencyDto;
    return object.fromCurrency !== toCurrency;
  }

  defaultMessage() {
    return 'fromCurrency and toCurrency must differ';
  }
}

export class ConvertCurrencyDto {
  @IsEnum(Currency)
  fromCurrency: Currency;

  @IsEnum(Currency)
  @Validate(DifferentCurrencyConstraint)
  toCurrency: Currency;

  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  amount: number;
}
