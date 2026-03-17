import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from 'src/auth/dtos/register.dto';
import { ok } from 'src/common/http/response.helpers';
import { VerifyOtpDto } from 'src/auth/dtos/verify-otp.dto';
import { LoginDto } from 'src/auth/dtos/login.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return ok(
      data,
      'Registration successful. An OTP has been sent to your email for verification.',
    );
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyOtpDto) {
    const message = await this.authService.verifyOtp(dto);
    return ok(null, message.message);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return ok(data, 'login successful');
  }
}
