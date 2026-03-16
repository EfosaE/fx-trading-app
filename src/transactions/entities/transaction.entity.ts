import { FxRate } from 'src/fx/entities/fx-rate.entity';
import { User } from 'src/users/entitites/user.entity';
import { Currency, WalletBalance } from 'src/wallet/entities/wallet.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum TransactionType {
  FUNDING = 'FUNDING',
  CONVERSION = 'CONVERSION',
  TRADE = 'TRADE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('transactions')
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wallet_balance_id', nullable: true })
  walletBalanceId: string;

  @ManyToOne(() => WalletBalance, (wb) => wb.transactions)
  @JoinColumn({ name: 'wallet_balance_id' })
  walletBalance: WalletBalance;

  @Column({ name: 'fx_rate_id', nullable: true })
  fxRateId: string;

  @ManyToOne(() => FxRate, (r) => r.transactions, { nullable: true })
  @JoinColumn({ name: 'fx_rate_id' })
  fxRate: FxRate;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    name: 'from_currency',
    type: 'enum',
    enum: Currency,
    nullable: true,
  })
  fromCurrency: Currency;

  @Column({ name: 'to_currency', type: 'enum', enum: Currency, nullable: true })
  toCurrency: Currency;

  @Column({ name: 'from_amount', type: 'decimal', precision: 20, scale: 6 })
  fromAmount: string;

  @Column({
    name: 'to_amount',
    type: 'decimal',
    precision: 20,
    scale: 6,
    nullable: true,
  })
  toAmount: string;

  @Column({
    name: 'rate_used',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  rateUsed: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
