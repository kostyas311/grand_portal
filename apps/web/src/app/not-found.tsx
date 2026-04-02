import Link from 'next/link';
import { ArrowLeft, Compass, Lightbulb, SearchX } from 'lucide-react';
import { BrandBlock } from '@/components/shared/BrandBlock';

export default function NotFound() {
  return (
    <div className="not-found-shell">
      <div className="not-found-backdrop" />

      <div className="not-found-container">
        <div className="not-found-brand">
          <BrandBlock variant="auth" />
        </div>

        <section className="not-found-card">
          <div className="not-found-badge">
            <SearchX className="h-4 w-4" />
            Ошибка навигации
          </div>

          <div className="not-found-grid">
            <div className="not-found-copy">
              <p className="not-found-code">404</p>
              <h1 className="not-found-title">Такой страницы нет на портале</h1>
              <p className="not-found-text">
                Возможно, ссылка устарела, была введена с ошибкой или нужный раздел был
                перенесён. Ничего критичного не произошло: просто вернитесь в рабочую зону
                и продолжите работу оттуда.
              </p>

              <div className="not-found-actions">
                <Link href="/dashboard" className="btn-primary">
                  <Compass className="h-4 w-4" />
                  В мой кабинет
                </Link>
                <Link href="/" className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" />
                  На главную
                </Link>
              </div>
            </div>

            <div className="not-found-panel">
              <div className="not-found-panel-icon">
                <Lightbulb className="h-6 w-6" />
              </div>
              <h2 className="not-found-panel-title">Что можно сделать дальше</h2>
              <ul className="not-found-list">
                <li>Проверьте, нет ли опечатки в адресе страницы.</li>
                <li>Вернитесь в нужный раздел через боковое меню портала.</li>
                <li>Откройте встроенную справку, если не уверены, где находится нужная функция.</li>
                <li>Если ссылка должна была работать, сообщите о проблеме разработке через ссылку внизу страницы.</li>
              </ul>

              <div className="not-found-links">
                <Link href="/help" className="not-found-link">
                  Открыть справку
                </Link>
                <Link href="/requests" className="not-found-link">
                  Перейти к обращениям
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
