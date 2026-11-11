import { OrderStatus, ProductStatus, PromotionType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

export class CreatePromotionDto {
  @IsString() @MinLength(3) @MaxLength(32) code!: string;
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsEnum(PromotionType) type!: PromotionType;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minSubtotal?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxDiscount?: number | null;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number | null;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() expiresAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) name?: string;
  @IsOptional() @IsEnum(PromotionType) type?: PromotionType;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minSubtotal?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxDiscount?: number | null;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number | null;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() expiresAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
