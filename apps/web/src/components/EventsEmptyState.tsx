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
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="28" cy="28" r="16" />
          <path d="M40 40 L52 52" />
          <path d="M22 28 H34" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>

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
