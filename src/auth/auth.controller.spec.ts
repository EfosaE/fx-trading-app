import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  verifyOtp: jest.fn(),
  login: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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

    it('should return ok response with registration data', async () => {
      const serviceResult = {
        fullName: 'John Doe',
        email: dto.email,
        otpExpiry: new Date(),
      };
      mockAuthService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/OTP has been sent/i);
      expect(result.data).toEqual(serviceResult);
    });

    it('should propagate exceptions thrown by AuthService', async () => {
      mockAuthService.register.mockRejectedValue(
        new Error('Email already registered'),
      );

      await expect(controller.register(dto)).rejects.toThrow(
        'Email already registered',
      );
    });
  });

  // ─── verify ──────────────────────────────────────────────────────────────────

  describe('verify', () => {
    const dto = { email: 'john@test.com', otpCode: '482910' };

    it('should return ok response with verification message', async () => {
      mockAuthService.verifyOtp.mockResolvedValue({
        message: 'Account verified successfully. You can now log in.',
      });

      const result = await controller.verify(dto);

      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/verified successfully/i);
      expect(result.data).toBeNull();
    });

    it('should propagate exceptions thrown by AuthService', async () => {
      mockAuthService.verifyOtp.mockRejectedValue(new Error('Invalid OTP'));

      await expect(controller.verify(dto)).rejects.toThrow('Invalid OTP');
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'john@test.com', password: 'password123' };

    it('should return ok response with access token and user', async () => {
      const serviceResult = {
        accessToken: 'signed-token',
        user: { id: 'user-uuid', email: dto.email, fullName: 'John Doe' },
      };
      mockAuthService.login.mockResolvedValue(serviceResult);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/login successful/i);
      expect(result.data).toEqual(serviceResult);
    });

    it('should propagate exceptions thrown by AuthService', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });
});
