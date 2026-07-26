import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './styles.css';

export const metadata: Metadata = {
  applicationName: 'JaldiAI',
  description: 'Ask once. Watch the task happen safely on your phone.',
  manifest: '/manifest.webmanifest',
  title: 'JaldiAI — speak, then done',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#10130f',
  userScalable: false,
  width: 'device-width',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
