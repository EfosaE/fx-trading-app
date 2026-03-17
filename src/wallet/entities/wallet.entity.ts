import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { User } from 'src/users/entitites/user.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { Currency } from 'src/common/types';

@Entity('wallet_balances')
@Index(['userId', 'currency'], { unique: true })
export class WalletBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.walletBalances)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
  balance: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TransactionEntity, (t) => t.walletBalance)
  transactions: TransactionEntity[];
}
