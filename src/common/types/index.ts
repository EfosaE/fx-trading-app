export * from './events';

export enum Role {
  USER = 'USER',
  VENDOR = 'VENDOR',
  ADMIN = 'ADMIN',
}

// Define specific types for the context data
export type OTPEmailContext = {
  name: string;
  otpCode: string;
  expiryMinutes: 5;
};

// src/common/enums/currency.enum.ts
export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
}
