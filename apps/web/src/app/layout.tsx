import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://galaxyuniversity900-oss.github.io/ELITE-STORE/').replace(/\/?$/, '/');
const canonicalStoreUrl =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? new URL('ELITE.html', siteBase).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteBase),
  title: {
    default: 'MES STORE | ملابس رجالي',
    template: '%s | MES STORE',
  },
  description:
    'اكتشف مجموعة MES STORE من الملابس الرجالي: جواكت، هوديز، جينز وبناطيل بتفاصيل مختارة.',
  applicationName: 'MES STORE',
  alternates: {
    canonical: canonicalStoreUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    siteName: 'MES STORE',
    title: 'MES STORE | Men\'s Collection',
    description: 'ملابس رجالي بتفاصيل مختارة وإطلالة تحمل طابعك.',
    url: canonicalStoreUrl,
  },
  twitter: {
    card: 'summary',
    title: 'MES STORE | Men\'s Collection',
    description: 'ملابس رجالي بتفاصيل مختارة وإطلالة تحمل طابعك.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
