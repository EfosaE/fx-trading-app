/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WalletBalance } from './entities/wallet.entity';
import { DataSource } from 'typeorm';
import { FxService } from '../fx/fx.service';
import { Currency } from 'src/common/types';
import { NotFoundException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;

  let walletRepo: any;
  let dataSource: any;
  let fxService: any;
  let manager: any;

  beforeEach(async () => {
    walletRepo = {
      find: jest.fn(),
      // findOne: jest.fn(),
      // create: jest.fn(),
      // save: jest.fn(),
      // update: jest.fn(),
      // delete: jest.fn(),
    };

    manager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(manager)),
    };

    fxService = {
      getRate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(WalletBalance),
          useValue: walletRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: FxService,
          useValue: fxService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return formatted balances', async () => {
    walletRepo.find.mockResolvedValue([
      { currency: 'USD', balance: '100.1234', updatedAt: new Date() },
    ]);

    const result = await service.getBalances('user1');

    expect(result[0].balance).toBe('100.12');
  });
  it('should fund existing wallet', async () => {
    const wallet = { id: '1', balance: '100.000000', currency: 'USD' };

    manager.findOne.mockResolvedValue(wallet);
    manager.save.mockImplementation((x) => x);
    manager.create.mockImplementation((_, data) => data);

    const result = await service.fund('user1', {
      currency: Currency.USD,
      amount: 50,
    });

    expect(manager.save).toHaveBeenCalled();
    expect(result.newBalance).toBe('150.00');
  });
  it('should throw if insufficient balance', async () => {
    fxService.getRate.mockResolvedValue({
      rate: '2',
      id: 'fx1',
      expiresAt: new Date(),
    });

    manager.findOne.mockResolvedValue({
      id: '1',
      balance: '10',
    });

    await expect(
      service.convert('user1', {
        fromCurrency: Currency.USD,
        toCurrency: Currency.NGN,
        amount: 50,
      }),
    ).rejects.toThrow('Insufficient');
  });
  it('should throw if source wallet not found', async () => {
    fxService.getRate.mockResolvedValue({
      rate: '2',
      id: 'fx1',
      expiresAt: new Date(),
    });

    manager.findOne.mockResolvedValue(null);

    await expect(
      service.convert('user1', {
        fromCurrency: Currency.USD,
        toCurrency: Currency.NGN,
        amount: 50,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
