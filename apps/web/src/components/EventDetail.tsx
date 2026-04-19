import type { RankedEvent } from '../types';
import { formatLongDate } from '../utils';

type Props = {
  event: RankedEvent;
  onBack: () => void;
};

export function EventDetail({ event, onBack }: Props) {
  const reasons = event.reasons?.length ? event.reasons : ['No hay razones detalladas para este evento todavía.'];
  const tags = event.tags?.length ? event.tags : [];
  const mapQuery = encodeURIComponent(`${event.city}, ${event.country}`);
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <main className="detail-shell">
      <section className="panel detail-panel">
        <button className="secondary-button" type="button" onClick={onBack}>
          Volver al radar
        </button>

        <div className="detail-header">
          <div>
            <div className="eyebrow">Detalle del evento</div>
            <h1>{event.title}</h1>
            <p className="muted">{event.summary}</p>
          </div>
          <div className="score-pill">Score {event.score}</div>
        </div>

        <div className="detail-meta-grid">
          <div className="metric-card detail-info-card">
            <span className="detail-info-label">Cuándo</span>
            <strong>{formatLongDate(event.date)}</strong>
            <span className="detail-info-subtitle">Fecha y hora del evento</span>
          </div>
          <div className="metric-card detail-info-card">
            <span className="detail-info-label">Dónde</span>
            <strong>{event.city}, {event.country}</strong>
            <span className="detail-info-subtitle">Ubicación principal</span>
            <a className="detail-map-link" href={mapLink} target="_blank" rel="noreferrer">
              Ver en Maps
            </a>
          </div>
          <div className="metric-card detail-info-card">
            <span className="detail-info-label">Nivel</span>
            <strong>{event.level}</strong>
            <span className="detail-info-subtitle">Nivel requerido</span>
          </div>
          <div className="metric-card detail-info-card">
            <span className="detail-info-label">Fuente</span>
            <strong>{event.source}</strong>
            <span className="detail-info-subtitle">Origen del evento</span>
          </div>
        </div>

        <div className="detail-section">
          <h2>Descripción</h2>
          <p>{event.description}</p>
        </div>

        <div className="detail-section">
          <h2>Por qué te lo recomendamos</h2>
          <div className="reason-list">
            {reasons.map((reason) => (
              <div key={reason} className="reason-item">{reason}</div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2>Etiquetas</h2>
          <div className="tag-row">
            {tags.map((tag) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        </div>

        <a className="primary-button detail-link" href={event.link} target="_blank" rel="noreferrer">
          Abrir enlace del evento
        </a>
      </section>
    </main>
  );
}
