import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lud. — Portal do Cliente',
  description: 'Envie materiais e informações dos seus posts',
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
      <body>{children}</body>
    </html>
  );
}
