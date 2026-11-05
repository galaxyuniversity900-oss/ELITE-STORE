export const dynamic = 'force-dynamic';

const storefrontUrl =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ??
  'https://galaxyuniversity900-oss.github.io/ELITE-STORE/ELITE.html';
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api';

type ProductImage = { url: string; alt?: string | null; isPrimary?: boolean };
type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string | number;
  compareAtPrice?: string | number | null;
  currency?: string;
  images?: ProductImage[];
  category?: { name?: string; slug?: string } | null;
};

async function getProducts(): Promise<Product[]> {
  try {
    const response = await fetch(`${apiUrl}/products?page=1&limit=8`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) return [];
    return data.items as Product[];
  } catch {
    return [];
  }
}

function formatPrice(value: string | number, currency = 'EGP') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'السعر عند الطلب';
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function productImage(product: Product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.find((image) => image.isPrimary && image.url) ?? images.find((image) => image.url);
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MES STORE الصفحة الرئيسية">MES STORE</a>
        <nav aria-label="التنقل الرئيسي">
          <a href="#latest">المجموعة</a>
          <a href="/account">حسابي</a>
          <a href="/track">تتبع الطلب</a>
          <a className="nav-store-link" href={storefrontUrl}>المتجر الكامل</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MES STORE · MEN'S COLLECTION</p>
          <h1>تفاصيل تصنع <span>حضورك.</span></h1>
          <p className="hero-description">
            اكتشف اختيارات الملابس الرجالي من MES STORE، وتصفّح القطع وتفاصيلها قبل إرسال طلبك.
          </p>
          <div className="hero-actions">
            <a className="cta" href={storefrontUrl}>تسوّق المجموعة <span aria-hidden="true">←</span></a>
            <a className="text-link" href="#latest">اكتشف المنتجات</a>
          </div>
        </div>
        <div className="hero-mark" aria-hidden="true">
          <span>MES</span>
          <i />
          <small>EST. COLLECTION</small>
        </div>
      </section>

      <section className="collection-intro" aria-label="مقدمة المجموعة">
        <p className="eyebrow">THE COLLECTION</p>
        <p>قطع يومية، اختيارات واضحة، وتجربة تسوّق مباشرة.</p>
      </section>

      <section id="latest" className="products">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SELECTED PIECES</p>
            <h2>أحدث المنتجات</h2>
          </div>
          <a href={storefrontUrl}>عرض المجموعة كاملة <span aria-hidden="true">←</span></a>
        </div>

        {products.length > 0 ? (
          <div className="grid">
            {products.map((product) => {
              const image = productImage(product);
              const price = formatPrice(product.price, product.currency ?? 'EGP');
              const compareAt = product.compareAtPrice == null
                ? null
                : Number(product.compareAtPrice);
              const hasComparePrice = compareAt !== null &&
                Number.isFinite(compareAt) &&
                compareAt > Number(product.price);

              return (
                <article className="product" key={product.id}>
                  <a className="product-image-link" href={storefrontUrl} aria-label={`عرض ${product.name} في المتجر`}>
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt={image.alt || product.name} loading="lazy" />
                    ) : (
                      <div className="image-placeholder" role="img" aria-label="صورة المنتج غير متاحة">
                        <span>MES</span>
                        <small>الصورة غير متاحة حالياً</small>
                      </div>
                    )}
                    {product.category?.name && <span className="product-category">{product.category.name}</span>}
                  </a>
                  <div className="product-info">
                    <div>
                      <h3>{product.name}</h3>
                      {product.description && <p className="product-description">{product.description}</p>}
                    </div>
                    <div className="product-pricing">
                      <strong>{price}</strong>
                      {hasComparePrice && <del>{formatPrice(compareAt as number, product.currency ?? 'EGP')}</del>}
                    </div>
                  </div>
                  <a className="product-action" href={storefrontUrl}>عرض التفاصيل <span aria-hidden="true">←</span></a>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalogue-empty">
            <span className="empty-mark">MES</span>
            <div>
              <h3>استكشف المجموعة الكاملة</h3>
              <p>يمكنك تصفّح المنتجات المتاحة مباشرة من المتجر.</p>
              <a className="text-link" href={storefrontUrl}>الانتقال إلى المتجر <span aria-hidden="true">←</span></a>
            </div>
          </div>
        )}
      </section>

      <section className="store-links" aria-label="خدمات المتجر">
        <a href={storefrontUrl}><span>01</span><strong>تصفّح المجموعة</strong><small>المنتجات والتفاصيل</small></a>
        <a href="/account"><span>02</span><strong>حسابك</strong><small>بياناتك وطلباتك</small></a>
        <a href="/track"><span>03</span><strong>متابعة الطلب</strong><small>أدخل بيانات التتبع</small></a>
      </section>

      <footer className="site-footer">
        <a className="brand" href="/">MES STORE</a>
        <p>ملابس رجالي · MEN'S COLLECTION</p>
        <span>© {new Date().getFullYear()} MES STORE</span>
      </footer>
    </main>
  );
}
