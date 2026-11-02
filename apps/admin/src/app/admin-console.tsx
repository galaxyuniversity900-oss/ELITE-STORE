"use client";

import { FormEvent, useEffect, useState } from 'react';

type Product = { id: string; name: string; sku: string; slug: string; price: string | number; status: string; stockQuantity: number | null };
type Order = { id: string; orderNumber: string; status: string; customerName: string; customerPhone: string; grandTotal: string | number; currency: string };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function AdminConsole() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function api(path: string, init: RequestInit = {}, authToken = token) {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message ?? `Request failed (${response.status})`);
    return data;
  }

  async function refresh(authToken: string) {
    const [summary, productRows, orderRows] = await Promise.all([
      api('/admin/overview', {}, authToken),
      api('/admin/products?limit=100', {}, authToken),
      api('/admin/orders?limit=100', {}, authToken),
    ]);
    setOverview(summary);
    setProducts(productRows);
    setOrders(orderRows);
  }

  useEffect(() => {
    const saved = window.sessionStorage.getItem('mes_admin_token');
    if (saved) {
      setToken(saved);
      refresh(saved).catch((cause: Error) => {
        window.sessionStorage.removeItem('mes_admin_token');
        setToken('');
        setError(cause.message);
      });
    }
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, '');
      window.sessionStorage.setItem('mes_admin_token', result.accessToken);
      setToken(result.accessToken);
      setPassword('');
      await refresh(result.accessToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name')),
          sku: String(form.get('sku')),
          slug: String(form.get('slug')),
          price: Number(form.get('price')),
          stockQuantity: form.get('stockQuantity') === '' ? null : Number(form.get('stockQuantity')),
          status: 'ACTIVE',
        }),
      });
      event.currentTarget.reset();
      await refresh(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ المنتج');
    } finally {
      setBusy(false);
    }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(form.get('name')),
          sku: String(form.get('sku')),
          slug: String(form.get('slug')),
          price: Number(form.get('price')),
          stockQuantity: form.get('stockQuantity') === '' ? null : Number(form.get('stockQuantity')),
        }),
      });
      setEditingProductId(null);
      await refresh(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث المنتج');
    } finally {
      setBusy(false);
    }
  }

  async function changeOrder(order: Order, status: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refresh(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث الطلب');
    } finally {
      setBusy(false);
    }
  }

  async function archiveProduct(product: Product) {
    if (!window.confirm(`أرشفة المنتج: ${product.name}؟`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      await refresh(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر أرشفة المنتج');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    window.sessionStorage.removeItem('mes_admin_token');
    setToken('');
    setOverview(null);
    setProducts([]);
    setOrders([]);
  }

  if (!token) return (
    <main className="admin-shell login-shell" dir="rtl">
      <section className="login-card">
        <span className="eyebrow">MES STORE / SECURE ACCESS</span>
        <h1>تسجيل دخول الإدارة</h1>
        <p>الدخول مخصص لحسابات الإدارة المفعّلة فقط.</p>
        <form onSubmit={login}>
          <label>البريد الإلكتروني<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <button disabled={busy}>{busy ? 'جارٍ التحقق…' : 'دخول آمن'}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );

  return (
    <main className="admin-shell" dir="rtl">
      <header className="admin-header"><div><span className="eyebrow">MES STORE</span><h1>مركز إدارة المتجر</h1></div><button className="secondary" onClick={logout}>تسجيل الخروج</button></header>
      {error && <p className="error">{error}</p>}
      <section className="stats">
        <article><small>المنتجات النشطة</small><strong>{overview?.products ?? '—'}</strong></article>
        <article><small>إجمالي الطلبات</small><strong>{overview?.orders ?? '—'}</strong></article>
        <article><small>طلبات قيد الانتظار</small><strong>{overview?.pendingOrders ?? '—'}</strong></article>
        <article><small>حسابات العملاء</small><strong>{overview?.customers ?? '—'}</strong></article>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>إضافة منتج</h2><span>تُحفظ البيانات في قاعدة البيانات</span></div>
        <form className="product-form" onSubmit={createProduct}>
          <label>اسم المنتج<input name="name" minLength={2} required /></label>
          <label>SKU<input name="sku" minLength={2} required /></label>
          <label>Slug<input name="slug" minLength={2} required /></label>
          <label>السعر بالجنيه<input name="price" type="number" min="0.01" step="0.01" required /></label>
          <label>الكمية (اتركها فارغة للمخزون غير المتتبع)<input name="stockQuantity" type="number" min="0" step="1" /></label>
          <button disabled={busy}>حفظ المنتج</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>المنتجات</h2><span>{products.length} سجل معروض</span></div>
        <div className="table-wrap"><table><thead><tr><th>المنتج</th><th>SKU</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
          {products.map(product => (
            <>
              <tr key={product.id}>
                <td>{product.name}</td><td>{product.sku}</td><td>{Number(product.price).toLocaleString('ar-EG')} ج.م</td><td>{product.stockQuantity ?? 'غير متتبع'}</td><td>{product.status}</td>
                <td><div className="actions">
                  <button className="secondary" disabled={busy || product.status === 'ARCHIVED'} onClick={() => setEditingProductId(editingProductId === product.id ? null : product.id)}>{editingProductId === product.id ? 'إغلاق' : 'تعديل'}</button>
                  <button className="danger" disabled={busy || product.status === 'ARCHIVED'} onClick={() => archiveProduct(product)}>أرشفة</button>
                </div></td>
              </tr>
              {editingProductId === product.id && (
                <tr key={`${product.id}-edit`}><td colSpan={6}>
                  <form className="product-form" onSubmit={event => updateProduct(event, product)}>
                    <label>اسم المنتج<input name="name" defaultValue={product.name} minLength={2} required /></label>
                    <label>SKU<input name="sku" defaultValue={product.sku} minLength={2} required /></label>
                    <label>Slug<input name="slug" defaultValue={product.slug} minLength={2} required /></label>
                    <label>السعر بالجنيه<input name="price" type="number" min="0.01" step="0.01" defaultValue={product.price} required /></label>
                    <label>المخزون<input name="stockQuantity" type="number" min="0" step="1" defaultValue={product.stockQuantity ?? ''} /></label>
                    <button disabled={busy}>حفظ التعديلات</button>
                  </form>
                </td></tr>
              )}
            </>
          ))}
        </tbody></table></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>الطلبات</h2><span>{orders.length} سجل معروض</span></div>
        <div className="table-wrap"><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الهاتف</th><th>الإجمالي</th><th>الحالة</th><th>تحديث الحالة</th></tr></thead><tbody>
          {orders.map(order => {
            const next: Record<string, string> = { PENDING: 'CONFIRMED', CONFIRMED: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED' };
            return <tr key={order.id}><td>{order.orderNumber}</td><td>{order.customerName}</td><td>{order.customerPhone}</td><td>{Number(order.grandTotal).toLocaleString('ar-EG')} ج.م</td><td>{order.status}</td><td><div className="actions">{next[order.status] && <button disabled={busy} onClick={() => changeOrder(order, next[order.status])}>{next[order.status]}</button>}{['PENDING','CONFIRMED','PROCESSING'].includes(order.status) && <button className="danger" disabled={busy} onClick={() => changeOrder(order, 'CANCELLED')}>إلغاء</button>}</div></td></tr>;
          })}
        </tbody></table></div>
      </section>
      <p className="footnote">تُرفض انتقالات الطلبات غير المسموح بها على الخادم. استرداد المدفوعات غير متاح حتى ربط مزود دفع موثّق.</p>
    </main>
  );
}
