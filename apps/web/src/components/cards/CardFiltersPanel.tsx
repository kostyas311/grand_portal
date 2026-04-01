'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { SprintItem } from '@/lib/api/sprints';

type BaseFilters = {
  search: string;
  status: string;
  sprintId: string;
  priority: string;
  dataSourceId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  isArchived?: boolean;
};

type SourceOption = {
  id: string;
  name: string;
};

interface CardFiltersPanelProps {
  filters: BaseFilters;
  sprints?: SprintItem[];
  defaultSprintId: string;
  onChange: (key: string, value: any) => void;
  onReset: () => void;
  sources?: SourceOption[];
  showDataSource?: boolean;
  showDueDateRange?: boolean;
  showArchive?: boolean;
  searchPlaceholder?: string;
  defaultCollapsed?: boolean;
  autoExpandOnActive?: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'NEW', label: 'Новое' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'REVIEW', label: 'На проверке' },
  { value: 'DONE', label: 'Готово' },
  { value: 'CANCELLED', label: 'Отменено' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Все приоритеты' },
  { value: 'OPTIONAL', label: 'Желательно' },
  { value: 'NORMAL', label: 'В рабочем режиме' },
  { value: 'URGENT', label: 'Срочно' },
  { value: 'CRITICAL', label: 'Очень срочно' },
];

export function CardFiltersPanel({
  filters,
  sprints,
  defaultSprintId,
  onChange,
  onReset,
  sources,
  showDataSource = false,
  showDueDateRange = false,
  showArchive = false,
  searchPlaceholder = 'Поиск...',
  defaultCollapsed = false,
  autoExpandOnActive = true,
}: CardFiltersPanelProps) {
  const sprintName = sprints?.find((sprint) => sprint.id === filters.sprintId)?.name;

  const advancedCount = useMemo(() => {
    let count = 0;
    if (filters.sprintId !== defaultSprintId) count += 1;
    if (filters.priority) count += 1;
    if (showDataSource && filters.dataSourceId) count += 1;
    if (showDueDateRange && (filters.dueDateFrom || filters.dueDateTo)) count += 1;
    if (showArchive && filters.isArchived) count += 1;
    return count;
  }, [
    defaultSprintId,
    filters.dataSourceId,
    filters.dueDateFrom,
    filters.dueDateTo,
    filters.isArchived,
    filters.priority,
    filters.sprintId,
    showArchive,
    showDataSource,
    showDueDateRange,
  ]);

  const [expanded, setExpanded] = useState(defaultCollapsed ? false : advancedCount > 0);

  useEffect(() => {
    if (autoExpandOnActive && advancedCount > 0) {
      setExpanded(true);
    }
  }, [advancedCount, autoExpandOnActive]);

  const sourceName = sources?.find((source) => source.id === filters.dataSourceId)?.name;
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === filters.status)?.label;
  const priorityLabel = PRIORITY_OPTIONS.find((option) => option.value === filters.priority)?.label;

  return (
    <div className="card mb-4">
      <div className="card-body space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="input pl-9"
              value={filters.search}
              onChange={(e) => onChange('search', e.target.value)}
            />
          </div>

          <select
            className="input w-full xl:w-[220px]"
            value={filters.status}
            onChange={(e) => onChange('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm px-4"
              onClick={() => setExpanded((value) => !value)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
              {advancedCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[11px]">
                  {advancedCount}
                </span>
              )}
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button type="button" className="btn-ghost text-sm px-3" onClick={onReset}>
              <RotateCcw className="w-4 h-4" />
              Сбросить
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="page-chip">Спринт: {sprintName || 'Не выбран'}</span>
          {filters.status && <span className="page-chip">Статус: {statusLabel}</span>}
          {filters.priority && <span className="page-chip">Приоритет: {priorityLabel}</span>}
          {showDataSource && sourceName && <span className="page-chip">Источник: {sourceName}</span>}
          {showDueDateRange && (filters.dueDateFrom || filters.dueDateTo) && (
            <span className="page-chip">
              Срок: {filters.dueDateFrom || '...'} - {filters.dueDateTo || '...'}
            </span>
          )}
          {showArchive && filters.isArchived && <span className="page-chip">Архив включен</span>}
        </div>

        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="label">Спринт</label>
              <select
                className="input"
                value={filters.sprintId}
                onChange={(e) => onChange('sprintId', e.target.value)}
              >
                {sprints?.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Приоритет</label>
              <select
                className="input"
                value={filters.priority}
                onChange={(e) => onChange('priority', e.target.value)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {showDataSource && (
              <div>
                <label className="label">Источник</label>
                <select
                  className="input"
                  value={filters.dataSourceId || ''}
                  onChange={(e) => onChange('dataSourceId', e.target.value)}
                >
                  <option value="">Все источники</option>
                  {sources?.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>
            )}

            {showDueDateRange && (
              <>
                <div>
                  <label className="label">Срок от</label>
                  <input
                    type="date"
                    className="input"
                    value={filters.dueDateFrom || ''}
                    onChange={(e) => onChange('dueDateFrom', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Срок до</label>
                  <input
                    type="date"
                    className="input"
                    value={filters.dueDateTo || ''}
                    onChange={(e) => onChange('dueDateTo', e.target.value)}
                  />
                </div>
              </>
            )}

            {showArchive && (
              <label className="soft-note flex items-center gap-3 cursor-pointer self-end">
                <input
                  type="checkbox"
                  checked={Boolean(filters.isArchived)}
                  onChange={(e) => onChange('isArchived', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Показать архив</div>
                  <div className="text-xs text-gray-500">Включает отменённые и архивные карточки</div>
                </div>
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
