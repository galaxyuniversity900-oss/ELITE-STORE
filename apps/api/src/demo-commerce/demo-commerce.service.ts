import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReservationStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const PAYMENT_METHODS = [
  { id: 'CASH_ON_DELIVERY', label: 'الدفع عند الاستلام', mode: 'manual', demo: true },
  { id: 'DEMO_CARD', label: 'بطاقة بنكية تجريبية', mode: 'simulated', demo: true },
  { id: 'DEMO_WALLET', label: 'محفظة إلكترونية تجريبية', mode: 'simulated', demo: true },
];
const SHIPPING_OPTIONS = [
  { id: 'DEMO_STANDARD', label: 'شحن عادي تجريبي', fee: 45, currency: 'EGP', estimatedDays: '3-5', demo: true },
  { id: 'DEMO_EXPRESS', label: 'شحن سريع تجريبي', fee: 75, currency: 'EGP', estimatedDays: '1-2', demo: true },
  { id: 'DEMO_PICKUP', label: 'استلام من نقطة تجريبية', fee: 0, currency: 'EGP', estimatedDays: 'حسب الجاهزية', demo: true },
];

@Injectable()
export class DemoCommerceService {
  constructor(private readonly prisma: PrismaService) {}

  paymentMethods() {
    return { environment: 'DEMO_ONLY', realMoneyEnabled: false, methods: PAYMENT_METHODS };
  }

  shippingOptions() {
    return { environment: 'DEMO_ONLY', courierBookingEnabled: false, options: SHIPPING_OPTIONS };
  }

