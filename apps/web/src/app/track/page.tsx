import type { Metadata } from 'next';
import TrackClient from './track-client';

export const metadata: Metadata = {
  title: 'تتبع الطلب',
  description: 'صفحة خاصة لمتابعة حالة شحنة MES STORE باستخدام رقم التتبع ورقم الهاتف.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function TrackPage() {
  return <TrackClient />;
}
