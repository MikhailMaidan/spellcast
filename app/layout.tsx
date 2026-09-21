import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/components/SettingsProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'IELTS Spelling Trainer',
  description: 'Browser-based dictation simulator for letter-by-letter spelling of surnames, postcodes and codes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
