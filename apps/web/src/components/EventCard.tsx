import { memo } from 'react';
import type { RankedEvent } from '../types';
import { formatLongDate } from '../utils';

type Props = {
  event: RankedEvent;
  featured?: boolean;
  compact?: boolean;
  onOpen: () => void;
};

function EventCardBase({ event, featured = false, compact = false, onOpen }: Props) {
  const className = [
    'event-card',
    featured ? 'event-card-featured' : '',
    compact ? 'event-card-compact' : ''
  ].filter(Boolean).join(' ');

  return (
    <article className={className}>
      <div className="event-card-topline">
        <div className="badges">
          {event.badges.map((badge, index) => (
            <span key={`${badge}-${index}`} className="badge">
              {badge}
            </span>
          ))}
        </div>
        <div className="score-pill" aria-label={`Score ${event.score}`}>{event.score}</div>
      </div>

      <h3>{event.title}</h3>

      {compact ? (
        <div className="event-meta">
          <span>{event.city}, {event.country}</span>
          <span>{event.source}</span>
        </div>
      ) : (
        <>
          <p className="muted">{event.summary}</p>

          <div className="event-meta">
            <span>{formatLongDate(event.date)}</span>
            <span>{event.city}, {event.country}</span>
            <span>{event.source}</span>
          </div>

          <div className="reason-list">
            {event.reasons.slice(0, 3).map((reason, index) => (
              <div key={index} className="reason-item">
                {reason}
              </div>
            ))}
          </div>

          <div className="tag-row">
            {event.tags.slice(0, 4).map((tag, index) => (
              <span key={`${tag}-${index}`} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        </>
      )}

      <button className="text-link-button" type="button" onClick={onOpen}>
        Abrir evento →
      </button>
    </article>
  );
}

export const EventCard = memo(EventCardBase);
