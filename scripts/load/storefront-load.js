import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:4000/api';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/products?limit=20`, {
    headers: { Accept: 'application/json' },
    tags: { journey: 'storefront-catalogue' },
  });
  check(response, {
    'catalogue returns HTTP 200': (r) => r.status === 200,
    'catalogue response is JSON': (r) => {
      try { return Array.isArray(r.json('items')); } catch { return false; }
    },
  });
  sleep(0.2);
}
