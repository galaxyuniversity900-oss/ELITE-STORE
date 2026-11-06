/* MES Motion Embed — PowerPoint-exported web animation integration.
 * Supported assets: MP4/WebM, GIF/WebP, animated SVG, and Lottie JSON.
 * Configuration lives in data/motion-embeds.json. Same-origin assets only.
 */
(() => {
  'use strict';
  const CONFIG_URL = './data/motion-embeds.json';
  const LOTTIE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.13.0/lottie.min.js';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const loaded = new Set();
  let lottiePromise;

  const safeAssetUrl = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
      return url.href;
    } catch { return null; }
  };
  const safeSelector = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { document.querySelector(value); return value; } catch { return null; }
  };
  function loadLottie() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (lottiePromise) return lottiePromise;
    lottiePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LOTTIE_URL;
      script.async = true;
      script.onload = () => window.lottie ? resolve(window.lottie) : reject(new Error('Lottie runtime unavailable'));
      script.onerror = () => reject(new Error('Lottie runtime could not be loaded'));
      document.head.append(script);
    });
    return lottiePromise;
  }
  function createFrame(item) {
    const figure = document.createElement('figure');
    figure.className = 'mes-motion-embed';
    figure.dataset.motionId = String(item.id || '');
    figure.dataset.motionType = String(item.type || '');
    if (item.aspectRatio && /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(item.aspectRatio)) {
      figure.style.aspectRatio = item.aspectRatio.replace(/\s/g, '');
    }
    if (item.maxWidth && /^\d{2,4}px$/.test(item.maxWidth)) figure.style.maxWidth = item.maxWidth;
    const stage = document.createElement('div');
    stage.className = 'mes-motion-embed__stage';
    stage.setAttribute('role', 'group');
    if (item.title) stage.setAttribute('aria-label', String(item.title).slice(0, 120));
    figure.append(stage);
    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = String(item.caption).slice(0, 180);
      figure.append(caption);
    }
    return { figure, stage };
  }
  function addPoster(stage, poster, alt) {
    if (!poster) return null;
    const img = document.createElement('img');
    img.className = 'mes-motion-embed__poster';
    img.src = poster; img.alt = alt || ''; img.loading = 'lazy'; img.decoding = 'async';
    stage.append(img);
    return img;
  }
  function renderVideo(stage, item, src, poster) {
    const video = document.createElement('video');
    video.className = 'mes-motion-embed__media';
    video.preload = 'metadata'; video.playsInline = true;
    video.muted = item.muted !== false; video.loop = item.loop !== false;
    video.controls = item.controls === true || reducedMotion.matches || item.autoplay === false;
    video.setAttribute('playsinline', '');
    if (poster) video.poster = poster;
    const source = document.createElement('source');
    source.src = src;
    source.type = new URL(src, document.baseURI).pathname.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
    video.append(source); stage.append(video);
    if (item.autoplay !== false && !reducedMotion.matches) {
      video.autoplay = true; video.setAttribute('autoplay', '');
      video.play().catch(() => { video.controls = true; });
    }
    return () => { video.pause(); video.removeAttribute('src'); video.querySelectorAll('source').forEach(node => node.removeAttribute('src')); video.load(); };
  }
  function renderImage(stage, src, alt) {
    const image = document.createElement('img');
    image.className = 'mes-motion-embed__media'; image.src = src;
    image.alt = alt || ''; image.loading = 'lazy'; image.decoding = 'async';
    stage.append(image);
    return () => image.removeAttribute('src');
  }
  async function renderLottie(stage, item, src, poster) {
    const posterNode = addPoster(stage, poster, item.alt || '');
    if (reducedMotion.matches) { stage.classList.add('is-static'); return () => {}; }
    try {
      const lottie = await loadLottie();
      if (!stage.isConnected) return () => {};
      posterNode?.remove();
      const animation = lottie.loadAnimation({
        container: stage, renderer: 'svg', loop: item.loop !== false,
        autoplay: item.autoplay !== false, path: src,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }
      });
      stage._mesLottieAnimation = animation;
      animation.addEventListener('data_failed', () => {
        stage.classList.add('is-failed'); stage.setAttribute('aria-label', 'تعذر تحميل الحركة');
      });
      return () => animation.destroy();
    } catch (error) {
      stage.classList.add('is-failed'); stage.setAttribute('aria-label', 'تعذر تحميل الحركة المتحركة');
      console.warn('[MES Motion Embed]', error);
      return () => {};
    }
  }
  async function mount(item) {
    if (!item || item.enabled === false || !item.id || loaded.has(String(item.id))) return;
    const selector = safeSelector(item.target);
    const source = safeAssetUrl(item.src);
    const poster = item.poster ? safeAssetUrl(item.poster) : null;
    const allowed = ['video', 'gif', 'webp', 'svg', 'lottie'];
    const extension = source.split('?')[0].toLowerCase().split('.').pop();
    const validExtension = item.type === 'video' ? ['mp4', 'webm'].includes(extension)
      : item.type === 'gif' ? extension === 'gif'
      : item.type === 'webp' ? extension === 'webp'
      : item.type === 'svg' ? extension === 'svg'
      : item.type === 'lottie' ? extension === 'json' : false;
    if (!selector || !source || !allowed.includes(item.type) || !validExtension) {
      console.warn('[MES Motion Embed] Invalid entry skipped:', item.id); return;
    }
    const target = document.querySelector(selector);
    if (!target) return;
    const { figure, stage } = createFrame(item);
    const alt = item.decorative === true ? '' : String(item.alt || item.title || 'حركة مرئية').slice(0, 180);
    const placement = ['beforebegin', 'afterbegin', 'beforeend', 'afterend'].includes(item.placement) ? item.placement : 'beforeend';
    target.insertAdjacentElement(placement, figure);
    let cleanup = () => {};
    if (item.type === 'video') cleanup = renderVideo(stage, item, source, poster);
    else if (item.type === 'lottie') cleanup = await renderLottie(stage, item, source, poster);
    else cleanup = renderImage(stage, source, alt);
    loaded.add(String(item.id));
    figure._mesMotionCleanup = cleanup;
    document.dispatchEvent(new CustomEvent('mes:motion-embedded', { detail: { id: String(item.id), element: figure } }));
  }
  async function init() {
    try {
      const response = await fetch(CONFIG_URL, { cache: 'no-cache', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Motion configuration HTTP ' + response.status);
      const config = await response.json();
      if (config.version !== 1 || !Array.isArray(config.items)) throw new Error('Unsupported motion configuration');
      for (const item of config.items) await mount(item);
    } catch (error) { console.warn('[MES Motion Embed] Motion configuration not applied:', error); }
  }
  reducedMotion.addEventListener?.('change', () => {
    document.querySelectorAll('.mes-motion-embed video').forEach(video => {
      if (reducedMotion.matches) { video.pause(); video.controls = true; }
      else if (video.hasAttribute('autoplay')) video.play().catch(() => { video.controls = true; });
    });
    document.querySelectorAll('.mes-motion-embed__stage').forEach(stage => {
      const animation = stage._mesLottieAnimation;
      if (!animation) return;
      if (reducedMotion.matches) animation.pause();
      else if (animation.play) animation.play();
    });
  });
  window.MESMotionEmbed = Object.freeze({ init, mount, safeAssetUrl });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
