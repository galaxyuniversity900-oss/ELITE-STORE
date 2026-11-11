import { ContentStatus, OrderStatus, ProductStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

export class CreateContentPageDto {
  @IsString() @MinLength(2) @MaxLength(180) slug!: string;
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsObject() body!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) heroImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class UpdateContentPageDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) slug?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string | null;
  @IsOptional() @IsObject() body?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) heroImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string | null;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class CreateEditorialCollectionDto {
  @IsString() @MinLength(2) @MaxLength(180) slug!: string;
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsObject() body?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) heroImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class UpdateEditorialCollectionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) slug?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsObject() body?: Record<string, unknown> | null;
  @IsOptional() @IsString() @MaxLength(1000) heroImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string | null;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

export class EditorialCollectionItemDto {
  @IsString() @MinLength(2) productId!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
