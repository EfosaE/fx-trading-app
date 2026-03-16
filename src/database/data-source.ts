import { env } from '../config/env';
import { FxRate } from '../fx/entities/fx-rate.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { User } from '../users/entitites/user.entity';
import { WalletBalance } from '../wallet/entities/wallet.entity';
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',

  host: env.DB_HOST,
  port: env.DB_PORT,

  username: env.DB_USER,
  password: env.DB_PASS,

  database: env.DB_NAME,

  entities: [User, WalletBalance, FxRate, TransactionEntity],

  migrations: ['src/database/migrations/*.ts'],

  synchronize: false,
});

export default AppDataSource;
