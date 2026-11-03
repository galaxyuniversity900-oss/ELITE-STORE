/* MES Product Image Lab — WebGL effects for verified catalogue media and clearly labelled SVG illustrations. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const section = $('#advanced-extension-section');
  if (!section || $('#mes-real-image-lab')) return;

  const presets = [
    { id: 'fabric', label: 'نسيج القماش', opts: { material: 'fabric', amplitude: .006, frequency: 6, speed: 1, grainAmp: .0008, grainFreq: 56, lensEnabled: false, mouseStrength: .018 } },
    { id: 'silk', label: 'حرير وانسياب', opts: { material: 'fabric', amplitude: .003, frequency: 9, speed: 1.35, grainAmp: .00025, grainFreq: 72, lensEnabled: false, mouseStrength: .012 } },
    { id: 'denim', label: 'دينيم محبب', opts: { material: 'fabric', amplitude: .0025, frequency: 13, speed: .7, grainAmp: .0018, grainFreq: 110, lensEnabled: false, mouseStrength: .008 } },
    { id: 'leather', label: 'جلد وإضاءة', opts: { material: 'leather', amplitude: .002, frequency: 5, speed: .55, grainAmp: .0003, grainFreq: 90, lensEnabled: false, mouseStrength: .006 } },
    { id: 'mesh', label: 'شبك رياضي', opts: { material: 'mesh', amplitude: .009, frequency: 15, speed: 1.2, grainAmp: .0015, grainFreq: 120, lensEnabled: false, mouseStrength: .02 } },
    { id: 'ripple', label: 'تموج تفاعلي', opts: { material: 'fabric', amplitude: .009, frequency: 8, speed: 1.4, grainAmp: .0006, grainFreq: 65, lensEnabled: true, lensFollowMouse: true, lensRadius: .32, lensStrength: .02, lensSwirl: 1.2, mouseStrength: .025 } },
    { id: 'lens', label: 'عدسة الجاذبية', opts: { material: 'fabric', amplitude: .001, frequency: 4, speed: .45, grainAmp: 0, grainFreq: 50, lensEnabled: true, lensFollowMouse: true, lensRadius: .42, lensStrength: .045, lensSwirl: 2.2, mouseStrength: .01 } },
    { id: 'weave', label: 'نسيج متقاطع', opts: { material: 'mesh', amplitude: .005, frequency: 24, speed: .85, grainAmp: .002, grainFreq: 150, lensEnabled: false, mouseStrength: .01 } },
    { id: 'wind', label: 'حركة الرياح', opts: { material: 'fabric', amplitude: .012, frequency: 4, speed: 1.7, grainAmp: .0004, grainFreq: 48, lensEnabled: false, mouseStrength: .03 } },
    { id: 'softlight', label: 'إضاءة ناعمة', opts: { material: 'leather', amplitude: .001, frequency: 3, speed: .35, grainAmp: .0002, grainFreq: 80, lensEnabled: false, mouseStrength: .003 } },
    { id: 'micro', label: 'تفاصيل دقيقة', opts: { material: 'fabric', amplitude: .0018, frequency: 32, speed: .65, grainAmp: .0014, grainFreq: 180, lensEnabled: false, mouseStrength: .005 } },
    { id: 'motion', label: 'حركة ديناميكية', opts: { material: 'fabric', amplitude: .014, frequency: 7, speed: 2, grainAmp: .0009, grainFreq: 80, lensEnabled: true, lensFollowMouse: true, lensRadius: .28, lensStrength: .025, lensSwirl: 1.4, mouseStrength: .03 } }
  ];

  const panel = document.createElement('div');
  panel.id = 'mes-real-image-lab';
  panel.className = 'mt-6 rounded-2xl border border-[#d4af37]/40 bg-[#0b0b0f] p-4 space-y-3';
  panel.innerHTML = '<div class="flex flex-wrap items-center justify-between gap-2"><div><strong class="text-sm text-[#f5ebe0]">مختبر خامات صور ورسومات المنتجات</strong><p class="text-xs text-zinc-400 mt-1">يطبّق WebGL على صورة المنتج، أو على رسم SVG توضيحي عند غياب الصورة الفوتوغرافية.</p></div><span id="mes-real-image-status" class="text-xs text-[#d4af37]" role="status" aria-live="polite">بانتظار اختيار المنتج</span></div><div class="flex flex-wrap gap-2"><select id="mes-real-image-product" class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white min-w-[190px]" aria-label="اختر المنتج"></select><button type="button" id="mes-real-image-reset" class="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">إيقاف التأثير</button></div><div id="mes-real-image-effects" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"></div><p class="text-[10px] text-zinc-500">الرسم التوضيحي ليس صورة مخزون أو تصويراً حقيقياً للقطعة. عند إضافة media.cover أو media.images سيُفضّل المختبر الصورة الفعلية تلقائياً.</p>';

  const grid = section.querySelector('.grid');
  if (grid) grid.insertAdjacentElement('afterend', panel);
  else section.append(panel);

  const select = $('#mes-real-image-product', panel);
  const status = $('#mes-real-image-status', panel);
  const buttons = $('#mes-real-image-effects', panel);
  let activeEffect = null;
  let activeImage = null;
  let sourceNode = null;
  let overlayNode = null;
  let labelNode = null;
  let objectUrl = '';

  function say(message) { status.textContent = message; }

  function productCards() {
    return [...document.querySelectorAll('#products-grid .product-card[data-id]')];
  }

  function refreshOptions() {
    const cards = productCards();
    const previous = select.value;
    select.replaceChildren(new Option('اختر منتجاً من الكتالوج', ''));
    cards.forEach(card => {
      const id = card.dataset.id || '';
      const title = card.querySelector('h3')?.textContent?.trim() || id;
      select.add(new Option(title, id));
    });
    if (cards.some(card => card.dataset.id === previous)) select.value = previous;
    if (activeImage && !activeImage.isConnected) {
      stopEffect();
      say('تم إيقاف التأثير بعد تحديث بطاقة المنتج.');
    }
  }

  function selectedVisual() {
    return select.value ? document.getElementById('prod-visual-' + select.value) : null;
  }

  function makeIllustrationImage(svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.querySelectorAll('script,foreignObject').forEach(node => node.remove());
    clone.querySelectorAll('*').forEach(node => {
      [...node.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith('on') || ((name === 'href' || name.endsWith(':href')) && !value.startsWith('#'))) {
          node.removeAttribute(attr.name);
        }
      });
    });
    const markup = new XMLSerializer().serializeToString(clone);
    objectUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.alt = 'رسم توضيحي للمنتج — ليس صورة مخزون';
    img.dataset.mesGeneratedIllustration = 'true';
    img.decoding = 'async';
    img.className = 'absolute inset-0 z-[8] h-full w-full object-contain pointer-events-none';
    img.src = objectUrl;
    const visual = selectedVisual();
    sourceNode = svg;
    sourceNode.style.visibility = 'hidden';
    overlayNode = img;
    visual.append(img);
    labelNode = document.createElement('span');
    labelNode.textContent = 'رسم توضيحي';
    labelNode.className = 'absolute top-2 right-2 z-[12] rounded-md bg-black/75 px-2 py-1 text-[9px] text-[#f5ebe0] pointer-events-none';
    visual.append(labelNode);
    return img;
  }

  function selectedTarget() {
    const visual = selectedVisual();
    if (!visual) return null;
    const photo = visual.querySelector('img:not([data-fabric-ripple-canvas]):not([data-mes-generated-illustration])');
    if (photo) return { image: photo, kind: 'photo' };
    const svg = visual.querySelector('svg');
    if (svg) return { image: makeIllustrationImage(svg), kind: 'illustration' };
    return null;
  }

  function stopEffect() {
    if (activeEffect) activeEffect.destroy();
    else if (activeImage) window.MESFabricRipple?.instances?.get(activeImage)?.destroy();
    if (activeImage) {
      activeImage.style.visibility = '';
      activeImage.classList.remove('mes-fabric-fallback');
    }
    if (overlayNode) overlayNode.remove();
    if (labelNode) labelNode.remove();
    if (sourceNode) sourceNode.style.visibility = '';
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    activeEffect = null;
    activeImage = null;
    sourceNode = null;
    overlayNode = null;
    labelNode = null;
    objectUrl = '';
  }

  async function apply(preset) {
    stopEffect();
    const target = selectedTarget();
    if (!target) {
      say('المنتج المحدد لا يحتوي صورة أو رسماً قابلاً للمعالجة.');
      return;
    }
    const img = target.image;
    if (!window.FabricRippleEffect) {
      stopEffect();
      say('محرك WebGL غير متاح في هذه الصفحة.');
      return;
    }
    if (!img.complete || !img.naturalWidth) {
      say('جاري تجهيز مادة العرض...');
      try {
        if (typeof img.decode === 'function') await img.decode();
        else await new Promise((resolve, reject) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', reject, { once: true });
        });
      } catch {
        stopEffect();
        say('تعذر تجهيز صورة أو رسم المنتج.');
        return;
      }
    }
    if (!img.isConnected || !img.naturalWidth || !img.getBoundingClientRect().width) {
      stopEffect();
      say('مادة العرض غير جاهزة. أعد فتح المنتج ثم حاول مجدداً.');
      return;
    }

    try {
      const effect = new window.FabricRippleEffect(img, preset.opts);
      if (!effect.gl || !effect.canvas || img.dataset.fabricRippleActive !== 'true') {
        effect.destroy();
        stopEffect();
        say('تعذر بدء WebGL على مادة العرض. تحقق من دعم WebGL في المتصفح.');
        return;
      }
      activeEffect = effect;
      activeImage = img;
      say((target.kind === 'photo' ? 'WebGL فعّال على صورة المنتج: ' : 'WebGL فعّال على رسم توضيحي (ليس صورة مخزون): ') + preset.label);
    } catch (error) {
      stopEffect();
      say('تعذر تشغيل التأثير: ' + (error?.message || 'خطأ WebGL غير معروف'));
    }
  }

  presets.forEach(preset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 hover:border-[#d4af37] hover:text-[#f5ebe0]';
    button.textContent = preset.label;
    button.addEventListener('click', () => apply(preset));
    buttons.append(button);
  });

  select.addEventListener('change', () => {
    stopEffect();
    say(select.value ? 'تم اختيار المنتج. اختر تأثيراً.' : 'بانتظار اختيار المنتج');
  });
  $('#mes-real-image-reset', panel).addEventListener('click', () => {
    stopEffect();
    say('تم إيقاف التأثير وإعادة العرض الأصلي.');
  });

  const productsGrid = $('#products-grid');
  const observer = new MutationObserver(refreshOptions);
  observer.observe(productsGrid || document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshOptions, { once: true });
  } else {
    refreshOptions();
  }
  document.addEventListener('mes:catalog-rendered', refreshOptions);
  window.MESRealImageLab = { apply, stop: stopEffect, refresh: refreshOptions, presets };
})();
