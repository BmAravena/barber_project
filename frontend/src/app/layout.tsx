import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Homie SaaS — Barber Shop Platform',
  description: 'Plataforma multi-tenant para barberías.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;600;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-ink text-cream antialiased">{children}</body>
    </html>
  );
}
