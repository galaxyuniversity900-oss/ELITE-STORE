import type { Metadata } from 'next';
import AccountClient from './account-client';

export const metadata: Metadata = {
  title: 'حساب العميل',
  description: 'إدارة حساب MES STORE وعناوين التوصيل والطلبات.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AccountPage() {
  return <AccountClient />;
}
