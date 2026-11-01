const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api';

async function getHealth() {
  try {
    const response = await fetch(`${apiUrl}/health`, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export default async function AdminHome() {
  const health = await getHealth();
  return <main className="shell">
    <header><span>MES STORE</span><small>CONTROL CENTER</small></header>
    <section className="intro"><p>لوحة الإدارة</p><h1>نظرة عامة على المنصة</h1><span>واجهة منفصلة عن متجر العملاء. لا تعرض بيانات تشغيل حساسة قبل تفعيل المصادقة والصلاحيات.</span></section>
    <section className="status">
      <div><small>API STATUS</small><strong className={health ? 'ok' : 'off'}>{health?.status === 'ok' ? 'متصل' : 'غير متصل'}</strong></div>
      <div><small>API SERVICE</small><strong>{health?.service ?? 'mes-store-api'}</strong></div>
      <div><small>ENVIRONMENT</small><strong>{process.env.NODE_ENV}</strong></div>
    </section>
    <p className="notice">عمليات الإدارة والطلبات والمدفوعات غير متاحة من هذه الواجهة حالياً. يجب تفعيل المصادقة والتحقق من دور ADMIN قبل نشر لوحة الإدارة للعامة.</p>
  </main>;
}
