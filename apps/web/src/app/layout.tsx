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
          <div className="app-footer-note">
            <div className="app-footer-copyright">{`Группа компаний МГК "ГРАНД" © ${currentYear}`}</div>
            <a
              className="app-footer-feedback"
              href="mailto:kostyas311@yandex.ru?subject=%D0%9F%D0%BE%D1%80%D1%82%D0%B0%D0%BB%20%D0%9D%D0%BE%D1%80%D0%BC%D0%B1%D0%B0%D0%B7%D0%B0%20-%20%D0%B4%D0%B5%D1%84%D0%B5%D0%BA%D1%82%20%D0%B8%D0%BB%D0%B8%20%D1%83%D0%BB%D1%83%D1%87%D1%88%D0%B5%D0%BD%D0%B8%D0%B5"
            >
              Написать разработке о дефекте или улучшении
            </a>
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
