import { randomUUID } from 'node:crypto';

const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const jsonHeaders = { 'Content-Type': 'application/json' };

async function call(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => null);
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path}: expected HTTP ${expectedStatus}, received ${response.status}; body=${JSON.stringify(body)}`);
  }
  return { response, body };
}

const catalogue = (await call('/products?limit=100')).body;
if (!Array.isArray(catalogue?.items) || catalogue.items.length === 0) {
  throw new Error('Storefront catalogue did not return products');
}
const product = catalogue.items.find((item) => item.status === 'ACTIVE'
  && (item.stockQuantity == null || item.stockQuantity > 0));
if (!product) throw new Error('No active in-stock product is available for checkout');

const sessionId = randomUUID();
const idempotencyKey = `ci-commerce-${randomUUID()}`;
const cart = (await call(`/cart/${sessionId}/items`, {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({ productId: product.id, quantity: 1 }),
}, 201)).body;
if (!Array.isArray(cart.items) || cart.items.length !== 1
  || cart.items[0].productId !== product.id || cart.items[0].quantity !== 1) {
  throw new Error('Cart did not persist the selected product and quantity');
}

const checkoutInput = {
  recipient: 'CI Commerce Test',
  phone: '+201000000000',
  city: 'Cairo',
  street: 'CI Test Street',
  email: 'ci-customer@example.test',
  paymentMethod: 'CASH_ON_DELIVERY',
  shippingMethod: 'DEMO_PICKUP',
};
await call(`/orders/checkout/${sessionId}`, {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify(checkoutInput),
}, 400);

const first = (await call(`/orders/checkout/${sessionId}`, {
  method: 'POST',
  headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(checkoutInput),
}, 201)).body;
if (!first.id || first.storeNotification?.queued !== true) {
  throw new Error('Checkout did not create an order and enqueue notifications transactionally');
}

const replay = (await call(`/orders/checkout/${sessionId}`, {
  method: 'POST',
  headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(checkoutInput),
}, 201)).body;
if (replay.id !== first.id || replay.storeNotification?.reason !== 'duplicate_checkout') {
  throw new Error('Checkout idempotency replay created a duplicate or returned inconsistent state');
}

await call('/admin/overview', {}, 401);
const admin = (await call('/auth/login', {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ci-only-bootstrap-password-12345',
  }),
})).body;
if (!admin.accessToken || !['ADMIN', 'SUPER_ADMIN'].includes(admin.user?.role)) {
  throw new Error('CI administrator authentication did not return a valid admin session');
}
const authHeaders = { Authorization: `Bearer ${admin.accessToken}` };
const overview = (await call('/admin/overview', { headers: authHeaders })).body;
if (!Number.isInteger(overview.orders) || overview.orders < 1) {
  throw new Error('Admin overview did not include persisted orders');
}
const orders = (await call('/admin/orders?limit=100', { headers: authHeaders })).body;
if (!Array.isArray(orders) || !orders.some((order) => order.id === first.id)) {
  throw new Error('Admin order list did not expose the newly created order');
}
const notifications = (await call('/admin/notifications?limit=100', { headers: authHeaders })).body;
const orderNotifications = (notifications.items ?? []).filter((item) => item.orderId === first.id);
if (orderNotifications.length !== 2
  || new Set(orderNotifications.map((item) => item.channel)).size !== 2) {
  throw new Error('Admin notification center did not expose exactly one WhatsApp and one email outbox record');
}

await call('/demo-commerce/orders/ci-nonexistent/payment', {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({ phone: '+201000000000', outcome: 'success' }),
}, 404);

process.stdout.write(JSON.stringify({
  result: 'passed',
  productId: product.id,
  orderId: first.id,
  notificationChannels: orderNotifications.map((item) => item.channel),
  adminRole: admin.user.role,
}));
