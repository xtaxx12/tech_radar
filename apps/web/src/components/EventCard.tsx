import { memo, type MouseEvent } from 'react';
import type { RankedEvent } from '../types';
import { formatLongDate } from '../utils';

type Props = {
  event: RankedEvent;
  featured?: boolean;
  compact?: boolean;
  onOpen: () => void;
  favorite?: boolean;
  canFavorite?: boolean;
  onToggleFavorite?: () => void;
};

function EventCardBase({
  event,
  featured = false,
  compact = false,
  onOpen,
  favorite = false,
  canFavorite = false,
  onToggleFavorite
}: Props) {
  const className = [
    'event-card',
    featured ? 'event-card-featured' : '',
    compact ? 'event-card-compact' : ''
  ].filter(Boolean).join(' ');

  const handleFavoriteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFavorite?.();
  };

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
        <div className="event-card-topright">
          {canFavorite ? (
            <button
              type="button"
              className={favorite ? 'favorite-btn favorite-btn-active' : 'favorite-btn'}
              onClick={handleFavoriteClick}
              aria-pressed={favorite}
              aria-label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              title={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            >
              <HeartIcon filled={favorite} />
            </button>
          ) : null}
          <div className="score-pill" aria-label={`Score ${event.score}`}>{event.score}</div>
        </div>
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 21s-7.5-4.7-10-9.5C.3 8 2 4 5.5 4c2 0 3.5 1 4.5 2.5C11 5 12.5 4 14.5 4 18 4 19.7 8 18 11.5 17.7 12.3 12 21 12 21z"
        fill={filled ? 'currentColor' : 'transparent'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const EventCard = memo(EventCardBase);
