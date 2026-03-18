import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/users/entitites/user.entity';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockManager = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockDataSource = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  transaction: jest.fn((cb) => cb(mockManager)),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      password: 'password123',
    };

    it('should register a new user and emit user.created event', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue({});
      mockManager.save.mockResolvedValue({});

      const result = await service.register(dto);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({ email: dto.email }),
      );
      expect(result.email).toBe(dto.email);
      expect(result.fullName).toBe('John Doe');
      expect(result.otpExpiry).toBeDefined();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ email: dto.email });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  // ─── verifyOtp ───────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const dto = { email: 'john@test.com', otpCode: '482910' };

    it('should verify OTP and mark user as verified', async () => {
      const user = {
        email: dto.email,
        isVerified: false,
        otpCode: '482910',
        otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue({ ...user, isVerified: true });

      const result = await service.verifyOtp(dto);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: true,
          otpCode: null,
          otpExpiry: null,
        }),
      );
      expect(result.message).toMatch(/verified successfully/i);
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if account already verified', async () => {
      mockUserRepo.findOne.mockResolvedValue({ isVerified: true });

      await expect(service.verifyOtp(dto)).rejects.toThrow(
        'Account already verified',
      );
    });

    it('should throw BadRequestException if no OTP exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        isVerified: false,
        otpCode: null,
      });

      await expect(service.verifyOtp(dto)).rejects.toThrow(
        'No OTP found. Please request a new one.',
      );
    });

    it('should throw BadRequestException on incorrect OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        isVerified: false,
        otpCode: '111111',
        otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(service.verifyOtp(dto)).rejects.toThrow('Invalid OTP');
    });

    it('should throw BadRequestException on expired OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        isVerified: false,
        otpCode: '482910',
        otpExpiry: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
      });

      await expect(service.verifyOtp(dto)).rejects.toThrow('OTP has expired');
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'john@test.com', password: 'password123' };
    const passwordHash = bcrypt.hashSync('password123', 12);

    it('should return accessToken and user on valid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
        fullName: 'John Doe',
        passwordHash,
        isVerified: true,
      });
      mockJwtService.sign.mockReturnValue('signed-token');

      const result = await service.login(dto);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe(dto.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        email: dto.email,
        passwordHash: bcrypt.hashSync('wrongpassword', 12),
        isVerified: true,
      });

      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if account is not verified', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        email: dto.email,
        passwordHash,
        isVerified: false,
      });

      await expect(service.login(dto)).rejects.toThrow(
        'Please verify your email first',
      );
    });
  });
});
