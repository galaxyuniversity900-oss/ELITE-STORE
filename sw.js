const CACHE_NAME = 'mes-store-shell-v1';
const APP_SHELL = [
  './ELITE.html',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './assets/pwa-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mes-store-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/api')) return;
  if (url.searchParams.has('token') || url.searchParams.has('session')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./ELITE.html', copy));
        }
        return response;
      }).catch(async () => (await caches.match(request)) || (await caches.match('./ELITE.html')) || (await caches.match('./offline.html'))),
    );
    return;
  }

  const isStaticAsset = /\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }),
  );
});
