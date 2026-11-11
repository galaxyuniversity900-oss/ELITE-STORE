(() => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // PWA enhancement is optional; storefront navigation must remain usable without it.
    });
  }, { once: true });
})();
