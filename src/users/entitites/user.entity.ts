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

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ name: 'otp_code', type: 'varchar', nullable: true, default: null })
  otpCode: string | null;

  @Column({
    name: 'otp_expiry',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  otpExpiry: Date | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => WalletBalance, (wb) => wb.user)
  walletBalances: WalletBalance[];

  @OneToMany(() => TransactionEntity, (t) => t.user)
  transactions: TransactionEntity[];
}
