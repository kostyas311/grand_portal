'use client';

import Link from 'next/link';
import {
  Bell,
  BookOpen,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  Lightbulb,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuthStore } from '@/lib/store/auth.store';
import { cn } from '@/lib/utils';

const roleGuides = [
  {
    role: 'USER',
    title: 'Пользователь',
    icon: Users,
    summary: 'Создаёт материалы, уточняет карточки, работает с инструкциями, компонентами и обращениями.',
    tasks: [
      'Следить за карточками, где вы исполнитель или проверяющий.',
      'Заполнять результаты работы, оставлять комментарии и упоминать коллег через @.',
      'Пользоваться инструкциями и библиотекой компонентов в повседневной работе.',
      'Отправлять обращения администратору, если нужна помощь с системой или доступами.',
    ],
  },
  {
    role: 'MANAGER',
    title: 'Руководитель',
    icon: ShieldCheck,
    summary: 'Планирует работу команды, создаёт карточки, назначает исполнителей и контролирует спринты.',
    tasks: [
      'Создавать карточки, определять приоритет, сроки, источник и ответственных.',
      'Отслеживать движение задач по канбан-доске и таблицам.',
      'Проверять, что результаты приложены и карточки проходят этап проверки без задержек.',
      'Пользоваться отчётами, готовыми проектами и справочными разделами портала.',
    ],
  },
  {
    role: 'ADMIN',
    title: 'Администратор',
    icon: UserCog,
    summary: 'Поддерживает рабочее пространство, управляет пользователями, уведомлениями и административными настройками.',
    tasks: [
      'Настраивать пользователей, роли, email-уведомления и спринты.',
      'Разбирать обращения, возвращать их на уточнение, выполнять или отклонять.',
      'Следить за наполнением инструкций, компонентов и справочных разделов.',
      'Поддерживать понятную и предсказуемую структуру портала для всей команды.',
    ],
  },
] as const;

const portalSections = [
  {
    title: 'Мой кабинет',
    href: '/dashboard',
    icon: ClipboardList,
    description: 'Личный рабочий экран с карточками, где видно ваши задачи, проверку и ближайшие приоритеты.',
    bullets: [
      'Открывайте карточки, где вы участвуете как исполнитель или проверяющий.',
      'Быстро находите задачи по сроку, статусу и ответственным.',
    ],
  },
  {
    title: 'Все карточки',
    href: '/cards',
    icon: FolderKanban,
    description: 'Главный рабочий раздел по задачам: таблица, фильтры, канбан-доска и переход в детали карточки.',
    bullets: [
      'Карточки двигаются по статусам: новое, в работе, на проверке, выполнено, отменено.',
      'Внутри карточки можно оставлять комментарии, упоминать коллег, прикладывать результат и смотреть историю.',
    ],
  },
  {
    title: 'Инструкции',
    href: '/instructions',
    icon: BookOpen,
    description: 'База знаний по процессам, типовым операциям и внутренним правилам работы.',
    bullets: [
      'Используйте поиск и структуру разделов, чтобы быстро находить нужный материал.',
      'В инструкциях можно хранить ссылки, вложения и полезные рабочие примеры.',
    ],
  },
  {
    title: 'Компоненты',
    href: '/components',
    icon: Boxes,
    description: 'Справочник повторно используемых частей, заготовок и блоков, на которые можно ссылаться из инструкций.',
    bullets: [
      'Подходит для единых шаблонов, типовых формулировок и повторяемых решений.',
      'Помогает команде работать в одном стандарте.',
    ],
  },
  {
    title: 'Обращения',
    href: '/requests',
    icon: MessageSquareQuote,
    description: 'Канал для связи с администратором, если нужна помощь, настройка доступа или техническое действие.',
    bullets: [
      'Можно описать задачу, прикрепить ссылки и продолжить переписку прямо внутри обращения.',
      'Если администратор запросит уточнение, ответ вернёт обращение обратно в работу.',
    ],
  },
  {
    title: 'Уведомления',
    href: '/notifications',
    icon: Bell,
    description: 'Центр событий по карточкам, обращениям и другим действиям, важным для вашей роли.',
    bullets: [
      'Кнопка уведомлений всегда доступна в верхней панели.',
      'Непрочитанные события подсвечиваются числом на кнопке.',
    ],
  },
  {
    title: 'Отчёты и готовые проекты',
    href: '/reports',
    icon: FileSpreadsheet,
    description: 'Разделы для руководителей и администраторов, где можно анализировать состояние работы и готовые результаты.',
    bullets: [
      'Используйте отчёты для обзора загрузки, сроков и прогресса команды.',
      'Готовые проекты помогают быстро находить уже завершённые материалы.',
    ],
  },
] as const;

