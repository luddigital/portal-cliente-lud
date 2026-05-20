import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { ServiceWorkerRegistration } from './_components/ServiceWorkerRegistration';
import { AdminViewingBanner } from './_components/AdminViewingBanner';

export const metadata: Metadata = {
  title: 'Lud. — Portal do Cliente',
  description: 'Sua central de conteúdos com a Lud.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lud.',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#151521',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <AdminViewingBanner />
        </Suspense>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
