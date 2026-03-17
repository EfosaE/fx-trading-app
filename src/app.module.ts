import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { TransactionsModule } from './transactions/transactions.module';
import { FxModule } from './fx/fx.module';
import { validateEnv } from 'src/config/validate-env';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailModule } from 'src/mail/mail.module';

import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from 'src/all-exceptions.filter';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    MailModule,

    // ThrottlerModule.forRoot([
    //   {
    //     name: 'short',
    //     ttl: 1000,
    //     limit: 10,
    //   },
    //   {
    //     name: 'medium',
    //     ttl: 10000,
    //     limit: 20,
    //   },
    //   {
    //     name: 'long',
    //     ttl: 60000,
    //     limit: 100,
    //   },
    // ]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:HH:MM:ss',
                  ignore: 'pid,hostname,req,res,responseTime',
                  messageFormat:
                    '{msg} [{req.method} {req.url} {res.statusCode}] {responseTime}ms',
                },
              }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/favicon.ico',
        },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
            };
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
        customLogLevel(_req, res, err) {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'silent'; // suppresses all 2xx/3xx success logs
        },
      },
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    AuthModule,
    UsersModule,
    WalletModule,
    TransactionsModule,
    FxModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ],
})
export class AppModule {}
