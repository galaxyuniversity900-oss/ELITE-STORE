import { OrderStatus, ProductStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

export class CreateProductVariantDto {
  @IsString() @MinLength(2) @MaxLength(80) sku!: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) priceOverride?: number;
  @IsInt() @Min(0) stockQuantity!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateProductVariantDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) sku?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string | null;
  @IsOptional() @IsString() @MaxLength(60) color?: string | null;
  @IsOptional() @IsObject() attributes?: Record<string, unknown> | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) priceOverride?: number | null;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
