# MES STORE — WhatsApp order alerts

The API sends a WhatsApp Cloud API template notification to the store after a **new order is committed** by `POST /api/orders/checkout/:sessionId`. A retry with the same idempotency key does not send a duplicate notification.

## Required deployment secrets

Set these in the API hosting provider's secret/environment settings. Do not put real credentials in GitHub files, frontend JavaScript, or `.env.example`:

- `WHATSAPP_ORDER_RECIPIENT`: store phone in international digits-only format (defaults to `201558309605`).
- `WHATSAPP_PHONE_NUMBER_ID`: the sender Phone Number ID from Meta WhatsApp Manager.
- `WHATSAPP_ACCESS_TOKEN`: a valid server-side access token with permission to send WhatsApp messages.
- `WHATSAPP_API_VERSION`: a currently supported Graph API version, e.g. the version enabled for the Meta app.
- `WHATSAPP_ORDER_TEMPLATE_NAME`: the exact name of an approved WhatsApp message template.
- `WHATSAPP_ORDER_TEMPLATE_LANGUAGE`: approved template language code (defaults to `ar`).

## Required approved template

Create and get approval for a utility template with **six body text parameters in this exact order**:

1. Order number
2. Customer name
3. Customer phone
4. Grand total
5. Ordered items (product and quantity)
6. Delivery address summary

Example Arabic body (use `{{1}}` through `{{6}}` as template placeholders):

```text
طلب جديد من MES STORE
رقم الطلب: {{1}}
اسم العميل: {{2}}
هاتف العميل: {{3}}
الإجمالي: {{4}} جنيه
المنتجات: {{5}}
العنوان: {{6}}
يرجى مراجعة الطلب وتأكيد التوافر والتوصيل.
```

The template must be approved by Meta before the API can send it. Business-initiated messages generally require an approved template; the code intentionally does not attempt an unapproved free-form message.

## Important deployment conditions

- The Cloud API sender number and `WHATSAPP_ORDER_RECIPIENT` should be distinct. The recipient must be able to receive WhatsApp messages and have provided any consent required by Meta policy.
- Configure secrets on the **API server**, not GitHub Pages or the browser.
- The notification is attempted only after the database transaction commits. If Meta rejects the request or configuration is incomplete, the order remains saved and the API response reports `storeNotification.sent=false` with a non-sensitive reason.
- A successful API response confirms provider acceptance, not delivery/read status on the recipient device.
- The legacy static `ELITE.html` cart currently prepares a `wa.me` message for the customer to send manually. Automatic server-side alerts require routing checkout through the deployed API checkout flow; merely setting these secrets does not convert that static-cart flow into an API checkout.
