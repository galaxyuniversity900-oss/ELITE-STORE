const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? '/ELITE.html';
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api';

async function getProducts() {
  try {
    const response = await fetch(`${apiUrl}/products?limit=8`, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();
  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/">MES STORE</a>
        <nav><a href={storefrontUrl}>المتجر الكامل</a><a href="#latest">أحدث المنتجات</a></nav>
      </header>
      <section className="hero">
        <p className="eyebrow">MEN'S COLLECTION</p>
        <h1>اختياراتك اليومية، <span>بأسلوبك.</span></h1>
        <p>اكتشف تشكيلة MES STORE للملابس الرجالي.</p>
        <a className="cta" href={storefrontUrl}>تسوق المجموعة</a>
      </section>
      <section id="latest" className="products">
        <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>أحدث المنتجات</h2></div><a href={storefrontUrl}>عرض كل المنتجات ←</a></div>
        {products.length ? <div className="grid">{products.map((product: any) => (
          <article className="product" key={product.id}>
            {product.images?.[0]?.url ? <img src={product.images[0].url} alt={product.images[0].alt ?? product.name} /> : <div className="image-placeholder">MES</div>}
            <h3>{product.name}</h3><p>{Number(product.price).toLocaleString('ar-EG')} ج.م</p>
          </article>
        ))}</div> : <p className="empty">كتالوج قاعدة البيانات سيظهر هنا بعد ربط المنتجات به. يمكنك استخدام المتجر الحالي الآن.</p>}
      </section>
      <footer>© {new Date().getFullYear()} MES STORE</footer>
    </main>
  );
}