const quickStart = [
  'Войдите в портал и откройте свой рабочий раздел: кабинет, карточки или инструкции.',
  'Следите за уведомлениями в верхней панели, чтобы не пропускать назначения, проверки и комментарии.',
  'Если нужно обратиться к коллеге в тексте, используйте символ @ и выберите человека из списка.',
  'Если вы работаете с карточкой, прикладывайте результат перед переводом на проверку.',
  'Если нужен системный вопрос или помощь администратора, создайте обращение в одноимённом разделе.',
] as const;

const cardFlow = [
  {
    title: 'Новое',
    tone: 'new',
    text: 'Карточка создана и ожидает начала работы. На этом этапе руководитель обычно назначает исполнителя и проверяющего.',
  },
  {
    title: 'В работе',
    tone: 'progress',
    text: 'Исполнитель готовит результат, прикладывает материалы и общается в комментариях с участниками задачи.',
  },
  {
    title: 'На проверке',
    tone: 'review',
    text: 'Проверяющий смотрит приложенный результат, оставляет замечания или подтверждает завершение.',
  },
  {
    title: 'Выполнено',
    tone: 'done',
    text: 'Карточка успешно завершена и остаётся в истории с результатом, комментариями и всеми версиями.',
  },
  {
    title: 'Отменено',
    tone: 'cancelled',
    text: 'Работа по карточке остановлена. Причина отмены фиксируется прямо в карточке, чтобы её было легко понять позже.',
  },
] as const;

const collaborationRules = [
  'Используйте комментарии внутри карточки, если обсуждение относится к конкретной задаче.',
  'Упоминания через @ помогают адресно привлечь коллегу к действию или проверке.',
  'Если в интерфейсе вы видите слово «Вы», это означает текущего пользователя системы.',
  'UUID и внутренняя служебная разметка не предназначены для повседневной работы и скрываются в обычном интерфейсе.',
  'Если действие не получается или нужен доступ, оформляйте обращение администратору вместо устных договорённостей.',
] as const;

