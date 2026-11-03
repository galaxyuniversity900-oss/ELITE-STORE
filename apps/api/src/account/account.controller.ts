import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { AccountService } from './account.service';

class AddressDto {
  @IsString() @MinLength(2) @MaxLength(120) recipient!: string;
  @IsString() @MinLength(7) @MaxLength(30) phone!: string;
  @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsString() @MinLength(2) @MaxLength(180) street!: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsOptional() @IsString() @MaxLength(80) building?: string;
  @IsOptional() @IsString() @MaxLength(80) apartment?: string;
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
type AccountRequest = { user: { id: string; email: string; role: string } };

@Controller('account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}
  @Get('me') me(@Req() req: AccountRequest) { return this.account.profile(req.user.id); }
  @Get('orders') orders(@Req() req: AccountRequest) { return this.account.orders(req.user.id); }
  @Get('addresses') addresses(@Req() req: AccountRequest) { return this.account.addresses(req.user.id); }
  @Post('addresses') addAddress(@Req() req: AccountRequest, @Body() input: AddressDto) { return this.account.addAddress(req.user.id, input); }
}
