import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConsentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}
  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true, createdAt: true } });
    if (!user) throw new NotFoundException('Customer account not found');
    return user;
  }


  async exportPersonalData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerifiedAt: true,
        createdAt: true,
        addresses: true,
        consentPreferences: {
          select: { consentType: true, granted: true, policyVersion: true, source: true, decidedAt: true },
          orderBy: { consentType: 'asc' },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            orderNumber: true, status: true, subtotal: true, discountTotal: true,
            shippingTotal: true, grandTotal: true, currency: true, paymentMethod: true,
            shippingMethod: true, customerName: true, customerEmail: true,
            customerPhone: true, shippingAddress: true, notes: true, createdAt: true,
            items: true,
            payments: { select: { provider: true, providerReference: true, status: true, amount: true, currency: true, paidAt: true, createdAt: true } },
            shipment: { select: { provider: true, service: true, trackingNumber: true, status: true, estimatedDays: true, shippedAt: true, deliveredAt: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Customer account not found');
    return { exportFormat: 'MES_STORE_ACCOUNT_JSON_V1', exportedAt: new Date().toISOString(), data: user };
  }

  async requestErasure(userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dataSubjectRequest.findFirst({
        where: { userId, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } },
        orderBy: { requestedAt: 'desc' },
      });
      if (existing) return existing;
      return tx.dataSubjectRequest.create({
        data: { userId, reason: reason?.trim() || null },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  listDataSubjectRequests(userId: string) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { userId },
      select: { id: true, status: true, reason: true, requestedAt: true, reviewedAt: true, completedAt: true },
      orderBy: { requestedAt: 'desc' },
    });
  }

  consents(userId: string) {
    return this.prisma.consentPreference.findMany({
      where: { userId },
      orderBy: { consentType: 'asc' },
      select: { consentType: true, granted: true, policyVersion: true, source: true, decidedAt: true, updatedAt: true },
    });
  }

  async setConsent(userId: string, input: { consentType: ConsentType; granted: boolean }) {
    const policyVersion = process.env.CONSENT_POLICY_VERSION?.trim();
    if (!policyVersion) throw new ServiceUnavailableException('Consent policy version is not configured');
    return this.prisma.consentPreference.upsert({
      where: { userId_consentType: { userId, consentType: input.consentType } },
      create: {
        userId,
        consentType: input.consentType,
        granted: input.granted,
        policyVersion,
        source: 'ACCOUNT_SETTINGS',
        decidedAt: new Date(),
      },
      update: {
        granted: input.granted,
        policyVersion,
        source: 'ACCOUNT_SETTINGS',
        decidedAt: new Date(),
      },
      select: { consentType: true, granted: true, policyVersion: true, source: true, decidedAt: true, updatedAt: true },
    });
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