  private async ownedOrder(orderNumber: string, phone: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payments: { orderBy: { createdAt: 'desc' } }, shipment: { include: { events: { orderBy: { occurredAt: 'asc' } } } } },
    });
    if (!order || !phone || order.customerPhone !== phone) throw new NotFoundException('Order not found');
    return order;
  }

  async simulatePayment(orderNumber: string, input: { phone: string; outcome: 'success' | 'failed' | 'pending' }) {
    const order = await this.ownedOrder(orderNumber, input.phone);
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Payment cannot be simulated for a cancelled or refunded order');
    }
    if (order.paymentMethod === 'CASH_ON_DELIVERY') {
      throw new BadRequestException('Cash on delivery does not use online payment simulation');
    }
    const status = input.outcome === 'success' ? PaymentStatus.PAID
      : input.outcome === 'failed' ? PaymentStatus.FAILED : PaymentStatus.PENDING;
    const reference = `DEMO-PAY-${randomUUID().slice(0, 12).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: order.id },
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      });
      if (!current || current.status === OrderStatus.CANCELLED || current.status === OrderStatus.REFUNDED) {
        throw new BadRequestException('Payment cannot be simulated for this order state');
      }
      const previous = current.payments[0];
      if (previous?.status === PaymentStatus.PAID && status !== PaymentStatus.PAID) {
        throw new BadRequestException('A successful payment simulation cannot be downgraded');
      }
      const payment = previous
        ? await tx.payment.update({
            where: { id: previous.id },
            data: { provider: 'demo_gateway', providerReference: reference, status, paidAt: status === PaymentStatus.PAID ? new Date() : null, metadata: { simulated: true, outcome: input.outcome } },
          })
        : await tx.payment.create({
            data: { orderId: current.id, provider: 'demo_gateway', providerReference: reference, status, amount: current.grandTotal, currency: current.currency, paidAt: status === PaymentStatus.PAID ? new Date() : null, metadata: { simulated: true, outcome: input.outcome } },
          });
      if (status === PaymentStatus.PAID && current.status === OrderStatus.PENDING) {
        const changed = await tx.order.updateMany({
          where: { id: current.id, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CONFIRMED },
        });
        if (changed.count !== 1) throw new BadRequestException('Order changed concurrently; reload and retry');
        await tx.orderStatusEvent.create({
          data: { orderId: current.id, fromStatus: OrderStatus.PENDING, toStatus: OrderStatus.CONFIRMED, reason: 'DEMO_PAYMENT_SIMULATION' },
        });
        await tx.inventoryReservation.updateMany({
          where: { orderId: current.id, status: InventoryReservationStatus.ACTIVE },
          data: { status: InventoryReservationStatus.CONSUMED, consumedAt: new Date() },
        });
      }
      return { demo: true, realCharge: false, payment: { id: payment.id, reference, status, amount: payment.amount, currency: payment.currency } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }


  async dispatch(orderNumber: string, phone: string) {
    const order = await this.ownedOrder(orderNumber, phone);
    if (order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException('Demo dispatch requires an order in PROCESSING state');
    }
    if (order.shipment) return { demo: true, shipment: order.shipment };
    const trackingNumber = `MES-TRK-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          provider: 'DEMO_COURIER',
          service: order.shippingMethod,
          trackingNumber,
          status: 'PICKED_UP',
          estimatedDays: order.shippingMethod === 'DEMO_EXPRESS' ? 2 : 4,
          shippedAt: new Date(),
          events: { create: { orderId: order.id, status: 'PICKED_UP', description: 'تم استلام الشحنة - حدث تجريبي', location: 'مركز تجهيز تجريبي' } },
        },
        include: { events: true },
      });
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PROCESSING },
        data: { status: OrderStatus.SHIPPED },
      });
      if (changed.count !== 1) throw new BadRequestException('Order changed concurrently; reload and retry');
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: OrderStatus.PROCESSING, toStatus: OrderStatus.SHIPPED, reason: 'DEMO_DISPATCH' },
      });
      return { demo: true, courierBooking: false, shipment };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }


  async updateShipment(trackingNumber: string, input: { phone: string; status: string; description: string; location: string }) {
    const shipment = await this.prisma.shipment.findUnique({ where: { trackingNumber }, include: { order: true } });
    if (!shipment || shipment.order.customerPhone !== input.phone) throw new NotFoundException('Shipment not found');
    if (shipment.status === input.status) return { demo: true, shipment };
    const allowed: Record<string, string[]> = {
      PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPT_FAILED'],
      IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPT_FAILED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPT_FAILED'],
      DELIVERY_ATTEMPT_FAILED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY'],
      DELIVERED: [],
    };
    if (shipment.status !== input.status && !allowed[shipment.status]?.includes(input.status)) {
      throw new BadRequestException(`Invalid shipment transition: ${shipment.status} -> ${input.status}`);
    }
    const deliveredAt = input.status === 'DELIVERED' ? new Date() : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: input.status, deliveredAt },
      });
      await tx.trackingEvent.create({
        data: { orderId: shipment.orderId, shipmentId: shipment.id, status: input.status, description: input.description, location: input.location },
      });
      if (input.status === 'DELIVERED' && shipment.order.status !== OrderStatus.DELIVERED) {
        if (shipment.order.status !== OrderStatus.SHIPPED) {
          throw new BadRequestException('Only a shipped order can be marked delivered');
        }
        const changed = await tx.order.updateMany({
          where: { id: shipment.orderId, status: OrderStatus.SHIPPED },
          data: { status: OrderStatus.DELIVERED },
        });
        if (changed.count !== 1) throw new BadRequestException('Order changed concurrently; reload and retry');
        await tx.orderStatusEvent.create({
          data: { orderId: shipment.orderId, fromStatus: OrderStatus.SHIPPED, toStatus: OrderStatus.DELIVERED, reason: 'DEMO_SHIPMENT_DELIVERED' },
        });
      }
      return next;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { demo: true, shipment: updated };
  }


  async track(trackingNumber: string, phone: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
      include: { order: { select: { orderNumber: true, customerName: true, customerPhone: true, status: true, createdAt: true } }, events: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!shipment || !phone || shipment.order.customerPhone !== phone) throw new NotFoundException('Tracking record not found');
    return {
      demo: true,
      orderNumber: shipment.order.orderNumber,
      orderStatus: shipment.order.status,
      trackingNumber: shipment.trackingNumber,
      courier: shipment.provider,
      shipmentStatus: shipment.status,
      estimatedDays: shipment.estimatedDays,
      events: shipment.events.map(({ status, description, location, occurredAt }) => ({ status, description, location, occurredAt })),
    };
  }
}
