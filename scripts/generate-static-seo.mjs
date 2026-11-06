import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const args = process.argv;
const output = path.resolve(args[args.indexOf('--output') + 1] || '_site');
const urlIndex = args.indexOf('--site-url');
const site = (urlIndex >= 0 ? args[urlIndex + 1] : '') || process.env.MES_SITE_URL || 'https://galaxyuniversity900-oss.github.io/ELITE-STORE';
const base = new URL(site.endsWith('/') ? site : site + '/');
const absolute = (value) => new URL(value, base).href;
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
const slug = (value, id) => {
  const name = String(value).normalize('NFKC').toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '').slice(0, 70);
  return (name || 'product') + '-' + String(id).toLowerCase().replace(/[^a-z0-9-]/g, '');
};
const data = JSON.parse(await readFile(path.join(root, 'data/products.json'), 'utf8'));
const contact = JSON.parse(await readFile(path.join(root, 'data/contact.json'), 'utf8'));
if (!Array.isArray(data.products)) throw new Error('products.json has no products array');
const whatsappNumber = String(contact.whatsapp_number || '').replace(/\D/g, '');
const validWhatsApp = /^\d{8,15}$/.test(whatsappNumber);
const publicPhone = String(contact.phone || '').trim();
const products = data.products.filter((p) => p && p.active !== false && p.id && p.title);
const seen = new Set();
const entries = products.map((p) => {
  const key = slug(p.title, p.id);
  if (seen.has(key)) throw new Error('Duplicate product slug: ' + key);
  seen.add(key);
  const url = absolute('products/' + key + '/');
  const imageCandidates = p.media ? [p.media.cover, ...(Array.isArray(p.media.images) ? p.media.images : [])] : [];
  const rawImage = imageCandidates.map((candidate) => typeof candidate === 'string' ? candidate : candidate && candidate.url).find((value) => typeof value === 'string' && value.trim());
  let image = '';
  if (rawImage) { try { const parsed = new URL(rawImage, base); if (parsed.protocol === 'https:' || parsed.protocol === 'http:') image = parsed.href; } catch {} }
  const price = Number(p.price);
  return { product:p, key, url, image, price, hasPrice:!p.priceNote && Number.isFinite(price) && price > 0 };
});
const listingUrl = absolute('ELITE.html');
const homeUrl = base.href;
const listingSchema = {
  '@context':'https://schema.org', '@type':'CollectionPage', name:"MES STORE Men's Collection",
  description:'تسوّق مجموعة MES STORE من الملابس الرجالي.', inLanguage:'ar-EG', url:listingUrl,
  mainEntity:{'@type':'ItemList',itemListOrder:'https://schema.org/ItemListOrderAscending',numberOfItems:entries.length,
    itemListElement:entries.map((e,i)=>({'@type':'ListItem',position:i+1,url:e.url,item:{'@type':'Product',name:e.product.title,url:e.url}}))}
};
function meta(html, name, content, attr) {
  if (!content) return html;
  attr = attr || 'name';
  const re = new RegExp('<meta\\s+' + attr + '=["\\x27]' + name + '["\\x27][^>]*>', 'i');
  const tag = '<meta ' + attr + '="' + esc(name) + '" content="' + esc(content) + '">';
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', '  ' + tag + '\n</head>');
}
function canonical(html, href) {
  const tag = '<link rel="canonical" href="' + esc(href) + '">';
  return /<link\s+rel=["']canonical["'][^>]*>/i.test(html) ? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag) : html.replace('</head>', '  ' + tag + '\n</head>');
}
function structured(html, value) {
  const tag = '<script type="application/ld+json" data-mes-seo="true">' + json(value) + '</script>';
  html = html.replace(/<script\s+type=["']application\/ld\+json["']\s+data-mes-seo=["']true["'][\s\S]*?<\/script>/i, '');
  return html.replace('</head>', '  ' + tag + '\n</head>');
}
function metadata(html, title, description, href, image) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(title) + '</title>');
  html = meta(html,'description',description);
  html = meta(html,'robots','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  html = meta(html,'og:type','website','property');
  html = meta(html,'og:site_name','MES STORE','property');
  html = meta(html,'og:locale','ar_EG','property');
  html = meta(html,'og:title',title,'property');
  html = meta(html,'og:description',description,'property');
  html = meta(html,'og:url',href,'property');
  html = meta(html,'og:image',image,'property');
  html = meta(html,'twitter:card',image ? 'summary_large_image' : 'summary');
  html = meta(html,'twitter:title',title);
  html = meta(html,'twitter:description',description);
  if (image) html = meta(html,'twitter:image',image);
  return canonical(html,href);
}
await mkdir(output,{recursive:true});
for (const file of ['index.html','ELITE.html']) {
  try { await readFile(path.join(output,file),'utf8'); }
  catch { await copyFile(path.join(root,file),path.join(output,file)); }
}
const listingPath = path.join(output,'ELITE.html');
let listing = await readFile(listingPath,'utf8');
listing = metadata(listing,"MES STORE | ملابس رجالي — Men's Collection",'اكتشف مجموعة MES STORE من الجواكت والهوديز والبناطيل الرجالي. تصفّح المنتجات والأسعار واطلب بسهولة.',listingUrl,entries.find((e)=>e.image)?.image || '');
listing = structured(listing,listingSchema);
await writeFile(listingPath,listing,'utf8');

for (const entry of entries) {
  const p = entry.product;
  const title = p.title + ' | MES STORE';
  const description = String(p.desc || ('تعرّف على ' + p.title + ' من مجموعة MES STORE للملابس الرجالي.')).slice(0,300);
  const offer = entry.hasPrice ? {'@type':'Offer',url:entry.url,priceCurrency:data.currency || 'EGP',price:entry.price.toFixed(2),seller:{'@type':'Organization',name:'MES STORE'}} : undefined;
  const productSchema = {'@context':'https://schema.org','@type':'Product',name:p.title,description:description,sku:String(p.id),category:p.category || undefined,brand:{'@type':'Brand',name:'MES STORE'},image:entry.image ? [entry.image] : undefined,url:entry.url,offers:offer};
  Object.keys(productSchema).forEach((key)=>productSchema[key] === undefined && delete productSchema[key]);
  const breadcrumb = {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
    {'@type':'ListItem',position:1,name:'الرئيسية',item:homeUrl},
    {'@type':'ListItem',position:2,name:'المجموعة',item:listingUrl},
    {'@type':'ListItem',position:3,name:p.title,item:entry.url}
  ]};
  const media = entry.image
    ? '<img class="photo" src="' + esc(entry.image) + '" alt="' + esc(p.title) + '" fetchpriority="high">'
    : '<div class="visual" role="img" aria-label="' + esc(p.title) + '"><span>MES</span><small>' + esc(p.category || "MEN'S COLLECTION") + '</small></div>';
  const price = entry.hasPrice
    ? new Intl.NumberFormat('ar-EG',{style:'currency',currency:data.currency || 'EGP',maximumFractionDigits:0}).format(entry.price)
    : 'السعر وتفاصيل الطلب عبر واتساب';
  const whatsapp = validWhatsApp ? 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent('مرحباً MES STORE، أريد الاستفسار عن ' + p.title + ' (' + p.id + ').') : listingUrl;
  const page = [
    '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="' + esc(entry.url) + '">',
    '<meta property="og:type" content="product"><meta property="og:site_name" content="MES STORE"><meta property="og:locale" content="ar_EG">',
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(description) + '"><meta property="og:url" content="' + esc(entry.url) + '">',
    entry.image ? '<meta property="og:image" content="' + esc(entry.image) + '"><meta name="twitter:image" content="' + esc(entry.image) + '">' : '',
    '<meta name="twitter:card" content="' + (entry.image ? 'summary_large_image' : 'summary') + '">',
    '<script type="application/ld+json">' + json(productSchema) + '</script><script type="application/ld+json">' + json(breadcrumb) + '</script>',
    '<style>:root{color-scheme:dark;--bg:#090909;--panel:#14120f;--gold:#d8c39a;--muted:#aaa195;--line:rgba(216,195,154,.2)}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#f1ede5;font-family:Arial,sans-serif}a{color:inherit;text-decoration:none}.wrap{width:min(1080px,calc(100% - 36px));margin:auto}header{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font-family:Georgia,serif;color:var(--gold);letter-spacing:.2em;font-size:20px}header a:last-child,.button{border:1px solid var(--line);padding:12px 16px;color:var(--gold);font-size:13px}main{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(26px,6vw,76px);align-items:center;padding:64px 0}.media{min-height:400px;background:var(--panel);border:1px solid var(--line);display:grid;place-items:center;overflow:hidden}.photo{width:100%;height:100%;max-height:620px;object-fit:cover}.visual{display:grid;place-items:center;gap:12px;color:var(--gold);font:clamp(90px,16vw,160px) Georgia,serif}.visual small{font:11px Arial,sans-serif;letter-spacing:.25em;color:var(--muted)}.kicker{color:var(--gold);font-size:11px;letter-spacing:.2em}h1{font:500 clamp(38px,6vw,66px)/1.12 Georgia,serif;margin:16px 0}.description{color:var(--muted);line-height:2;font-size:15px}.price{color:var(--gold);font-size:22px;font-weight:700;margin:28px 0}.actions{display:flex;gap:12px;flex-wrap:wrap}.button.primary{background:var(--gold);color:#17140f;border-color:var(--gold);font-weight:700}.back{display:inline-block;margin-top:30px;color:var(--muted);font-size:13px}footer{padding:24px 0;border-top:1px solid var(--line);color:var(--muted);font-size:11px}@media(max-width:700px){main{grid-template-columns:1fr;padding:32px 0}.media{min-height:300px}.photo{max-height:460px}}</style>',
    '</head><body><div class="wrap"><header><a class="brand" href="' + esc(homeUrl) + '">MES STORE</a><a href="' + esc(listingUrl) + '">كل المنتجات</a></header>',
    '<main><div class="media">' + media + '</div><section><p class="kicker">' + esc(p.category || "MEN'S COLLECTION") + ' · MES STORE</p>',
    '<h1>' + esc(p.title) + '</h1><p class="description">' + esc(description) + '</p><p class="price">' + esc(price) + '</p>',
    '<div class="actions"><a class="button primary" href="' + esc(whatsapp) + '" rel="noopener noreferrer">استفسر واطلب عبر واتساب</a><a class="button" href="' + esc(listingUrl) + '">العودة للمجموعة</a></div>',
    '<a class="back" href="' + esc(listingUrl) + '">← العودة إلى متجر MES STORE</a></section></main><footer>MES STORE · MEN\'S COLLECTION</footer></div></body></html>'
  ].join('\n');
  const target = path.join(output,'products',entry.key,'index.html');
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,page,'utf8');
}

