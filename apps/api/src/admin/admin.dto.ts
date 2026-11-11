import { OrderStatus, ProductStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) sku!: string;
  @IsString() @MinLength(2) @MaxLength(200) slug!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) price!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) compareAtPrice?: number;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number | null;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() categoryId?: string | null;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) sku?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) price?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) compareAtPrice?: number | null;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number | null;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() categoryId?: string | null;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class CreateShippingRuleDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsString() @MinLength(2) @MaxLength(120) city!: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsString() @MinLength(2) @MaxLength(60) shippingMethod!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) fee!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsInt() @Min(0) estimatedMinDays!: number;
  @IsInt() @Min(0) estimatedMaxDays!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateShippingRuleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string | null;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) shippingMethod?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) fee?: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsInt() @Min(0) estimatedMinDays?: number;
  @IsOptional() @IsInt() @Min(0) estimatedMaxDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
