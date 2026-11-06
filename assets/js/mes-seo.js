(() => {
  'use strict';

  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = new URL(canonicalLink?.href || './ELITE.html', document.baseURI);
  canonicalUrl.search = '';
  canonicalUrl.hash = '';
  const catalogueUrl = new URL('./data/products.json', document.baseURI);

  function absoluteImageUrls(media) {
    if (!media || typeof media !== 'object') return [];
    const candidates = [media.cover, ...(Array.isArray(media.images) ? media.images : [])];
    return [...new Set(candidates.filter(value => typeof value === 'string' && value.trim()).map(value => {
      try {
        const url = new URL(value, document.baseURI);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
      } catch {
        return null;
      }
    }).filter(Boolean))];
  }

  function buildProduct(product, position) {
    const productUrl = new URL(canonicalUrl.href);
    productUrl.hash = 'product-' + encodeURIComponent(product.id);
    const entity = {
      '@type': 'Product',
      name: product.title.trim(),
      sku: product.id,
      brand: { '@type': 'Brand', name: 'MES STORE' },
      category: product.category,
      url: productUrl.href
    };
    if (typeof product.desc === 'string' && product.desc.trim()) entity.description = product.desc.trim();
    const images = absoluteImageUrls(product.media);
    if (images.length) entity.image = images;
    const price = Number(product.price);
    if (!product.priceNote && Number.isFinite(price) && price >= 0) {
      entity.offers = {
        '@type': 'Offer',
        url: productUrl.href,
        priceCurrency: 'EGP',
        price: String(price),
        seller: { '@type': 'Organization', name: 'MES STORE' }
      };
    }
    return { '@type': 'ListItem', position, item: entity };
  }

  fetch(catalogueUrl, { headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error('Catalogue returned HTTP ' + response.status);
      return response.json();
    })
    .then(catalogue => {
      if (!catalogue || catalogue.version !== 1 || !Array.isArray(catalogue.products)) {
        throw new Error('Unsupported product catalogue');
      }
      const activeProducts = catalogue.products.filter(product =>
        product && product.active !== false &&
        typeof product.id === 'string' && /^[a-z0-9][a-z0-9_-]{1,48}$/i.test(product.id) &&
        typeof product.title === 'string' && product.title.trim() &&
        typeof product.category === 'string' && product.category.trim()
      );
      const itemList = {
        '@type': 'ItemList',
        name: 'مجموعة MES STORE للملابس الرجالي',
        numberOfItems: activeProducts.length,
        itemListElement: activeProducts.map((product, index) => buildProduct(product, index + 1))
      };
      const graph = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': canonicalUrl.origin + canonicalUrl.pathname + '#organization',
            name: 'MES STORE',
            url: canonicalUrl.origin + canonicalUrl.pathname
          },
          {
            '@type': 'WebSite',
            '@id': canonicalUrl.origin + canonicalUrl.pathname + '#website',
            name: 'MES STORE',
            url: canonicalUrl.origin + canonicalUrl.pathname,
            inLanguage: 'ar-EG',
            publisher: { '@id': canonicalUrl.origin + canonicalUrl.pathname + '#organization' }
          },
          {
            '@type': 'CollectionPage',
            '@id': canonicalUrl.href + '#collection',
            url: canonicalUrl.href,
            name: 'MES STORE | Men's Collection',
            description: 'مجموعة MES STORE من الملابس الرجالي.',
            inLanguage: 'ar-EG',
            mainEntity: itemList,
            isPartOf: { '@id': canonicalUrl.origin + canonicalUrl.pathname + '#website' }
          }
        ]
      };
      let script = document.getElementById('mes-product-structured-data');
      if (!script) {
        script = document.createElement('script');
        script.id = 'mes-product-structured-data';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(graph).replace(/</g, '\\u003c');
    })
    .catch(error => console.warn('[MES SEO] Product structured data unavailable:', error));
})();
