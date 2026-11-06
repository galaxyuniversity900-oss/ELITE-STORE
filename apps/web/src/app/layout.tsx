import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(publicSiteUrl ? { metadataBase: new URL(publicSiteUrl) } : {}),
  title: {
    default: 'MES STORE | ملابس رجالي',
    template: '%s | MES STORE',
  },
  description: 'اكتشف مجموعة MES STORE من الملابس الرجالي. جواكت وهوديز وبناطيل بتفاصيل عصرية وتجربة تسوّق مباشرة.',
  applicationName: 'MES STORE',
  robots: {
    index: Boolean(publicSiteUrl),
    follow: Boolean(publicSiteUrl),
    googleBot: {
      index: Boolean(publicSiteUrl),
      follow: Boolean(publicSiteUrl),
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    siteName: 'MES STORE',
    title: 'MES STORE | ملابس رجالي',
    description: 'اكتشف مجموعة MES STORE من الملابس الرجالي.',
    ...(publicSiteUrl ? { url: publicSiteUrl } : {}),
  },
  twitter: {
    card: 'summary',
    title: 'MES STORE | ملابس رجالي',
    description: 'اكتشف مجموعة MES STORE من الملابس الرجالي.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
