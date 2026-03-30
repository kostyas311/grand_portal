# Frontend Agent — Next.js Developer

## Миссия
Реализовать быстрый, красивый и удобный интерфейс портала на Next.js 14.

## Стек
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query (React Query) — серверный стейт
- Zustand — клиентский стейт (auth, UI)
- React Hook Form + Zod — формы и валидация
- axios — HTTP клиент
- date-fns — работа с датами
- lucide-react — иконки
- react-dropzone — drag-and-drop загрузка файлов

## Структура (apps/web/src/)
```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Главная (готовые проекты / портал)
│   ├── login/page.tsx          # Вход
│   ├── dashboard/page.tsx      # Мой кабинет
│   ├── cards/
│   │   ├── page.tsx            # Все карточки
│   │   ├── new/page.tsx        # Создание
│   │   └── [id]/
│   │       ├── page.tsx        # Карточка
│   │       └── edit/page.tsx   # Редактирование
│   ├── sources/page.tsx        # Справочник источников
│   ├── profile/page.tsx        # Профиль
│   └── admin/
│       └── users/page.tsx      # Пользователи (admin)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AppLayout.tsx
│   ├── ui/                     # shadcn/ui компоненты
│   ├── cards/
│   │   ├── CardList.tsx
│   │   ├── CardTable.tsx
│   │   ├── CardFilters.tsx
│   │   ├── CardStatusBadge.tsx
│   │   ├── CardPriorityBadge.tsx
│   │   ├── CardForm.tsx
│   │   └── CardDetail/
│   │       ├── index.tsx
│   │       ├── MaterialsSection.tsx
│   │       ├── ResultsSection.tsx
│   │       ├── HistorySection.tsx
│   │       └── CommentsSection.tsx
│   ├── files/
│   │   ├── FileUpload.tsx      # drag-and-drop
│   │   ├── FileItem.tsx
│   │   └── LinkInput.tsx
│   └── shared/
│       ├── UserSelect.tsx
│       ├── StatusTransition.tsx
│       ├── EmptyState.tsx
│       ├── ConfirmDialog.tsx
│       └── CopyLink.tsx
├── lib/
│   ├── api/                    # API клиент (axios instances)
│   ├── hooks/                  # кастомные хуки
│   ├── store/                  # Zustand stores
│   └── utils/                  # утилиты
└── types/                      # TypeScript типы (shared с backend)
```

## Дизайн-система

### Цвета (ориентир grandsmeta.ru)
```css
--color-primary: #1e3a5f;      /* основной синий */
--color-primary-light: #2a5298; /* светлее */
--color-accent: #e67e22;        /* оранжевый акцент */
--color-bg: #f4f6f9;            /* фон страницы */
--color-surface: #ffffff;       /* карточки */
--color-border: #e2e8f0;        /* рамки */
--color-text: #1a202c;          /* основной текст */
--color-text-muted: #718096;    /* вторичный текст */
```

### Статусы (цвета бейджей)
```css
NEW:         bg-blue-100   text-blue-700
IN_PROGRESS: bg-yellow-100 text-yellow-700
REVIEW:      bg-purple-100 text-purple-700
DONE:        bg-green-100  text-green-700
CANCELLED:   bg-gray-100   text-gray-500
```

### Приоритеты
```css
OPTIONAL: bg-gray-100   text-gray-600
NORMAL:   bg-blue-100   text-blue-600
URGENT:   bg-orange-100 text-orange-600
CRITICAL: bg-red-100    text-red-600   (+ pulse анимация)
```

## Правила разработки
1. Используй Server Components где возможно (для SEO и performance)
2. Client Components только там, где нужна интерактивность
3. TanStack Query для всех серверных данных
4. Optimistic updates для быстрого UX
5. Skeleton loaders на всех загружаемых компонентах
6. Все формы через React Hook Form + Zod валидация
7. Toast (Sonner) для уведомлений
8. Все тексты на русском языке (интерфейс русскоязычный)
9. Защищённые роуты через middleware.ts

## Ключевые UX-паттерны
- Sidebar фиксированный на desktop, выдвижной на mobile
- Таблица карточек с сортировкой по колонкам
- Inline-статус с быстрым изменением через dropdown
- Версии результата отображаются как tabs или accordion
- История действий — хронологическая лента
- Копирование ссылки — кнопка с tooltip "Скопировано"
- Прогресс загрузки файла — progress bar
