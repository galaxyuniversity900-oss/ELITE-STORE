import { randomUUID } from 'node:crypto';

const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const headers = { 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

const catalogue = await request('/products?limit=100');
const product = (catalogue.items ?? []).find((item) => item.status === 'ACTIVE'
  && (item.stockQuantity === null || item.stockQuantity === undefined || item.stockQuantity > 0));
if (!product) throw new Error('No active in-stock product is available for the outbox smoke test');

const sessionId = randomUUID();
const idempotencyKey = `ci-outbox-${randomUUID()}`;
await request(`/cart/${sessionId}/items`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ productId: product.id, quantity: 1 }),
});

const checkout = {
  recipient: 'CI Outbox Test',
  phone: '+201000000000',
  city: 'Cairo',
  street: 'CI Test Street',
  email: 'ci-customer@example.test',
  paymentMethod: 'CASH_ON_DELIVERY',
  shippingMethod: 'DEMO_PICKUP',
};

const first = await request(`/orders/checkout/${sessionId}`, {
  method: 'POST',
  headers: { ...headers, 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(checkout),
});
if (!first.id || first.storeNotification?.queued !== true || first.storeNotification?.reason !== 'queued') {
  throw new Error('New checkout did not confirm durable notification enqueue');
}

const replay = await request(`/orders/checkout/${sessionId}`, {
  method: 'POST',
  headers: { ...headers, 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(checkout),
});
if (replay.id !== first.id || replay.storeNotification?.queued !== false
  || replay.storeNotification?.reason !== 'duplicate_checkout') {
  throw new Error('Idempotent checkout replay did not return the original order safely');
}

process.stdout.write(first.id);
