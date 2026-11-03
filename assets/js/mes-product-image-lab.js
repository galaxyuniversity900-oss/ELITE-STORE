/* MES Product Image Lab — applies the existing WebGL material shader to real catalogue images. */
(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s);
const section=$('#advanced-extension-section');
if(!section)return;
const presets=[
{id:'fabric',label:'نسيج القماش',opts:{material:'fabric',amplitude:.006,frequency:6,speed:1,grainAmp:.0008,grainFreq:56,lensEnabled:false,mouseStrength:.018}},
{id:'silk',label:'حرير وانسياب',opts:{material:'fabric',amplitude:.003,frequency:9,speed:1.35,grainAmp:.00025,grainFreq:72,lensEnabled:false,mouseStrength:.012}},
{id:'denim',label:'دينيم محبب',opts:{material:'fabric',amplitude:.0025,frequency:13,speed:.7,grainAmp:.0018,grainFreq:110,lensEnabled:false,mouseStrength:.008}},
{id:'leather',label:'جلد وإضاءة',opts:{material:'leather',amplitude:.002,frequency:5,speed:.55,grainAmp:.0003,grainFreq:90,lensEnabled:false,mouseStrength:.006}},
{id:'mesh',label:'شبك رياضي',opts:{material:'mesh',amplitude:.009,frequency:15,speed:1.2,grainAmp:.0015,grainFreq:120,lensEnabled:false,mouseStrength:.02}},
{id:'ripple',label:'تموج تفاعلي',opts:{material:'fabric',amplitude:.009,frequency:8,speed:1.4,grainAmp:.0006,grainFreq:65,lensEnabled:true,lensFollowMouse:true,lensRadius:.32,lensStrength:.02,lensSwirl:1.2,mouseStrength:.025}},
{id:'lens',label:'عدسة الجاذبية',opts:{material:'fabric',amplitude:.001,frequency:4,speed:.45,grainAmp:0,grainFreq:50,lensEnabled:true,lensFollowMouse:true,lensRadius:.42,lensStrength:.045,lensSwirl:2.2,mouseStrength:.01}},
{id:'weave',label:'نسيج متقاطع',opts:{material:'mesh',amplitude:.005,frequency:24,speed:.85,grainAmp:.002,grainFreq:150,lensEnabled:false,mouseStrength:.01}},
{id:'wind',label:'حركة الرياح',opts:{material:'fabric',amplitude:.012,frequency:4,speed:1.7,grainAmp:.0004,grainFreq:48,lensEnabled:false,mouseStrength:.03}},
{id:'softlight',label:'إضاءة ناعمة',opts:{material:'leather',amplitude:.001,frequency:3,speed:.35,grainAmp:.0002,grainFreq:80,lensEnabled:false,mouseStrength:.003}},
{id:'micro',label:'تفاصيل دقيقة',opts:{material:'fabric',amplitude:.0018,frequency:32,speed:.65,grainAmp:.0014,grainFreq:180,lensEnabled:false,mouseStrength:.005}},
{id:'motion',label:'حركة ديناميكية',opts:{material:'fabric',amplitude:.014,frequency:7,speed:2,grainAmp:.0009,grainFreq:80,lensEnabled:true,lensFollowMouse:true,lensRadius:.28,lensStrength:.025,lensSwirl:1.4,mouseStrength:.03}}
];
const panel=document.createElement('div');
panel.id='mes-real-image-lab';
panel.className='mt-6 rounded-2xl border border-[#d4af37]/40 bg-[#0b0b0f] p-4 space-y-3';
panel.innerHTML='<div class="flex flex-wrap items-center justify-between gap-2"><div><strong class="text-sm text-[#f5ebe0]">تطبيق التأثير على صورة المنتج الفعلية</strong><p class="text-xs text-zinc-400 mt-1">اختر قطعة من الكتالوج ثم طبّق Shader مباشرة على بكسلات صورتها.</p></div><span id="mes-real-image-status" class="text-xs text-[#d4af37]" role="status" aria-live="polite">بانتظار اختيار المنتج</span></div><div class="flex flex-wrap gap-2"><select id="mes-real-image-product" class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white min-w-[190px]" aria-label="اختر المنتج"></select><button type="button" id="mes-real-image-reset" class="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">إيقاف التأثير</button></div><div id="mes-real-image-effects" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"></div><p class="text-[10px] text-zinc-500">التأثيرات لا تغيّر ملف الصورة الأصلي أو بيانات المنتج. عند عدم وجود صورة حقيقية في الكتالوج، سيظهر تنبيه بدل تطبيق التأثير على رسم بديل.</p>';
const grid=section.querySelector('.grid');
if(grid)grid.insertAdjacentElement('afterend',panel);else section.append(panel);
const select=$('#mes-real-image-product',panel),status=$('#mes-real-image-status',panel),buttons=$('#mes-real-image-effects',panel);
let active=null,activeImage=null;
function say(t){status.textContent=t;}
function products(){return [...document.querySelectorAll('#products-grid .product-card[data-id]')];}
function refreshOptions(){
 const cards=products(),old=select.value;
 select.innerHTML='<option value="">اختر منتجاً من الـ 22</option>'+cards.map(c=>{const id=c.dataset.id,title=c.querySelector('h3')?.textContent?.trim()||id;return '<option value="'+id.replace(/[^a-z0-9_-]/gi,'')+'">'+title.replace(/[&<>"]/g,'')+'</option>';}).join('');
 if(cards.some(c=>c.dataset.id===old))select.value=old;
}
function selectedImage(){
 const id=select.value;if(!id)return null;
 const visual=$('#prod-visual-'+CSS.escape(id));
 return visual?.querySelector('img:not([data-fabric-ripple-canvas])')||null;
}
function stop(){
 if(activeImage){const mounted=window.MESFabricRipple?.instances?.get(activeImage);mounted?.destroy();activeImage.style.visibility='visible';}
 active=null;activeImage=null;
 const canvas=$('#products-grid .product-card[data-id="'+CSS.escape(select.value)+'"] [data-fabric-ripple-canvas]');
 if(canvas)canvas.remove();
 say('تم إيقاف التأثير');
}
function apply(preset){
 const img=selectedImage();
 if(!img){say('هذا المنتج لا يحتوي حالياً على صورة فعلية. أضف صورة إلى data/products.json أولاً.');return;}
 if(!window.FabricRippleEffect){say('محرك WebGL غير متاح في هذا المتصفح.');return;}
 if(activeImage&&activeImage!==img){window.MESFabricRipple?.instances?.get(activeImage)?.destroy();activeImage.style.visibility='visible';}
 const old=window.MESFabricRipple?.instances?.get(img);old?.destroy();
 try{
  const effect=new window.FabricRippleEffect(img,preset.opts);
  active={preset,effect};activeImage=img;
  say('مُفعّل على الصورة الحقيقية: '+preset.label);
 }catch(e){say('تعذر تشغيل التأثير: '+(e.message||'WebGL'));}
}
presets.forEach(p=>{
 const b=document.createElement('button');b.type='button';b.className='rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 hover:border-[#d4af37] hover:text-[#f5ebe0]';b.textContent=p.label;b.addEventListener('click',()=>apply(p));buttons.append(b);
});
select.addEventListener('change',()=>{if(active)stop();say(select.value?'تم اختيار المنتج. اختر تأثيراً.':'بانتظار اختيار المنتج');});
$('#mes-real-image-reset',panel).addEventListener('click',stop);
const observer=new MutationObserver(refreshOptions);observer.observe($('#products-grid')||document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshOptions,{once:true});else refreshOptions();
document.addEventListener('mes:catalog-rendered',refreshOptions);
window.MESRealImageLab={apply,stop,refresh:refreshOptions,presets};
})();