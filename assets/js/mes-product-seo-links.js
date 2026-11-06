(() => {
  'use strict';
  const slugify = (title, id) => {
    const slug = String(title || '').normalize('NFKC').toLocaleLowerCase('ar')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '').slice(0, 70) || 'product';
    return slug + '-' + String(id).toLowerCase().replace(/[^a-z0-9-]/g, '');
  };
  async function init() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    try {
      const response = await fetch(new URL('./data/products.json', document.baseURI), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Product catalogue HTTP ' + response.status);
      const catalogue = await response.json();
      if (!Array.isArray(catalogue.products)) return;
      const urls = new Map(catalogue.products.filter(p => p && p.active !== false && p.id && p.title)
        .map(p => [String(p.id), './products/' + slugify(p.title, p.id) + '/']));
      const decorate = () => {
        grid.querySelectorAll('.product-card[data-id]').forEach(card => {
          const href = urls.get(card.getAttribute('data-id'));
          const title = card.querySelector('h3');
          if (!href || !title) return;
          let link = card.querySelector('[data-mes-product-link]');
          if (!link) {
            link = document.createElement('a');
            link.dataset.mesProductLink = 'true';
            link.className = 'mes-product-seo-link';
            link.textContent = 'صفحة المنتج والتفاصيل ←';
            title.insertAdjacentElement('afterend', link);
          }
          link.href = href;
          link.setAttribute('aria-label', 'عرض صفحة ' + title.textContent.trim());
        });
      };
      decorate();
      new MutationObserver(decorate).observe(grid, { childList: true, subtree: true });
    } catch (error) {
      console.warn('[MES product links] Could not attach product detail links:', error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
