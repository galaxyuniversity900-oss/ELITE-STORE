'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const PAGE_SIZE = 25;

type DeliveryAttempt = {
  attemptNumber: number;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  providerMessageId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};
type DeliveryEvent = { provider: string; status: string; occurredAt: string };
type Notification = {
  id: string;
  orderId: string;
  channel: 'WHATSAPP' | 'EMAIL';
  eventType: string;
  recipient?: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'DEAD';
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  sentAt?: string | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  providerStatusAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  order?: { orderNumber: string } | null;
  attemptsLog: DeliveryAttempt[];
  deliveryEvents: DeliveryEvent[];
};
type PageResult = { items: Notification[]; total: number; page: number; limit: number; pages: number };

const statusLabels: Record<string, string> = {
  PENDING: 'في الانتظار',
  PROCESSING: 'قيد الإرسال',
  SENT: 'قبله مزود الخدمة',
  DEAD: 'فشل نهائي',
  accepted: 'تم القبول لدى المزود',
  sent: 'تم الإرسال',
  delivered: 'تم التسليم',
  read: 'تمت القراءة',
  bounced: 'ارتداد البريد',
  complained: 'شكوى بريدية',
  failed: 'فشل لدى المزود',
  delivery_delayed: 'تأخر التسليم',
  manual_retry_requested: 'إعادة محاولة يدوية',
  SUCCEEDED: 'نجحت المحاولة',
  FAILED: 'فشلت المحاولة',
  STARTED: 'بدأت المحاولة',
  ABANDONED: 'انقطعت المحاولة',
};
const statusTone: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SENT: 'sent',
  DEAD: 'dead',
  delivered: 'sent',
  read: 'sent',
  bounced: 'dead',
  failed: 'dead',
  FAILED: 'dead',
  SUCCEEDED: 'sent',
};

function label(value?: string | null) {
  if (!value) return '—';
  return statusLabels[value] ?? value.replaceAll('_', ' ');
}
function date(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}
function tone(value?: string | null) {
  return value ? statusTone[value] ?? 'neutral' : 'neutral';
}

