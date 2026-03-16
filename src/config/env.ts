import * as dotenv from 'dotenv';
import { envSchema } from './env.schema';

dotenv.config(); // loads .env from project root

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
