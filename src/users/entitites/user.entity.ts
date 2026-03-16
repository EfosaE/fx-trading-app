import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

import { WalletBalance } from 'src/wallet/entities/wallet.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'otp_code', nullable: true })
  otpCode: string;

  @Column({ name: 'otp_expiry', type: 'timestamp', nullable: true })
  otpExpiry: Date;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => WalletBalance, (wb) => wb.user)
  walletBalances: WalletBalance[];

  @OneToMany(() => TransactionEntity, (t) => t.user)
  transactions: TransactionEntity[];
}
