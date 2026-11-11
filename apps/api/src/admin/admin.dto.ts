import { OrderStatus, ProductStatus, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
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

export class UpdateSupportTicketDto {
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
}

export class AdminSupportReplyDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}