const indexPath = path.join(output,'index.html');
let index = await readFile(indexPath,'utf8');
index = metadata(index,'MES STORE | المتجر الرسمي للملابس الرجالي','المتجر الرسمي لـ MES STORE. اكتشف مجموعة الملابس الرجالي وتصفح أحدث القطع.',homeUrl,'');
if (validWhatsApp) index = index.replace(/https:\/\/wa\.me\/\d+/g, 'https://wa.me/' + whatsappNumber);
const organizationSchema = {'@context':'https://schema.org','@type':'Organization',name:contact.store_name || 'MES STORE',url:homeUrl};
if (publicPhone) organizationSchema.contactPoint = {'@type':'ContactPoint',telephone:publicPhone,contactType:'customer service',availableLanguage:['Arabic']};
index = structured(index,organizationSchema);
await writeFile(indexPath,index,'utf8');

const sitemapUrls = [{url:homeUrl,priority:'1.0',freq:'weekly'},{url:listingUrl,priority:'0.9',freq:'daily'}].concat(entries.map((e)=>({url:e.url,priority:'0.8',freq:'weekly'})));
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapUrls.map((entry)=>'  <url><loc>'+esc(entry.url)+'</loc><changefreq>'+entry.freq+'</changefreq><priority>'+entry.priority+'</priority></url>').join('\n') +
  '\n</urlset>\n';
await writeFile(path.join(output,'sitemap.xml'),sitemap,'utf8');
await writeFile(path.join(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /data/\nDisallow: /api/\nDisallow: /*?gm-admin=1\nSitemap: '+absolute('sitemap.xml')+'\n','utf8');
console.log('Generated '+entries.length+' canonical Product pages and '+sitemapUrls.length+' sitemap URLs at '+base.href);
