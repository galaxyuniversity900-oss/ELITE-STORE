import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'حساب العميل',
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
