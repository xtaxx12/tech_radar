type Props = {
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
};

export function EventsEmptyState({
  title = 'No encontramos eventos que coincidan',
  description = 'Prueba ajustando tu perfil o cambiando los filtros de fuente y ubicación.',
  onReset,
  resetLabel = 'Limpiar filtros'
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
      {onReset ? (
        <button type="button" className="secondary-button" onClick={onReset}>
          {resetLabel}
        </button>
      ) : null}
    </div>
  );
}
