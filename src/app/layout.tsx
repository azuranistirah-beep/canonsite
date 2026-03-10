import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../styles/index.css';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Broker Website Development',
  description: 'This platform connects traders with real-time market data, offering an intuitive admin and member dashboard for seamless trading experiences.',
  icons: {
    icon: [
      { url: 'https://dhiwise-assets.s3.ap-south-1.amazonaws.com/uploadAttachments/LOGO_PANJANG-1773100758034.png', type: 'image/png' }
    ],
    apple: [
      { url: 'https://dhiwise-assets.s3.ap-south-1.amazonaws.com/uploadAttachments/LOGO_PANJANG-1773100758034.png' }
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script id="tv-widget-script" src="https://s3.tradingview.com/tv.js" async />
</head>
      <body className={`${inter.className} hide-rocket-badge`}>
        <AuthProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
