import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DistributedRateLimitGuard } from './distributed-rate-limit.guard';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(DistributedRateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() input: RegisterDto) { return this.auth.register(input); }

  @Post('login')
  login(@Body() input: LoginDto) {
    return this.auth.login(input.email, input.password);
  }
}
