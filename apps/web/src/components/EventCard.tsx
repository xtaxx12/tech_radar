import type { RankedEvent } from '../types';
import { formatLongDate } from '../utils';

type Props = {
  event: RankedEvent;
  featured?: boolean;
  onOpen: () => void;
};

export function EventCard({ event, featured = false, onOpen }: Props) {
  return (
    <article className={featured ? 'event-card event-card-featured' : 'event-card'}>
      <div className="event-card-topline">
        <div className="badges">
          {event.badges.map((badge) => (
            <span key={badge} className="badge">
              {badge}
            </span>
          ))}
        </div>
        <div className="score-pill">{event.score}</div>
      </div>

      <h3>{event.title}</h3>
      <p className="muted">{event.summary}</p>

      <div className="event-meta">
        <span>{formatLongDate(event.date)}</span>
        <span>{event.city}, {event.country}</span>
        <span>{event.source}</span>
      </div>

      <div className="reason-list">
        {event.reasons.slice(0, 3).map((reason) => (
          <div key={reason} className="reason-item">
            {reason}
          </div>
        ))}
      </div>

      <div className="tag-row">
        {event.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="tag">
            #{tag}
          </span>
        ))}
      </div>

      <button className="text-link-button" type="button" onClick={onOpen}>
        Abrir evento
      </button>
    </article>
  );
}
