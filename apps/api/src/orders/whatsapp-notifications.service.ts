import { Injectable } from '@nestjs/common';

export type StoreNotificationResult = { sent: boolean; reason?: string; messageId?: string };

@Injectable()
export class WhatsAppNotificationsService {
  async notifyStore(order: any): Promise<StoreNotificationResult> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const recipient = (process.env.WHATSAPP_ORDER_RECIPIENT ?? '201558309605').replace(/\\D/g, '');
    const templateName = process.env.WHATSAPP_ORDER_TEMPLATE_NAME;
    const language = process.env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE ?? 'ar';
    const apiVersion = process.env.WHATSAPP_API_VERSION;

    if (!phoneNumberId || !accessToken || !templateName || !apiVersion || !recipient) {
      return { sent: false, reason: 'not_configured' };
    }

    const items = Array.isArray(order.items)
      ? order.items.map((item: any) => `${item.productName} × ${item.quantity}`).join('، ').slice(0, 900)
      : 'راجع تفاصيل الطلب في لوحة الإدارة';
    const address = order.shippingAddress && typeof order.shippingAddress === 'object'
      ? [order.shippingAddress.city, order.shippingAddress.area, order.shippingAddress.street].filter(Boolean).join('، ')
      : '';
    const amount = String(order.grandTotal ?? '');
    const bodyParameters = [
      String(order.orderNumber ?? ''),
      String(order.customerName ?? ''),
      String(order.customerPhone ?? ''),
      amount,
      items || 'لا توجد تفاصيل منتجات',
      address || 'راجع عنوان التوصيل',
    ].map((text) => ({ type: 'text', text: text.slice(0, 1024) }));

    const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components: [{ type: 'body', parameters: bodyParameters }],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Never expose provider response details or credentials to the storefront.
      return { sent: false, reason: `provider_rejected_${response.status}` };
    }
    const messageId = payload?.messages?.[0]?.id;
    return messageId ? { sent: true, messageId } : { sent: false, reason: 'provider_unconfirmed' };
  }
}
