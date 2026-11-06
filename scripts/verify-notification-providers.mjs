#!/usr/bin/env node
/**
 * Read-only provider preflight by default.
 * A real test message is sent only when --send-live is supplied and two
 * explicit, controlled test destinations are configured.
 */
const LIVE = process.argv.includes('--send-live');

const required = [
  'WHATSAPP_ORDER_RECIPIENT',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_API_VERSION',
  'WHATSAPP_ORDER_TEMPLATE_NAME',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'ORDER_NOTIFICATION_EMAIL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_WEBHOOK_SECRET',
];

const missing = required.filter((key) => !process.env[key]?.trim());
if (LIVE) {
  for (const key of ['NOTIFICATION_LIVE_TEST_PHONE', 'NOTIFICATION_LIVE_TEST_EMAIL']) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
}
if (missing.length) {
  console.error('Provider preflight blocked. Missing required configuration:');
  for (const key of missing) console.error(`- ${key}`);
  console.error('No provider requests or messages were sent.');
  process.exit(2);
}

const env = process.env;
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
  else console.log(`PASS ${message}`);
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{8,15}$/;
const apiVersionPattern = /^v\d+\.\d+$/;
const senderMatch = env.RESEND_FROM_EMAIL.match(/<([^>]+)>/) ?? [null, env.RESEND_FROM_EMAIL];
const senderEmail = senderMatch[1].trim();
const senderDomain = senderEmail.split('@')[1]?.toLowerCase();
const resendSecret = env.RESEND_WEBHOOK_SECRET;
const resendSecretBytes = resendSecret.startsWith('whsec_')
  ? Buffer.from(resendSecret.slice(6), 'base64')
  : Buffer.alloc(0);

check(phonePattern.test(env.WHATSAPP_ORDER_RECIPIENT), 'WhatsApp store recipient is international digits-only');
check(emailPattern.test(env.ORDER_NOTIFICATION_EMAIL), 'Store notification inbox is a valid email');
check(emailPattern.test(senderEmail), 'Resend sender address is valid');
check(apiVersionPattern.test(env.WHATSAPP_API_VERSION), 'Meta Graph API version has vNN.N format');
check(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN.length >= 32, 'Meta webhook verification token has at least 32 characters');
check(resendSecret.startsWith('whsec_') && resendSecretBytes.length >= 16, 'Resend webhook secret uses a valid whsec_ encoding');
check(Boolean(senderDomain), 'Resend sender domain can be parsed');
if (LIVE) {
  check(phonePattern.test(env.NOTIFICATION_LIVE_TEST_PHONE ?? ''), 'Live WhatsApp test destination is valid');
  check(emailPattern.test(env.NOTIFICATION_LIVE_TEST_EMAIL ?? ''), 'Live email test destination is valid');
}

if (failures.length) {
  console.error('\nConfiguration validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('No provider requests or messages were sent.');
  process.exit(2);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

const graphBase = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
const graphHeaders = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` };
let approvedTemplate = false;
let verifiedSender = false;

try {
  const url = new URL(`${graphBase}/${encodeURIComponent(env.WHATSAPP_BUSINESS_ACCOUNT_ID)}/message_templates`);
  url.searchParams.set('name', env.WHATSAPP_ORDER_TEMPLATE_NAME);
  url.searchParams.set('fields', 'name,status,language,components');
  const response = await requestJson(url, { headers: graphHeaders });
  const matches = Array.isArray(response.data) ? response.data : [];
  const template = matches.find((item) =>
    item.name === env.WHATSAPP_ORDER_TEMPLATE_NAME &&
    item.language === (env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE || 'ar')
  );
  check(Boolean(template), 'Meta template exists for the configured name and language');
  if (template) {
    check(template.status === 'APPROVED', 'Meta template status is APPROVED');
    const body = (template.components ?? []).find((component) => component.type === 'BODY');
    const placeholders = [...String(body?.text ?? '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)]
      .map((match) => Number(match[1]));
    approvedTemplate = template.status === 'APPROVED' &&
      placeholders.length === 6 &&
      placeholders.every((value, index) => value === index + 1);
    check(placeholders.length === 6 && placeholders.every((value, index) => value === index + 1),
      'Meta template BODY has exactly six ordered placeholders {{1}} through {{6}}');
  }
} catch (error) {
  failures.push(`Meta template verification failed: ${error.message}`);
}

try {
  const response = await requestJson('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  const domains = Array.isArray(response.data) ? response.data : [];
  const domain = domains.find((item) => String(item.name ?? '').toLowerCase() === senderDomain);
  check(Boolean(domain), 'Resend sender domain exists in the configured account');
  if (domain) {
    verifiedSender = String(domain.status ?? '').toLowerCase() === 'verified';
    check(verifiedSender, 'Resend sender domain status is verified');
  }
} catch (error) {
  failures.push(`Resend sender-domain verification failed: ${error.message}`);
}

if (failures.length) {
  console.error('\nProvider preflight failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('No messages were sent.');
  process.exit(1);
}

console.log('\nPASS Meta webhook HMAC secret is configured (signature verification remains enforced by API).');
console.log('PASS Resend Svix webhook secret is configured (signature verification remains enforced by API).');
console.log('PASS Both provider read-only checks completed.');

if (!LIVE) {
  console.log('READ-ONLY MODE: no email or WhatsApp message was sent.');
  console.log('To send one test message through each provider, use --send-live with controlled test destinations.');
  process.exit(0);
}

if (!approvedTemplate || !verifiedSender) {
  console.error('Live sending blocked because template approval or sender verification did not pass.');
  process.exit(1);
}

const testId = `provider-smoke-${new Date().toISOString()}`;
const templateParameters = [
  testId,
  'MES STORE Integration Test',
  env.NOTIFICATION_LIVE_TEST_PHONE,
  '0.00 EGP',
  'Test item × 1',
  'Test address — not a real order',
].map((text) => ({ type: 'text', text }));

const waResult = await requestJson(
  `${graphBase}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,
  {
    method: 'POST',
    headers: { ...graphHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: env.NOTIFICATION_LIVE_TEST_PHONE,
      type: 'template',
      template: {
        name: env.WHATSAPP_ORDER_TEMPLATE_NAME,
        language: { code: env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE || 'ar' },
        components: [{ type: 'body', parameters: templateParameters }],
      },
    }),
  },
);
check(Boolean(waResult?.messages?.[0]?.id), 'Meta accepted the live WhatsApp smoke test');

const emailResult = await requestJson('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': testId,
  },
  body: JSON.stringify({
    from: env.RESEND_FROM_EMAIL,
    to: [env.NOTIFICATION_LIVE_TEST_EMAIL],
    subject: '[MES STORE] Production integration smoke test',
    html: '<p>MES STORE Resend integration smoke test. This is not a customer order.</p>',
  }),
});
check(Boolean(emailResult?.id), 'Resend accepted the live email smoke test');
console.log('LIVE TEST ACCEPTED. Provider acceptance is not proof of delivery; confirm webhook delivery events.');
