import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type ProductImage = { url: string; alt?: string | null; isPrimary?: boolean };
type Product = {
  id: string;
  name: string;
  sku?: string;
  slug: string;
  description?: string | null;
  price: string | number;
  compareAtPrice?: string | number | null;
  currency?: string;
  images?: ProductImage[];
  category?: { name?: string; slug?: string } | null;
};

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api';
const siteUrl = process.env.NEXT_PUBLIC_WEB_URL?.replace(/\/+$/, '');

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const response = await fetch(apiUrl + '/products/' + encodeURIComponent(slug), {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('slug' in value)) return null;
    return value as Product;
  } catch {
    return null;
  }
}

function primaryImage(product: Product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.find((image) => image.isPrimary && image.url) ?? images.find((image) => image.url);
}

function absoluteImage(url?: string) {
  if (!url) return undefined;
  try { return siteUrl ? new URL(url, siteUrl).toString() : undefined; }
  catch { return undefined; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'المنتج غير متاح | MES STORE', robots: { index: false, follow: false } };
  const description = (product.description || 'اكتشف تفاصيل المنتج من MES STORE.').replace(/\s+/g, ' ').slice(0, 155);
  const canonical = siteUrl ? siteUrl + '/products/' + encodeURIComponent(product.slug) : undefined;
  const image = absoluteImage(primaryImage(product)?.url);
  return {
    title: product.name + ' | MES STORE',
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: 'website',
      title: product.name + ' | MES STORE',
      description,
      ...(canonical ? { url: canonical } : {}),
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name + ' | MES STORE',
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function formatPrice(value: string | number, currency = 'EGP') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'السعر عند الطلب';
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const image = primaryImage(product);
  const imageUrl = absoluteImage(image?.url);
  const amount = Number(product.price);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    sku: product.sku || undefined,
    image: imageUrl ? [imageUrl] : undefined,
    brand: { '@type': 'Brand', name: 'MES STORE' },
    category: product.category?.name || undefined,
    ...(Number.isFinite(amount) && amount > 0 ? {
      offers: {
        '@type': 'Offer',
        price: amount.toFixed(2),
        priceCurrency: product.currency || 'EGP',
        url: siteUrl ? siteUrl + '/products/' + encodeURIComponent(product.slug) : undefined,
      },
    } : {}),
  };
  const jsonLd = JSON.stringify(structuredData).replace(/</g, '\\u003c');

  return (
    <main className="product-detail-page" dir="rtl">
      <header className="product-detail-header">
        <a href="/">MES STORE</a>
        <nav aria-label="التنقل"><a href="/#latest">المجموعة</a><a href="/account">حسابي</a><a href="/track">تتبع الطلب</a></nav>
      </header>
      <nav className="product-breadcrumb" aria-label="مسار التنقل">
        <a href="/">الرئيسية</a><span aria-hidden="true">/</span>
        {product.category?.name && <><span>{product.category.name}</span><span aria-hidden="true">/</span></>}
        <span aria-current="page">{product.name}</span>
      </nav>
      <article className="product-detail">
        <div className="product-detail-media">
          {image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt={image.alt || product.name} />
          ) : (
            <div className="image-placeholder" role="img" aria-label="صورة المنتج غير متاحة">
              <span>MES</span><small>الصورة غير متاحة حالياً</small>
            </div>
          )}
        </div>
        <div className="product-detail-copy">
          <p className="eyebrow">MES STORE / MEN'S COLLECTION</p>
          {product.category?.name && <p className="product-detail-category">{product.category.name}</p>}
          <h1>{product.name}</h1>
          {product.sku && <p className="product-detail-sku">SKU: {product.sku}</p>}
          <p className="product-detail-price">{formatPrice(product.price, product.currency || 'EGP')}</p>
          {product.description && <p className="product-detail-description">{product.description}</p>}
          <p className="product-detail-note">لإتمام الطلب والاستفسار عن المقاسات والتوفر، انتقل إلى المتجر أو تواصل مع خدمة العملاء.</p>
          <div className="product-detail-actions">
            <a className="cta" href={process.env.NEXT_PUBLIC_STOREFRONT_URL || 'https://galaxyuniversity900-oss.github.io/ELITE-STORE/ELITE.html'}>اطلب من المتجر</a>
            <a className="text-link" href="/">العودة للمجموعة</a>
          </div>
        </div>
      </article>
      <footer className="product-detail-footer">MES STORE · MEN'S COLLECTION</footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </main>
  );
}
