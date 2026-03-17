import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  //   UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from 'src/users/entitites/user.entity';
import { RegisterDto } from 'src/auth/dtos/register.dto';
import { WalletBalance } from 'src/wallet/entities/wallet.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Currency, UserCreatedEvent } from 'src/common/types';
import { VerifyOtpDto } from 'src/auth/dtos/verify-otp.dto';
import { LoginDto } from 'src/auth/dtos/login.dto';
import { JwtPayload } from 'src/auth/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
    private dataSource: DataSource,
  ) {}

  // Register
  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const otpCode = this.generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        fullName: `${dto.firstName} ${dto.lastName}`,
        email: dto.email,
        passwordHash,
        otpCode,
        otpExpiry,
      });

      await manager.save(user);

      const wallet = manager.create(WalletBalance, {
        userId: user.id,
        currency: Currency.NGN,
        balance: '0',
      });

      await manager.save(wallet);
    });

    // Emit event outside transaction
    this.eventEmitter.emit(
      'user.created',
      new UserCreatedEvent(dto.firstName, dto.email, otpCode),
    );

    return {
      fullName: `${dto.firstName} ${dto.lastName}`,
      email: dto.email,
      otpExpiry,
    };
  }
  // ─── Verify OTP ──────────────────────────────────────────────────────────────
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Account already verified');
    }

    if (!user.otpCode) {
      throw new BadRequestException('No OTP found. Please request a new one.');
    }

    if (user.otpCode !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check expiry
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;

    await this.userRepo.save(user);

    return {
      message: 'Account verified successfully. You can now log in.',
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  // ─── Helper ──────────────────────────────────────────────────────────────────
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  }
}
