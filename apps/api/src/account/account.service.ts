import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}
  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true, createdAt: true } });
    if (!user) throw new NotFoundException('Customer account not found');
    return user;
  }
  orders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      select: { orderNumber: true, status: true, subtotal: true, discountTotal: true, shippingTotal: true, grandTotal: true, currency: true, paymentMethod: true, shippingMethod: true, createdAt: true, items: true, payments: { select: { provider: true, status: true, amount: true, currency: true, createdAt: true } }, shipment: { select: { trackingNumber: true, status: true, estimatedDays: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  addresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }
  async addAddress(userId: string, input: { recipient: string; phone: string; city: string; street: string; area?: string; building?: string; apartment?: string; label?: string; isDefault?: boolean }) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { userId, recipient: input.recipient, phone: input.phone, city: input.city, street: input.street, area: input.area, building: input.building, apartment: input.apartment, label: input.label, isDefault: input.isDefault ?? false } });
    });
  }
}
