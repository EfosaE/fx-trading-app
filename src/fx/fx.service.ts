import {
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { FxRate } from './entities/fx-rate.entity';
import { Currency } from 'src/common/types';

const RATE_TTL_MINUTES = 30;
const MAX_RETRIES = 2;

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly fxApiKey: string;

  constructor(
    @InjectRepository(FxRate)
    private fxRateRepo: Repository<FxRate>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.fxApiKey = this.configService.getOrThrow<string>('FX_API_KEY');
  }

  // ─── Public: Get Rate (cache-first) ──────────────────────────────────────────
  async getRate(
    baseCurrency: Currency,
    targetCurrency: Currency,
  ): Promise<FxRate> {
    const cached = await this.fxRateRepo.findOne({
      where: {
        baseCurrency,
        targetCurrency,
        expiresAt: MoreThan(new Date()),
      },
      order: { fetchedAt: 'DESC' },
    });

    if (cached) {
      this.logger.log(
        { baseCurrency, targetCurrency, source: 'cache' },
        'FX rate cache hit',
      );
      return cached;
    }

    this.logger.log(
      { baseCurrency, targetCurrency },
      'FX rate cache miss, fetching from API',
    );
    return this.fetchAndStore(baseCurrency, targetCurrency);
  }

  // ─── Public: Get All Current Rates ───────────────────────────────────────────
  async getAllRates(): Promise<FxRate[]> {
    return this.fxRateRepo.find({
      where: { expiresAt: MoreThan(new Date()) },
      order: { baseCurrency: 'ASC', targetCurrency: 'ASC' },
    });
  }

  // ─── Internal: Fetch from External API with Retry ────────────────────────────
  private async fetchAndStore(
    baseCurrency: Currency,
    targetCurrency: Currency,
    attempt = 1,
  ): Promise<FxRate> {
    try {
      const url = `https://v6.exchangerate-api.com/v6/${this.fxApiKey}/pair/${baseCurrency}/${targetCurrency}`;

      const { data } = await firstValueFrom(
        this.httpService.get<{ conversion_rate: number; result: string }>(url),
      );

      if (data.result !== 'success') {
        throw new Error('Exchange rate API returned non-success result');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + RATE_TTL_MINUTES * 60 * 1000);

      const fxRate = this.fxRateRepo.create({
        baseCurrency,
        targetCurrency,
        rate: data.conversion_rate.toString(),
        expiresAt,
      });

      await this.fxRateRepo.save(fxRate);

      this.logger.log(
        { baseCurrency, targetCurrency, rate: data.conversion_rate, expiresAt },
        'FX rate fetched and stored',
      );

      return fxRate;
    } catch (err) {
      this.logger.warn(
        { baseCurrency, targetCurrency, attempt, err: err.message },
        'FX rate fetch failed',
      );

      if (attempt < MAX_RETRIES) {
        await this.delay(500 * attempt);
        return this.fetchAndStore(baseCurrency, targetCurrency, attempt + 1);
      }

      const stale = await this.fxRateRepo.findOne({
        where: { baseCurrency, targetCurrency },
        order: { fetchedAt: 'DESC' },
      });

      if (stale) {
        this.logger.warn(
          { baseCurrency, targetCurrency, fetchedAt: stale.fetchedAt },
          'Using stale FX rate as fallback',
        );
        return stale;
      }

      throw new ServiceUnavailableException(
        `FX rates unavailable for ${baseCurrency}/${targetCurrency}. Please try again later.`,
      );
    }
  }

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
