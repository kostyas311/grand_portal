import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Управление сметно-нормативной документацией',
  description: 'Внутренний портал отслеживания входящей документации',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers>
          {children}
          <div className="app-copyright">
            {`Группа компаний МГК "ГРАНД" © ${currentYear}`}
          </div>
          <Toaster
            position="top-right"
            closeButton
            expand
            visibleToasts={4}
            duration={5000}
            toastOptions={{
              classNames: {
                toast: 'app-toast',
                title: 'app-toast-title',
                description: 'app-toast-description',
                closeButton: 'app-toast-close',
                success: 'app-toast-success',
                error: 'app-toast-error',
                warning: 'app-toast-warning',
                info: 'app-toast-info',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
