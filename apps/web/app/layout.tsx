import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Noto_Sans_Arabic, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
// Patient-facing text is Arabic, Urdu and Hindi as often as English; give each script a proper face.
const arabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap', weight: ['400', '500', '600'] });
const devanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari', display: 'swap', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: { default: 'LoopClose', template: '%s · LoopClose' },
  description: 'Closed-loop results management for screening programmes. Synthetic data only.',
};

const RTL_LOCALES = new Set(['ar', 'ur']);

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en';
  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'} className={`${inter.variable} ${arabic.variable} ${devanagari.variable}`}>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
