# Database Schema — NormBase Portal

## Технология
PostgreSQL 15 + Prisma ORM

## Схема

### users
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role        VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN','COORDINATOR','EXECUTOR','REVIEWER')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

### data_sources (справочник источников)
```sql
CREATE TABLE data_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_sources_is_active ON data_sources(is_active);
CREATE INDEX idx_data_sources_name ON data_sources(name);
```

### cards (основная таблица карточек)
```sql
CREATE TABLE cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       VARCHAR(20) UNIQUE NOT NULL, -- читаемый ID типа "NB-2024-001"
  data_source_id  UUID NOT NULL REFERENCES data_sources(id),
  extra_title     VARCHAR(255), -- дополнительное название
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  description     TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW','IN_PROGRESS','REVIEW','DONE','CANCELLED')),
  priority        VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
                  CHECK (priority IN ('OPTIONAL','NORMAL','URGENT','CRITICAL')),
  due_date        DATE,
  executor_id     UUID REFERENCES users(id),   -- текущий исполнитель
  reviewer_id     UUID REFERENCES users(id),   -- назначенный проверяющий
  created_by      UUID NOT NULL REFERENCES users(id),
  last_changed_by UUID REFERENCES users(id),
  is_locked       BOOLEAN NOT NULL DEFAULT false,
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  cancel_reason   TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_data_source_id ON cards(data_source_id);
CREATE INDEX idx_cards_executor_id ON cards(executor_id);
CREATE INDEX idx_cards_reviewer_id ON cards(reviewer_id);
CREATE INDEX idx_cards_created_by ON cards(created_by);
CREATE INDEX idx_cards_due_date ON cards(due_date);
CREATE INDEX idx_cards_priority ON cards(priority);
CREATE INDEX idx_cards_year_month ON cards(year, month);
CREATE INDEX idx_cards_is_archived ON cards(is_archived);
CREATE INDEX idx_cards_is_locked ON cards(is_locked);
-- Полнотекстовый поиск
CREATE INDEX idx_cards_fts ON cards USING gin(
  to_tsvector('russian', coalesce(extra_title,'') || ' ' || coalesce(description,''))
);
```

### source_materials (исходные материалы карточки)
```sql
CREATE TABLE source_materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('FILE','EXTERNAL_LINK')),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  -- для FILE:
  file_path     VARCHAR(1000),  -- относительный путь в storage/
  file_name     VARCHAR(255),   -- оригинальное имя файла
  file_size     BIGINT,         -- в байтах
  mime_type     VARCHAR(100),
  file_hash     VARCHAR(64),    -- SHA-256 для дедупликации
  -- для EXTERNAL_LINK:
  external_url  VARCHAR(2000),
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_materials_card_id ON source_materials(card_id);
```

### result_versions (версии результата)
```sql
CREATE TABLE result_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  version_number  SMALLINT NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment         TEXT,           -- комментарий к версии (причина доработки)
  status_context  VARCHAR(30),    -- статус карточки при создании версии
  is_current      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (card_id, version_number)
);

CREATE INDEX idx_result_versions_card_id ON result_versions(card_id);
CREATE INDEX idx_result_versions_is_current ON result_versions(is_current);
```

### result_items (элементы результата — файлы и ссылки)
```sql
CREATE TABLE result_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_version_id UUID NOT NULL REFERENCES result_versions(id) ON DELETE CASCADE,
  item_type         VARCHAR(20) NOT NULL CHECK (item_type IN ('FILE','EXTERNAL_LINK')),
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  -- для FILE:
  file_path         VARCHAR(1000),
  file_name         VARCHAR(255),
  file_size         BIGINT,
  mime_type         VARCHAR(100),
  file_hash         VARCHAR(64),
  -- для EXTERNAL_LINK:
  external_url      VARCHAR(2000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_result_items_result_version_id ON result_items(result_version_id);
```

### card_history (история действий)
```sql
CREATE TABLE card_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  -- action_type values:
  -- CREATED, STATUS_CHANGED, EXECUTOR_CHANGED, REVIEWER_CHANGED,
  -- SOURCE_MATERIAL_ADDED, SOURCE_MATERIAL_REMOVED,
  -- RESULT_ADDED, RETURNED_WITH_ERRORS, COMPLETED, CANCELLED,
  -- FIELD_UPDATED
  old_value   JSONB,
  new_value   JSONB,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_history_card_id ON card_history(card_id);
CREATE INDEX idx_card_history_user_id ON card_history(user_id);
CREATE INDEX idx_card_history_action_type ON card_history(action_type);
CREATE INDEX idx_card_history_created_at ON card_history(created_at);
```

### review_comments (комментарии проверки)
```sql
CREATE TABLE review_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id           UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES users(id),
  result_version_id UUID REFERENCES result_versions(id),  -- привязка к версии (опционально)
  text              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_comments_card_id ON review_comments(card_id);
CREATE INDEX idx_review_comments_author_id ON review_comments(author_id);
```

## Нумерация public_id

Формат: `NB-{YEAR}-{SEQ:04d}` например `NB-2024-0001`

Реализация через PostgreSQL sequence:
```sql
CREATE SEQUENCE cards_public_id_seq START 1;
```

В триггере или application layer при создании карточки:
```sql
public_id = 'NB-' || EXTRACT(YEAR FROM now()) || '-' || LPAD(nextval('cards_public_id_seq')::text, 4, '0');
```

## Стратегия файлового хранилища

```
storage/
├── source-materials/
│   └── {card_id}/
│       └── {uuid}_{sanitized_filename}
└── results/
    └── {card_id}/
        └── v{version_number}/
            └── {uuid}_{sanitized_filename}
```

Правила:
- Имя файла в хранилище: `{uuid}_{sanitized_original_name}`
- UUID гарантирует уникальность
- Sanitized name: только `[a-zA-Z0-9._-]`, пробелы → `_`, длина ≤ 200 символов
- Оригинальное имя хранится в БД (file_name)
- SHA-256 hash для проверки целостности
- Максимальный размер файла: настраивается через ENV (по умолчанию 500MB)