export default function NotificationCenterPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const requestHeaders = useMemo(() => ({
    Accept: 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  }), [token]);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (channel) params.set('channel', channel);
    try {
      const response = await fetch(`${API}/admin/notifications?${params.toString()}`, {
        headers: requestHeaders,
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        window.sessionStorage.removeItem('mes_admin_token');
        setToken('');
        throw new Error(response.status === 403 ? 'هذا الحساب لا يملك صلاحية إدارة الإشعارات.' : 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      }
      if (!response.ok) throw new Error(data?.message ?? `تعذر تحميل الإشعارات (${response.status})`);
      setResult(data as PageResult);
      setSelectedId(current => current && data.items.some((item: Notification) => item.id === current) ? current : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل سجل الإشعارات');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, page, status, channel, requestHeaders]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem('mes_admin_token');
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) void loadNotifications();
  }, [token, loadNotifications]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? 'تعذر تسجيل الدخول');
      if (!['ADMIN', 'SUPER_ADMIN'].includes(data?.user?.role)) {
        throw new Error('هذا الحساب ليس حساب إدارة مخولاً بالدخول.');
      }
      window.sessionStorage.setItem('mes_admin_token', data.accessToken);
      setPassword('');
      setToken(data.accessToken);
      setNotice('تم تسجيل الدخول إلى مركز الإشعارات.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  async function retry(item: Notification) {
    if (item.status !== 'DEAD') return;
    setRetryingId(item.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API}/admin/notifications/${encodeURIComponent(item.id)}/retry`, {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        window.sessionStorage.removeItem('mes_admin_token');
        setToken('');
      }
      if (!response.ok) throw new Error(data?.message ?? 'تعذرت جدولة إعادة المحاولة');
      setNotice(`تمت إعادة جدولة الإشعار ${item.order?.orderNumber ?? item.id}، وسيعالجه عامل الإرسال.`);
      await loadNotifications(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذرت إعادة المحاولة');
    } finally {
      setRetryingId(null);
    }
  }

  function logout() {
    window.sessionStorage.removeItem('mes_admin_token');
    setToken('');
    setResult(null);
    setSelectedId(null);
    setPassword('');
  }

  const items = result?.items ?? [];
  const selected = items.find(item => item.id === selectedId) ?? null;
  const pageAttempts = items.reduce((sum, item) => sum + item.attempts, 0);
  const pageDead = items.filter(item => item.status === 'DEAD').length;

  if (!token) {
    return (
      <main className="admin-shell login-shell" dir="rtl">
        <section className="login-card">
          <span className="eyebrow">MES STORE / NOTIFICATION CENTER</span>
          <h1>مركز الإشعارات</h1>
          <p>سجّل الدخول بحساب ADMIN أو SUPER_ADMIN لمراجعة التسليم والمحاولات وإعادة الإرسال.</p>
          <form onSubmit={login}>
            <label>البريد الإلكتروني<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label>
            <label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
            <button disabled={loading}>{loading ? 'جارٍ التحقق…' : 'دخول آمن'}</button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="footnote"><a href="/">العودة إلى لوحة الإدارة</a></p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell notification-shell" dir="rtl">
      <header className="admin-header notification-header">
        <div>
          <span className="eyebrow">MES STORE / OPERATIONS</span>
          <h1>مركز الإشعارات</h1>
          <p className="notification-subtitle">مراقبة إشعارات WhatsApp والبريد الإلكتروني وسجل التسليم الفعلي.</p>
        </div>
        <div className="notification-header-actions">
          <a className="secondary notification-link" href="/">لوحة الإدارة</a>
          <button className="secondary" onClick={() => void loadNotifications()}>تحديث السجل</button>
          <button className="secondary" onClick={logout}>تسجيل الخروج</button>
        </div>
      </header>

      {notice && <p className="notification-notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="notification-stats" aria-label="ملخص النتائج الحالية">
        <article><small>إجمالي النتائج المطابقة</small><strong>{result?.total ?? '—'}</strong></article>
        <article><small>سجلات الصفحة الحالية</small><strong>{items.length}</strong></article>
        <article><small>فشل نهائي في الصفحة</small><strong className={pageDead ? 'metric-danger' : ''}>{pageDead}</strong></article>
        <article><small>إجمالي المحاولات في الصفحة</small><strong>{pageAttempts}</strong></article>
      </section>

      <section className="notification-filters panel">
        <div className="panel-heading"><h2>تصفية سجل الإرسال</h2><span>{loading ? 'جارٍ التحديث…' : `صفحة ${result?.page ?? page} من ${result?.pages ?? 1}`}</span></div>
        <div className="filter-controls">
          <label>حالة المعالجة
            <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
              <option value="">كل الحالات</option>
              <option value="PENDING">في الانتظار</option>
              <option value="PROCESSING">قيد الإرسال</option>
              <option value="SENT">قبله مزود الخدمة</option>
              <option value="DEAD">فشل نهائي</option>
            </select>
          </label>
          <label>قناة الإرسال
            <select value={channel} onChange={event => { setChannel(event.target.value); setPage(1); }}>
              <option value="">كل القنوات</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
          </label>
          <button className="secondary filter-reset" onClick={() => { setStatus(''); setChannel(''); setPage(1); }}>مسح الفلاتر</button>
        </div>
      </section>

      <section className="panel notification-list-panel">
        <div className="panel-heading"><h2>سجل الإشعارات</h2><span>{result?.total ?? 0} نتيجة</span></div>
        {loading && !result ? <p className="notification-empty">جارٍ تحميل سجل الإشعارات…</p> : items.length === 0 ? (
          <div className="notification-empty"><strong>لا توجد إشعارات مطابقة</strong><p>جرّب تغيير الفلاتر أو أعد تحديث السجل بعد وصول طلب جديد.</p></div>
        ) : (
          <div className="notification-table-wrap">
            <table className="notification-table">
              <thead><tr><th>الطلب / الحدث</th><th>القناة والمستلم</th><th>حالة المعالجة</th><th>حالة المزود</th><th>المحاولات</th><th>تاريخ الإنشاء</th><th>تفاصيل</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className={selectedId === item.id ? 'notification-row-selected' : ''}>
                    <td><strong>{item.order?.orderNumber ?? 'طلب غير مرتبط'}</strong><small>{item.eventType}</small></td>
                    <td><strong>{item.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}</strong><small dir="ltr">{item.recipient ?? 'لم يحدد المستلم'}</small></td>
                    <td><span className={`status-chip ${tone(item.status)}`}>{label(item.status)}</span>{item.lastError && <small className="inline-error">{item.lastError}</small>}</td>
                    <td><span className={`status-chip ${tone(item.providerStatus)}`}>{label(item.providerStatus)}</span><small>{date(item.providerStatusAt)}</small></td>
                    <td><strong>{item.attempts} / {item.maxAttempts}</strong><small>{item.attemptsLog.length} سجل محاولة ظاهر</small></td>
                    <td>{date(item.createdAt)}</td>
                    <td><div className="notification-row-actions"><button className="secondary" onClick={() => setSelectedId(selectedId === item.id ? null : item.id)} aria-expanded={selectedId === item.id}>{selectedId === item.id ? 'إخفاء' : 'التفاصيل'}</button>{item.status === 'DEAD' && <button className="retry-button" disabled={retryingId === item.id} onClick={() => void retry(item)}>{retryingId === item.id ? 'جارٍ الجدولة…' : 'إعادة المحاولة'}</button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="notification-pagination">
          <span>عرض {items.length} من {result?.total ?? 0}</span>
          <div><button className="secondary" disabled={page <= 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))}>السابق</button><strong>{result?.page ?? page} / {Math.max(1, result?.pages ?? 1)}</strong><button className="secondary" disabled={!result || page >= result.pages || loading} onClick={() => setPage(current => current + 1)}>التالي</button></div>
        </div>
      </section>

      {selected && (
        <section className="panel notification-detail" aria-live="polite">
          <div className="panel-heading"><div><span className="eyebrow">DELIVERY TRACE</span><h2>تفاصيل الإشعار — {selected.order?.orderNumber ?? selected.id}</h2></div><button className="secondary" onClick={() => setSelectedId(null)}>إغلاق التفاصيل</button></div>
          <div className="notification-detail-grid">
            <article><small>المستلم</small><strong dir="ltr">{selected.recipient ?? 'غير محدد'}</strong></article>
            <article><small>معرّف رسالة المزود</small><strong className="mono-value">{selected.providerMessageId ?? 'لم يصدر بعد'}</strong></article>
            <article><small>موعد المحاولة التالية</small><strong>{selected.status === 'PENDING' ? date(selected.availableAt) : 'لا توجد محاولة مجدولة حالياً'}</strong></article>
            <article><small>تاريخ قبول المزود</small><strong>{date(selected.sentAt)}</strong></article>
          </div>
          {selected.lastError && <div className="notification-error-detail"><strong>آخر خطأ مسجل</strong><p>{selected.lastError}</p></div>}
          <div className="notification-detail-columns">
            <section><h3>سجل المحاولات</h3>
              {selected.attemptsLog.length ? <ol className="delivery-timeline">{selected.attemptsLog.map((attempt, index) => <li key={`${attempt.attemptNumber}-${index}`}><span className={`timeline-marker ${tone(attempt.status)}`} /><div><div className="timeline-heading"><strong>المحاولة #{attempt.attemptNumber}</strong><span className={`status-chip ${tone(attempt.status)}`}>{label(attempt.status)}</span></div><p>بدأت: {date(attempt.startedAt)}</p><p>انتهت: {date(attempt.finishedAt)}</p>{attempt.httpStatus && <p>HTTP: {attempt.httpStatus}</p>}{attempt.errorCode && <p className="inline-error">{attempt.errorCode}: {attempt.errorMessage ?? ''}</p>}{attempt.providerMessageId && <p className="mono-value">Message ID: {attempt.providerMessageId}</p>}</div></li>)}</ol> : <p className="notification-muted">لا توجد محاولات مسجلة حتى الآن.</p>}
            </section>
            <section><h3>أحداث التسليم الواردة من المزود</h3>
              {selected.deliveryEvents.length ? <ol className="delivery-timeline">{selected.deliveryEvents.map((event, index) => <li key={`${event.provider}-${event.status}-${event.occurredAt}-${index}`}><span className={`timeline-marker ${tone(event.status)}`} /><div><strong>{label(event.status)}</strong><p>{event.provider} · {date(event.occurredAt)}</p></div></li>)}</ol> : <p className="notification-muted">لم تصل Webhook events لهذا الإشعار بعد. قبول المزود وحده لا يثبت وصول الرسالة إلى جهاز المستلم.</p>}
            </section>
          </div>
          {selected.status === 'DEAD' && <div className="notification-detail-footer"><p>إعادة المحاولة تنشئ جدولة جديدة مسجلة في سجل الأحداث، ولا تمثل تأكيداً بأن المزود سيقبل الرسالة.</p><button className="retry-button" disabled={retryingId === selected.id} onClick={() => void retry(selected)}>{retryingId === selected.id ? 'جارٍ الجدولة…' : 'إعادة محاولة الإشعار'}</button></div>}
        </section>
      )}
      <p className="footnote notification-footnote">حالة «قبله مزود الخدمة» تعني قبول الطلب لدى Meta أو Resend فقط. تأكيد التسليم أو القراءة يظهر عند وصول Webhook موثّق من المزود.</p>
    </main>
  );
}
