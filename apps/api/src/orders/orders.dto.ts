import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipient!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  street!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  building?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apartment?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsIn(['CASH_ON_DELIVERY', 'DEMO_CARD', 'DEMO_WALLET'])
  paymentMethod?: string;

  @IsOptional()
  @IsIn(['DEMO_STANDARD', 'DEMO_EXPRESS', 'DEMO_PICKUP'])
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
