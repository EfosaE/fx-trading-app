import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().default(3000),

  // Database
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string(),
  DB_PASS: z.string(),
  DB_NAME: z.string(),

  // JWT
  JWT_SECRET: z.string(),

  // Mail
  EMAIL_HOST: z.string(),
  EMAIL_PORT: z.coerce.number().default(2525),
  EMAIL_USERNAME: z.string(),
  EMAIL_PASSWORD: z.string(),
  EMAIL_FROM: z.email(),

  // FX (add any others your app uses)
  FX_API_KEY: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;
