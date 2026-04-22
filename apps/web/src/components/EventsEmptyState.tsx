import type { SyncResultPayload } from '../types';

type Props = {
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
  syncStatus?: SyncResultPayload | null;
  syncRunning?: boolean;
  onRetrySync?: () => void;
};

const SOURCE_LABELS: Record<string, string> = {
  meetup: 'Meetup',
  eventbrite: 'Eventbrite',
  gdg: 'GDG',
  community: 'Comunidad'
};

export function EventsEmptyState({
  title = 'No encontramos eventos que coincidan',
  description = 'Prueba ajustando tu perfil o cambiando los filtros de fuente y ubicación.',
  onReset,
  resetLabel = 'Limpiar filtros',
  syncStatus,
  syncRunning,
  onRetrySync
}: Props) {
  const hasReset = Boolean(onReset);
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-illustration" aria-hidden="true">
        <svg viewBox="0 0 120 100" width="120" height="100" fill="none">
          <rect x="20" y="20" width="80" height="55" rx="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
          <circle cx="60" cy="42" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <path d="M70 52 L82 64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M54 42 H66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          <circle cx="38" cy="68" r="3" fill="currentColor" opacity="0.15" />
          <circle cx="85" cy="30" r="2.5" fill="currentColor" opacity="0.12" />
          <path d="M30 80 Q60 72 90 80" stroke="currentColor" strokeWidth="1" opacity="0.2" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p className="muted">
        {hasReset
          ? 'Prueba ampliando tus filtros o buscando con otros términos.'
          : description}
      </p>

      {syncStatus ? (
        <div className="empty-state-sources" aria-label="Estado de las fuentes">
          {syncStatus.sources.map((source) => {
            const healthy = source.count > 0 && !source.error;
            return (
              <div
                key={source.source}
                className={`source-chip ${healthy ? 'source-chip-ok' : 'source-chip-warn'}`}
              >
                <span className="source-chip-name">{SOURCE_LABELS[source.source] ?? source.source}</span>
                <span className="source-chip-detail">
                  {source.count > 0 ? `${source.count} eventos` : source.error ?? '0 eventos'}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="empty-state-actions">
        {onRetrySync ? (
          <button
            type="button"
            className="primary-button"
            onClick={onRetrySync}
            disabled={syncRunning}
          >
            {syncRunning ? 'Sincronizando…' : 'Reintentar sincronización'}
          </button>
        ) : null}
        {onReset ? (
          <button type="button" className="secondary-button" onClick={onReset}>
            {resetLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
