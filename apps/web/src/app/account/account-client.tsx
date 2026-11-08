'use client';

import { FormEvent, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
type Order = { orderNumber: string; status: string; grandTotal: string | number; currency: string; createdAt: string; shipment?: { trackingNumber: string; status: string } | null };

export default function AccountPage() {
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [notice, setNotice] = useState('');
  const [address, setAddress] = useState({ recipient: '', phone: '', city: '', street: '', area: '', building: '', apartment: '', label: 'المنزل', isDefault: true });

  async function loadAccount(accessToken: string) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [me, history, saved] = await Promise.all([
      fetch(`${API}/account/me`, { headers }),
      fetch(`${API}/account/orders`, { headers }),
      fetch(`${API}/account/addresses`, { headers }),
    ]);
    if (![me, history, saved].every(response => response.ok)) throw new Error('انتهت الجلسة أو تعذر تحميل الحساب');
    setProfile(await me.json());
    setOrders(await history.json());
    setAddresses(await saved.json());
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('mes_customer_token');
    if (saved) {
      setToken(saved);
      loadAccount(saved).catch(error => { sessionStorage.removeItem('mes_customer_token'); setToken(''); setNotice(error.message); });
    }
  }, []);

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); setNotice('');
    const endpoint = mode === 'register' ? 'register' : 'login';
    const payload = mode === 'register' ? { email, password, firstName, lastName, phone } : { email, password };
    try {
      const response = await fetch(`${API}/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'تعذر تسجيل الدخول');
      sessionStorage.setItem('mes_customer_token', result.accessToken);
      setToken(result.accessToken);
      await loadAccount(result.accessToken);
      setNotice('تم تسجيل الدخول');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'حدث خطأ'); }
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${API}/account/addresses`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(address) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'تعذر حفظ العنوان');
      setAddresses(current => [result, ...current]);
      setNotice('تم حفظ العنوان');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'حدث خطأ'); }
  }

  function logout() {
    sessionStorage.removeItem('mes_customer_token'); setToken(''); setProfile(null); setOrders([]); setAddresses([]); setNotice('تم تسجيل الخروج');
  }

  return <main className="portal-page">
    <header className="portal-header"><a href="/">MES STORE</a><nav><a href="/">الرئيسية</a><a href="/track">تتبع طلب</a></nav></header>
    <section className="portal-hero"><p className="portal-kicker">CUSTOMER ACCOUNT</p><h1>حسابك في MES STORE</h1><p>إدارة بياناتك وعناوين التوصيل ومتابعة مشترياتك.</p></section>
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    {!token || !profile ? <form className="portal-card portal-auth" onSubmit={submitAuth}>
      <div className="portal-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>تسجيل الدخول</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>إنشاء حساب</button></div>
      {mode === 'register' && <div className="portal-fields"><input placeholder="الاسم الأول" value={firstName} onChange={e => setFirstName(e.target.value)} required/><input placeholder="اسم العائلة" value={lastName} onChange={e => setLastName(e.target.value)}/><input placeholder="رقم الهاتف" value={phone} onChange={e => setPhone(e.target.value)} required/></div>}
      <label>البريد الإلكتروني<input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label>
      <label>كلمة المرور<input type="password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} required/></label>
      <button className="portal-submit" type="submit">{mode === 'login' ? 'دخول الحساب' : 'إنشاء الحساب'}</button>
      <small>نسخة تجريبية: يلزم 12 حرفاً على الأقل لكلمة المرور.</small>
    </form> : <div className="portal-columns">
      <section className="portal-card"><div className="portal-card-title"><h2>بيانات الحساب</h2><button onClick={logout}>تسجيل الخروج</button></div><p>{profile.firstName ?? ''} {profile.lastName ?? ''}</p><p>{profile.email}</p><p>{profile.phone ?? 'لم يضاف رقم هاتف'}</p></section>
      <section className="portal-card"><h2>عناوين التوصيل</h2>{addresses.map(item => <article className="portal-address" key={item.id}><strong>{item.label ?? 'عنوان'}</strong><p>{item.recipient} — {item.phone}</p><p>{item.city}، {item.area}، {item.street}</p></article>)}<form className="portal-fields" onSubmit={saveAddress}><input placeholder="اسم المستلم" value={address.recipient} onChange={e => setAddress({...address,recipient:e.target.value})} required/><input placeholder="الهاتف" value={address.phone} onChange={e => setAddress({...address,phone:e.target.value})} required/><input placeholder="المحافظة / المدينة" value={address.city} onChange={e => setAddress({...address,city:e.target.value})} required/><input placeholder="الشارع" value={address.street} onChange={e => setAddress({...address,street:e.target.value})} required/><input placeholder="المنطقة" value={address.area} onChange={e => setAddress({...address,area:e.target.value})}/><input placeholder="المبنى" value={address.building} onChange={e => setAddress({...address,building:e.target.value})}/><button className="portal-submit" type="submit">حفظ العنوان</button></form></section>
      <section className="portal-card portal-orders"><h2>طلباتي</h2>{orders.length ? orders.map(order => <article className="portal-order" key={order.orderNumber}><div><strong>{order.orderNumber}</strong><p>{new Date(order.createdAt).toLocaleDateString('ar-EG')} · {order.status}</p></div><strong>{Number(order.grandTotal).toLocaleString('ar-EG')} ج.م</strong>{order.shipment?.trackingNumber && <a href={`/track?tracking=${encodeURIComponent(order.shipment.trackingNumber)}`}>تتبع الشحنة</a>}</article>) : <p>لا توجد طلبات مرتبطة بهذا الحساب حتى الآن.</p>}</section>
    </div>}
    <footer className="portal-foot">© MES STORE — نظام حسابات تجريبي قابل للتطوير</footer>
  </main>;
}
