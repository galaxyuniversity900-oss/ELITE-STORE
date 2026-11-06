import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تتبع الطلب',
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
