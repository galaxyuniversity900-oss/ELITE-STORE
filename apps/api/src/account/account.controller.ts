import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

class ConsentPreferenceDto {
  @IsEnum(ConsentType) consentType!: ConsentType;
  @IsBoolean() granted!: boolean;
}


class ErasureRequestDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}


class ReturnRequestDto {
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}

type AccountRequest = { user: { id: string; email: string; role: string } };

@Controller('account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}
  @Get('return-requests') returnRequests(@Req() req: AccountRequest) { return this.account.listReturnRequests(req.user.id); }
  @Post('orders/:orderNumber/return-requests') requestReturn(@Req() req: AccountRequest, @Param('orderNumber') orderNumber: string, @Body() input: ReturnRequestDto) { return this.account.requestReturn(req.user.id, orderNumber, input.reason); }
  @Get('export') exportPersonalData(@Req() req: AccountRequest) { return this.account.exportPersonalData(req.user.id); }
  @Post('erasure-requests') requestErasure(@Req() req: AccountRequest, @Body() input: ErasureRequestDto) { return this.account.requestErasure(req.user.id, input.reason); }
  @Get('erasure-requests') erasureRequests(@Req() req: AccountRequest) { return this.account.listDataSubjectRequests(req.user.id); }
  @Get('me') me(@Req() req: AccountRequest) { return this.account.profile(req.user.id); }
  @Get('consents') consents(@Req() req: AccountRequest) { return this.account.consents(req.user.id); }
  @Post('consents') setConsent(@Req() req: AccountRequest, @Body() input: ConsentPreferenceDto) { return this.account.setConsent(req.user.id, input); }
  @Get('orders') orders(@Req() req: AccountRequest) { return this.account.orders(req.user.id); }
  @Get('addresses') addresses(@Req() req: AccountRequest) { return this.account.addresses(req.user.id); }
  @Post('addresses') addAddress(@Req() req: AccountRequest, @Body() input: AddressDto) { return this.account.addAddress(req.user.id, input); }
}
