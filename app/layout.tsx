import type { Metadata, Viewport } from 'next';
import { DesfazerConcluir } from './_ui/DesfazerConcluir';
import { Suspense } from 'react';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
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
        {/* Barrinha fina no topo ao trocar de página (substitui os esqueletos cinza que piscavam). */}
        <NextTopLoader color="#111113" height={2} showSpinner={false} shadow={false} />
        <Suspense fallback={null}>
          <AdminViewingBanner />
        </Suspense>
        {children}
        <DesfazerConcluir />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
