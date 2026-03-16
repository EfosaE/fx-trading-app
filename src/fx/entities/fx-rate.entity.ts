import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { Currency } from 'src/wallet/entities/wallet.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('fx_rates')
export class FxRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'base_currency', type: 'enum', enum: Currency })
  baseCurrency: Currency;

  @Column({ name: 'target_currency', type: 'enum', enum: Currency })
  targetCurrency: Currency;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  rate: string;

  @CreateDateColumn({ name: 'fetched_at' })
  fetchedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @OneToMany(() => TransactionEntity, (t) => t.fxRate)
  transactions: TransactionEntity[];
}
