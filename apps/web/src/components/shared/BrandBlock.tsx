'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const BRAND_LOGO_URL = '/logo.png';

interface BrandBlockProps {
  variant?: 'sidebar' | 'auth';
}

export function BrandBlock({ variant = 'sidebar' }: BrandBlockProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <Link
      href="/"
      className={cn(
        'no-underline',
        isSidebar ? 'brand-block brand-block-sidebar' : 'brand-block brand-block-auth',
      )}
    >
      <div className={cn('brand-logo-shell', isSidebar ? 'brand-logo-shell-sidebar' : 'brand-logo-shell-auth')}>
        <Image
          src={BRAND_LOGO_URL}
          alt="Логотип"
          width={isSidebar ? 52 : 88}
          height={isSidebar ? 52 : 88}
          className="brand-logo-image"
          priority
        />
      </div>

      <div className={cn('brand-copy', isSidebar ? 'brand-copy-sidebar' : 'brand-copy-auth')}>
        <span className={cn('brand-kicker-row', isSidebar ? 'brand-kicker-row-sidebar' : 'brand-kicker-row-auth')}>
          <span className={cn('brand-kicker', isSidebar ? 'brand-kicker-sidebar' : 'brand-kicker-auth')}>
            Нормбаза
          </span>
          <span className={cn('brand-beta-glyph', isSidebar ? 'brand-beta-glyph-sidebar' : 'brand-beta-glyph-auth')} aria-label="Бета-версия" title="Бета-версия">
            β
          </span>
        </span>
        <span className={cn('brand-title', isSidebar ? 'brand-title-sidebar' : 'brand-title-auth')}>
          Управление сметно-нормативной документацией
        </span>
        <span className={cn('brand-subtitle', isSidebar ? 'brand-subtitle-sidebar' : 'brand-subtitle-auth')}>
          Документооборот
        </span>
      </div>
    </Link>
  );
}
