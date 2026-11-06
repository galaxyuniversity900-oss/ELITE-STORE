# MES STORE — WhatsApp order alerts

WhatsApp order alerts are delivered by the transactional notification outbox. The order and its WhatsApp/email notification records are committed atomically. See [Transactional notification outbox](notifications/TRANSACTIONAL_OUTBOX.md) for retry, deduplication, delivery history, webhook security and operational details.

## Required approved template

Create and get approval for a utility template with six body text parameters in this exact order:

1. Order number
2. Customer name
3. Customer phone
4. Grand total with currency
5. Ordered items (product and quantity)
6. Delivery address summary

Example Arabic body (use `{{1}}` through `{{6}}` as template placeholders):

```text
طلب جديد من MES STORE
رقم الطلب: {{1}}
اسم العميل: {{2}}
هاتف العميل: {{3}}
الإجمالي: {{4}}
المنتجات: {{5}}
العنوان: {{6}}
يرجى مراجعة الطلب وتأكيد التوافر والتوصيل.
```

The template must be approved by Meta. Configure `WHATSAPP_BUSINESS_ACCOUNT_ID`, sender `WHATSAPP_PHONE_NUMBER_ID`, access token, Graph API version, template name, app secret and webhook verification token in the API deployment secret store. The store recipient `WHATSAPP_ORDER_RECIPIENT` must be explicitly set in international digits-only format; the API has no default recipient.

Run `npm run notifications:providers` before enabling production sends. This read-only preflight verifies the Meta template is approved for the configured language and has exactly the six ordered BODY placeholders, then checks that the domain used by `RESEND_FROM_EMAIL` is verified in the Resend account. It does not send messages. The webhook verification endpoint uses `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; POST callbacks are verified against the raw request bytes with `WHATSAPP_APP_SECRET` and HMAC-SHA256. Resend callbacks use the `whsec_` signing secret and Svix timestamp/signature headers.

Only after the read-only preflight succeeds, configure `NOTIFICATION_LIVE_TEST_PHONE` and `NOTIFICATION_LIVE_TEST_EMAIL` as controlled test destinations and run `npm run notifications:providers:live`. This sends one explicitly labeled test WhatsApp template message and one test email. It is not a checkout test and does not use customer order data.

The Cloud API sender and recipient should be distinct. The recipient must be able to receive WhatsApp messages and have provided any consent required by Meta policy.

A provider acceptance response is not proof of delivery or reading. Configure the signed WhatsApp webhook at `/api/notifications/webhooks/whatsapp` to record sent, delivered, read and failed statuses. The legacy static `ELITE.html` checkout still needs to be routed through the API checkout before it can create server-side orders and outbox events.
