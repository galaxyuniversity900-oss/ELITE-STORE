'use client';

import { FormEvent, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function TrackPage() {
  const [tracking, setTracking] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('tracking');
    if (value) setTracking(value);
  }, []);

  async function lookup(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch(`${API}/demo-commerce/track/${encodeURIComponent(tracking)}?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'لم يتم العثور على الشحنة');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر جلب حالة الشحنة'); }
    finally { setLoading(false); }
  }

  return <main className="portal-page"><header className="portal-header"><a href="/">MES STORE</a><nav><a href="/account">حسابي</a><a href="/">الرئيسية</a></nav></header><section className="portal-hero"><p className="portal-kicker">ORDER TRACKING</p><h1>تتبع طلبك</h1><p>أدخل رقم التتبع ورقم الهاتف المستخدم عند الطلب.</p></section>
    <form className="portal-card portal-auth" onSubmit={lookup}><label>رقم التتبع<input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="MES-TRK-XXXXXXXXXXXX" required/></label><label>رقم الهاتف<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الهاتف عند الشراء" required/></label><button className="portal-submit" disabled={loading}>{loading ? 'جارٍ البحث...' : 'عرض حالة الشحنة'}</button></form>
    {error && <p className="portal-notice">{error}</p>}
    {result && <section className="portal-card portal-result"><p className="portal-kicker">DEMO TRACKING</p><h2>{result.orderNumber}</h2><p>حالة الطلب: {result.orderStatus}</p><p>حالة الشحنة: <strong>{result.shipmentStatus}</strong></p><p>رقم التتبع: {result.trackingNumber}</p><p>المدة التقديرية: {result.estimatedDays} أيام</p><div className="portal-timeline">{result.events.map((event:any,index:number) => <article key={index}><span className="portal-dot"/><div><strong>{event.description}</strong><p>{event.location} · {new Date(event.occurredAt).toLocaleString('ar-EG')}</p></div></article>)}</div><small>هذه بيانات شحن تجريبية وليست تحديثات من شركة توصيل فعلية.</small></section>}
    <footer className="portal-foot">© MES STORE</footer></main>;
}