export default function HelpPage() {
  const { user } = useAuthStore();

  return (
    <AppLayout>
      <div className="page-container-wide">
        <section className="help-hero">
          <div className="help-hero-grid">
            <div className="help-hero-copy">
              <div className="help-badge">
                <Lightbulb className="h-4 w-4" />
                Встроенная справка
              </div>
              <h1 className="help-hero-title">Руководство пользователя портала</h1>
              <p className="help-hero-text">
                Здесь собраны основные сценарии работы с карточками, инструкциями, уведомлениями,
                обращениями и административными разделами. Страница рассчитана на ежедневное
                использование и помогает быстро понять, кто за что отвечает внутри портала.
              </p>
              <div className="help-chip-row">
                <span className="help-chip">По ролям</span>
                <span className="help-chip">По разделам</span>
                <span className="help-chip">По рабочим сценариям</span>
              </div>
            </div>

            <div className="help-hero-panel">
              <div className="help-hero-panel-label">Сейчас вы вошли как</div>
              <div className="help-hero-panel-value">
                {user?.role === 'ADMIN'
                  ? 'Администратор'
                  : user?.role === 'MANAGER'
                  ? 'Руководитель'
                  : 'Пользователь'}
              </div>
              <p className="help-hero-panel-text">
                Ниже роль выделена в отдельной карточке, чтобы было проще начать с релевантного сценария.
              </p>
            </div>
          </div>
        </section>

        <section className="help-section">
          <div className="help-section-head">
            <div>
              <div className="page-kicker">Быстрый старт</div>
              <h2 className="help-section-title">С чего начать работу в портале</h2>
            </div>
          </div>
          <div className="help-steps-grid">
            {quickStart.map((item, index) => (
              <article key={item} className="help-step-card">
                <div className="help-step-index">0{index + 1}</div>
                <p className="help-step-text">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="help-section">
          <div className="help-section-head">
            <div>
              <div className="page-kicker">Роли</div>
              <h2 className="help-section-title">Как устроена работа по ролям</h2>
            </div>
          </div>
          <div className="help-role-grid">
            {roleGuides.map((roleGuide) => {
              const Icon = roleGuide.icon;
              const isCurrentRole = user?.role === roleGuide.role;

              return (
                <article
                  key={roleGuide.role}
                  className={cn('help-role-card', isCurrentRole && 'help-role-card-current')}
                >
                  <div className="help-role-header">
                    <div className="help-role-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="help-role-title">{roleGuide.title}</h3>
                        {isCurrentRole && <span className="help-role-current">Текущая роль</span>}
                      </div>
                      <p className="help-role-summary">{roleGuide.summary}</p>
                    </div>
                  </div>
                  <ul className="help-list">
                    {roleGuide.tasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="help-section">
          <div className="help-section-head">
            <div>
              <div className="page-kicker">Разделы</div>
              <h2 className="help-section-title">Навигация по основным разделам портала</h2>
            </div>
          </div>
          <div className="help-sections-grid">
            {portalSections.map((section) => {
              const Icon = section.icon;

              return (
                <article key={section.title} className="help-section-card">
                  <div className="help-section-card-head">
                    <div className="help-section-card-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="help-section-card-title">{section.title}</h3>
                        <Link href={section.href} className="help-inline-link">
                          Открыть
                        </Link>
                      </div>
                      <p className="help-section-card-text">{section.description}</p>
                    </div>
                  </div>
                  <ul className="help-list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="help-section">
          <div className="help-section-head">
            <div>
              <div className="page-kicker">Карточки</div>
              <h2 className="help-section-title">Жизненный цикл карточки</h2>
            </div>
          </div>
          <div className="help-status-grid">
            {cardFlow.map((stage) => (
              <article key={stage.title} className={cn('help-status-card', `help-status-card-${stage.tone}`)}>
                <div className="help-status-title-row">
                  <CheckCircle2 className="h-4 w-4" />
                  <h3 className="help-status-title">{stage.title}</h3>
                </div>
                <p className="help-status-text">{stage.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="help-section">
          <div className="help-section-head">
            <div>
              <div className="page-kicker">Коммуникация</div>
              <h2 className="help-section-title">Комментарии, уведомления и обращения</h2>
            </div>
          </div>
          <div className="help-two-column">
            <article className="help-note-card">
              <div className="help-note-icon">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="help-note-title">Правила удобной работы</h3>
              <ul className="help-list">
                {collaborationRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>

            <article className="help-note-card">
              <div className="help-note-icon">
                <Bell className="h-5 w-5" />
              </div>
              <h3 className="help-note-title">Когда что использовать</h3>
              <ul className="help-list">
                <li>Комментарий в карточке: если обсуждение относится к конкретной задаче и её результату.</li>
                <li>Уведомления: чтобы быстро увидеть новые назначения, изменения статусов и ответы по обращениям.</li>
                <li>Обращение администратору: если нужен доступ, изменение настроек или помощь с системой.</li>
                <li>Инструкции: если нужно оформить повторяемое знание и дать коллегам единый порядок действий.</li>
              </ul>
            </article>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
