import { useMemo, useState } from 'react';
import type { RankedEvent } from '../types';
import { formatLongDate } from '../utils';

type Props = {
  event: RankedEvent;
  onBack: () => void;
};

const SOURCE_LABELS: Record<string, string> = {
  meetup: 'Meetup',
  eventbrite: 'Eventbrite',
  gdg: 'GDG',
  community: 'Comunidad'
};

export function EventDetail({ event, onBack }: Props) {
  const [copied, setCopied] = useState(false);

  const reasons = event.reasons?.length ? event.reasons : ['No hay razones detalladas para este evento todavía.'];
  const tags = event.tags ?? [];
  const mapQuery = encodeURIComponent(`${event.city}, ${event.country}`);
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const countdown = useMemo(() => buildCountdown(event.date), [event.date]);
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source;

  const handleShare = async () => {
    const shareData = {
      title: event.title,
      text: event.summary || `${event.title} · ${event.city}, ${event.country}`,
      url: event.link || window.location.href
    };
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copia el enlace:', shareData.url);
    }
  };

  const handleCalendar = () => {
    const ics = buildIcs(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(event.title)}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="detail-shell">
      <section className="panel detail-panel">
        <nav className="detail-topbar" aria-label="Navegación del detalle">
          <button className="back-chip" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span>
            <span>Radar</span>
          </button>
          <div className="breadcrumb" aria-label="Ruta">
            <span>Eventos</span>
            <span aria-hidden="true">/</span>
            <span className="breadcrumb-current">{event.city}</span>
          </div>
        </nav>

        <header className="detail-hero">
          <div className="detail-hero-copy">
            <div className="detail-badges">
              <span className={`rank-pill rank-${rankModifier(event.score)}`}>{event.rankLabel}</span>
              {event.badges?.map((badge, index) => (
                <span key={`${badge}-${index}`} className="badge">{badge}</span>
              ))}
            </div>
            <h1>{event.title}</h1>
            {event.summary ? <p className="detail-summary">{event.summary}</p> : null}
            {countdown ? <div className={`countdown-chip countdown-${countdown.tone}`}>{countdown.label}</div> : null}
          </div>
          <div className="detail-score-card">
            <span className="detail-score-label">Score</span>
            <strong>{event.score}</strong>
            <span className="detail-score-foot">{event.rankLabel}</span>
          </div>
        </header>

        <div className="detail-meta-grid">
          <MetaCard icon={<IconCalendar />} label="Cuándo" primary={formatLongDate(event.date)} />
          <MetaCard
            icon={<IconPin />}
            label="Dónde"
            primary={`${event.city}, ${event.country}`}
            action={{ href: mapLink, label: 'Abrir en Maps' }}
          />
          <MetaCard icon={<IconLevel />} label="Nivel" primary={formatLevel(event.level)} />
          <MetaCard icon={<IconSource />} label="Fuente" primary={sourceLabel} />
        </div>

        <section className="detail-section">
          <h2>Descripción</h2>
          <p className="detail-paragraph">{event.description || 'Sin descripción disponible para este evento.'}</p>
        </section>

        <section className="detail-section">
          <h2>Por qué te lo recomendamos</h2>
          <ol className="reason-ordered">
            {reasons.map((reason, index) => (
              <li key={index}>
                <span className="reason-index" aria-hidden="true">{index + 1}</span>
                <span>{reason}</span>
              </li>
            ))}
          </ol>
        </section>

        {tags.length > 0 ? (
          <section className="detail-section">
            <h2>Etiquetas</h2>
            <div className="tag-row">
              {tags.map((tag, index) => (
                <span key={`${tag}-${index}`} className="tag">#{tag}</span>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="detail-actions">
          <a
            className="primary-button detail-primary-cta"
            href={event.link}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span>Abrir evento</span>
            <span aria-hidden="true">↗</span>
          </a>
          <button type="button" className="secondary-button detail-secondary-cta" onClick={handleCalendar}>
            <IconCalendarPlus />
            <span>Añadir al calendario</span>
          </button>
          <button type="button" className="secondary-button detail-secondary-cta" onClick={handleShare}>
            <IconShare />
            <span>{copied ? 'Enlace copiado' : 'Compartir'}</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

type MetaCardProps = {
  icon: React.ReactNode;
  label: string;
  primary: string;
  action?: { href: string; label: string };
};

function MetaCard({ icon, label, primary, action }: MetaCardProps) {
  return (
    <div className="detail-meta-card">
      <div className="detail-meta-icon" aria-hidden="true">{icon}</div>
      <div className="detail-meta-body">
        <span className="detail-meta-label">{label}</span>
        <strong>{primary}</strong>
        {action ? (
          <a className="detail-meta-link" href={action.href} target="_blank" rel="noreferrer">
            {action.label} ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

function formatLevel(level: string): string {
  if (level === 'all') return 'Todos los niveles';
  if (level === 'junior') return 'Junior';
  if (level === 'mid') return 'Mid';
  if (level === 'senior') return 'Senior';
  return level;
}

function rankModifier(score: number): 'hot' | 'warm' | 'cool' {
  if (score >= 85) return 'hot';
  if (score >= 65) return 'warm';
  return 'cool';
}

function buildCountdown(dateIso: string): { label: string; tone: 'past' | 'soon' | 'upcoming' } | null {
  const eventDate = new Date(dateIso);
  if (Number.isNaN(eventDate.getTime())) return null;
  const diffMs = eventDate.getTime() - Date.now();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (days < -1) return { label: `Sucedió hace ${Math.abs(days)} días`, tone: 'past' };
  if (days === -1) return { label: 'Fue ayer', tone: 'past' };
  if (days === 0) return { label: 'Es hoy', tone: 'soon' };
  if (days === 1) return { label: 'Es mañana', tone: 'soon' };
  if (days <= 7) return { label: `En ${days} días`, tone: 'soon' };
  if (days <= 30) return { label: `En ${days} días`, tone: 'upcoming' };
  const weeks = Math.round(days / 7);
  if (weeks <= 8) return { label: `En ${weeks} semanas`, tone: 'upcoming' };
  const months = Math.round(days / 30);
  return { label: `En ${months} meses`, tone: 'upcoming' };
}

function buildIcs(event: RankedEvent): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = formatIcsDate(new Date());
  const description = (event.description || event.summary || '').replace(/\r?\n/g, '\\n');
  const location = `${event.city}, ${event.country}`;
  const url = event.link;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tech Radar LATAM//ES',
    'BEGIN:VEVENT',
    `UID:${event.id}@tech-radar-latam`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'evento';
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconLevel() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20v-6M12 20V8M20 20V4" />
    </svg>
  );
}

function IconSource() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function IconCalendarPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14v5M9.5 16.5h5" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
