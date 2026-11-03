/* MES Store Orchestrator — lifecycle and progressive enhancement */
(()=>{'use strict';
const SELECTOR='img[data-fabric-ripple],img[data-product-image]';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const hover=matchMedia('(hover: hover) and (pointer: fine)');
const state={started:false,observer:null,mediaHandler:null,refresh:null,destroy:null};
const $=(s,r=document)=>r.querySelector(s);
function materialFor(img){const raw=(img.dataset.material||img.closest('[data-material]')?.dataset.material||'fabric').toLowerCase();return ['leather','mesh','fabric'].includes(raw)?raw:'fabric';}
function prepareImage(img){
 if(img.dataset.mesOrchestrated==='1')return;
 img.dataset.mesOrchestrated='1';
 if(img.hasAttribute('data-product-image')&&!img.hasAttribute('data-fabric-ripple'))img.setAttribute('data-fabric-ripple','on');
 if(!img.dataset.material)img.dataset.material=materialFor(img);
 if(img.loading!=='eager'&&!img.hasAttribute('fetchpriority'))img.loading='lazy';
 const card=img.closest('.product-card,.product-thumb');
 if(card){
   card.dataset.mesProductCard='1';
   const stock=Number(card.dataset.stock??img.dataset.stock);
   if(Number.isFinite(stock)&&stock>=0&&stock<=3&&!card.querySelector('.mes-low-stock')){
     const badge=document.createElement('span');badge.className='mes-low-stock';badge.textContent=stock===0?'نفد المخزون':'متبقي '+stock+' فقط';badge.setAttribute('aria-live','polite');card.append(badge);
     if(stock===0)badge.classList.add('is-sold-out');
   }
   const rating=Number(card.dataset.rating??img.dataset.rating);
   if(Number.isFinite(rating)&&rating>0&&rating<=5&&!card.querySelector('.mes-card-rating')){
     const ratingEl=document.createElement('span');ratingEl.className='mes-card-rating';ratingEl.setAttribute('aria-label','التقييم '+rating+' من 5');
     const fill=document.createElement('span');fill.className='mes-card-rating-fill';fill.textContent='★★★★★';fill.style.setProperty('--rating',String(rating/5*100)+'%');ratingEl.append(fill);card.append(ratingEl);
     if(!reduced.matches&&'IntersectionObserver'in window){const io=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){ratingEl.classList.add('is-visible');io.disconnect();}},{threshold:.4});io.observe(ratingEl);}else ratingEl.classList.add('is-visible');
   }
 }
}
function refresh(root=document){
 const images=[];
 if(root instanceof HTMLImageElement&&root.matches(SELECTOR))images.push(root);
 root.querySelectorAll?.(SELECTOR).forEach(img=>images.push(img));
 images.forEach(prepareImage);
 window.MESFabricRipple?.scan(root);
 return images.length;
}
function onMotionChange(){document.documentElement.classList.toggle('mes-reduced-motion',reduced.matches);}
function init(){
 if(state.started)return window.MESStore;
 state.started=true;onMotionChange();
 state.mediaHandler=onMotionChange;
 reduced.addEventListener?.('change',state.mediaHandler);
 refresh(document);
 if('MutationObserver'in window){
   state.observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
     if(node.nodeType===1)refresh(node);
   })));
   state.observer.observe(document.documentElement,{childList:true,subtree:true});
 }
 document.addEventListener('mes:catalog-rendered',e=>refresh(e.detail?.root||document));
 document.addEventListener('mes:product-image-ready',e=>{if(e.detail?.image instanceof HTMLImageElement)prepareImage(e.detail.image);});
 const api={
   refresh,
   openQuickView(card){if(card&&typeof window.openProductQuickView==='function')window.openProductQuickView(card,card.querySelector('img')?.dataset.fullImage||'',card.dataset.material||'fabric');},
   get reducedMotion(){return reduced.matches;},
   destroy(){state.observer?.disconnect();reduced.removeEventListener?.('change',state.mediaHandler);state.started=false;delete window.MESStore;}
 };
 state.destroy=api.destroy;state.refresh=refresh;
 window.MESStore=api;
 document.dispatchEvent(new CustomEvent('mes:orchestrator-ready',{detail:{version:'1.0.0'}}));
 return api;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
