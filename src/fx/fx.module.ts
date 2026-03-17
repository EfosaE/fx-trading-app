import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { FxService } from './fx.service';
import { FxController } from './fx.controller';
import { FxRate } from './entities/fx-rate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FxRate]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  providers: [FxService],
  controllers: [FxController],
  exports: [FxService], // consumed by WalletModule
})
export class FxModule {}
