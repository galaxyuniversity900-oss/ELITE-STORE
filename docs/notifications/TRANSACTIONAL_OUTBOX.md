# MES STORE — Transactional notification outbox

## What is implemented

- Order creation and two notification records (WhatsApp + email) are written in the **same PostgreSQL transaction**. If the order transaction rolls back, the notification records roll back too.
- Each channel has a deterministic unique deduplication key: `<orderId>:ORDER_CREATED:<CHANNEL>`. Repeated checkout requests with the same idempotency key return the existing order and do not enqueue a second event.
- Every API replica can run the worker concurrently. Each poll claims up to 10 due rows in one short PostgreSQL transaction using `SELECT ... FOR UPDATE SKIP LOCKED`; concurrent replicas receive disjoint row sets without a Redis lock.
- The database row lock is held only while marking claims as `PROCESSING`, assigning a fresh per-claim `lockToken`, and incrementing the attempt counter. Provider network calls happen after the claim transaction commits.
- Completion and retry updates are fenced by both notification ID and the exact `lockToken`, so a worker whose lease was recovered cannot overwrite a newer worker's state.
- The deterministic unique `dedupeKey` remains the durable enqueue deduplication boundary. It is independent of worker count and is enforced by PostgreSQL's unique constraint.
- Worker replicas poll every five seconds and process their claimed batches concurrently (up to 10 tasks per replica). Scale API/worker replicas horizontally against the same PostgreSQL database; no Redis coordination dependency is required.
- Retry policy: up to 8 attempts, exponential delay starting at 30 seconds, capped at 6 hours. HTTP 408, 429, 5xx and network failures are retryable; missing configuration and other 4xx responses are terminal.
- A two-minute processing lease allows work to recover after an API process crashes. Each delivery attempt is retained. The lease is longer than the provider request timeout; keep provider timeouts below the lease duration.
- Email is sent through Resend. The stable outbox dedupe key is also sent as Resend's `Idempotency-Key`.
- WhatsApp is sent through the Meta WhatsApp Cloud API using an approved utility template.
- Admins can inspect queue state and attempt history at `GET /api/admin/notifications`, and manually requeue a terminal record with `POST /api/admin/notifications/:id/retry`. Manual requeues are recorded in the delivery-event history and grant up to eight additional attempts.
- If a provider webhook arrives before the worker stores its provider message ID, the endpoint returns HTTP 503 so the provider can retry the event.
- Signed provider webhooks update delivery status: `GET/POST /api/notifications/webhooks/whatsapp` and `POST /api/notifications/webhooks/resend`. Webhook events are deduplicated.

## Required API environment

Set these only in the API hosting secret store:

### WhatsApp Cloud API
- `WHATSAPP_ORDER_RECIPIENT` — store recipient in international digits-only format.
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_ORDER_TEMPLATE_NAME`
- `WHATSAPP_ORDER_TEMPLATE_LANGUAGE` (default `ar`)
- `WHATSAPP_APP_SECRET` — Meta app secret used to verify webhook signatures.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — private random verification string configured in Meta webhook setup.

The approved template must contain six body text parameters, in order: order number, customer name, customer phone, total with currency, item summary, and address summary.

### Email via Resend
- `ORDER_NOTIFICATION_EMAIL` — store inbox that receives new-order alerts.
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — verified sender identity/domain.
- `RESEND_WEBHOOK_SECRET` — signing secret for the Resend webhook endpoint.

Configure Resend webhooks for the email events `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, and `email.failed`.

## Delivery semantics and limitations

- The checkout response preserves the existing `storeNotification` field for compatibility: `sent: false, queued: true, reason: 'queued'` means the notification is durably queued, not that delivery failed.
- The order is not rolled back when a provider is unavailable. Notification work remains durable and retries according to policy.
- `SENT` means the provider accepted the send request and returned a message ID. It does **not** mean the recipient received or read the message. Provider webhook statuses are stored separately in `providerStatus` and the delivery-event history.
- Outbox deduplication prevents duplicate event creation regardless of how many workers are running. Resend also receives the stable idempotency key. WhatsApp Cloud API does not provide a general send idempotency key; if the provider accepts a message but the worker crashes before persisting the response, a retry can still cause a duplicate WhatsApp message. This is the unavoidable at-least-once delivery boundary without provider-side idempotency.
- A missing provider configuration is recorded as a terminal failure instead of silently dropping the notification. Configure the secrets and use the admin log to inspect/requeue through an audited operational action (manual requeue endpoint is intentionally not exposed yet).
- Webhook URLs must be publicly reachable over HTTPS. Never disable signature verification in production.
- The webhook implementation stores event identifiers and minimal status metadata; it does not retain raw provider webhook bodies or secrets.
