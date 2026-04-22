import { useEffect, useRef, type KeyboardEvent } from 'react';
import { GoogleSignIn } from '../auth/GoogleSignIn';
import type { ChatResponse, RankedEvent, UserProfile } from '../types';
import { formatShortDate } from '../utils';
import { MarkdownText } from './MarkdownText';

type RateLimitState = {
  scope: 'per_second' | 'per_hour';
  message: string;
};

type Props = {
  profile: UserProfile;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  response: ChatResponse | null;
  error: string | null;
  rateLimit?: RateLimitState | null;
  onOpenEvent: (eventId: string) => void;
  loginRequired?: boolean;
  onReset?: () => void;
};

const promptShortcuts = [
  'Eventos de IA esta semana en Ecuador para junior',
  'Meetups de frontend en México para mid level',
  'Eventos de data en Perú este mes',
  '¿Qué hay de cloud en Colombia?',
  '¿Eventos de Flutter en Quito?'
];

export function ChatPanel({
  profile,
  message,
  onMessageChange,
  onSubmit,
  loading,
  response,
  error,
  rateLimit,
  onOpenEvent,
  loginRequired = false,
  onReset
}: Props) {
  const placeholder = `Pregunta: eventos de IA en ${profile.country} para ${profile.level}…`;
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = message.trim().length > 0 && !loading;

  // Auto-scroll cuando llega respuesta nueva o un error — el user no
  // debería tener que scrollear manualmente.
  useEffect(() => {
    if (!conversationRef.current) return;
    conversationRef.current.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [response, loading, error, rateLimit]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  if (loginRequired) {
    return (
      <section className="panel chat-panel chat-panel-gated" aria-label="Chat IA (requiere iniciar sesión)">
        <div className="chat-header">
          <div className="chat-header-avatar" aria-hidden="true"><IconSparkle /></div>
          <div>
            <div className="eyebrow">Chat IA</div>
            <h2>Inicia sesión para chatear</h2>
          </div>
        </div>
        <div className="chat-preview" aria-hidden="true">
          <div className="chat-preview-bubble chat-preview-user">
            <span className="chat-preview-icon"><IconUser /></span>
            <span>¿Qué eventos de Flutter hay este mes?</span>
          </div>
          <div className="chat-preview-bubble chat-preview-ai">
            <span className="chat-preview-icon"><IconSparkle /></span>
            <span>Encontré 3 eventos de Flutter en Ecuador este mes. El más relevante es...</span>
          </div>
        </div>
        <p className="muted chat-gate-copy">
          Limitamos el chat a usuarios autenticados para cuidar el presupuesto del modelo.
          El resto del radar sigue público.
        </p>
        <div className="chat-gate-signin">
          <GoogleSignIn />
        </div>
      </section>
    );
  }

  const hasConversation = Boolean(response || loading || error || rateLimit);

  return (
    <section className="panel chat-panel" aria-label="Chat IA de recomendación de eventos">
      <header className="chat-header">
        <div className="chat-header-avatar" aria-hidden="true"><IconSparkle /></div>
        <div className="chat-header-copy">
          <div className="eyebrow">Chat IA</div>
          <h2>Busca eventos como si hablaras con un curador local.</h2>
        </div>
        {response ? (
          <button
            type="button"
            className="chat-reset-btn"
            onClick={() => {
              onMessageChange('');
              onReset?.();
              textareaRef.current?.focus();
            }}
            aria-label="Nueva consulta"
            title="Nueva consulta"
          >
            <IconPlus />
          </button>
        ) : null}
      </header>

      {!hasConversation ? (
        <div className="chat-suggestions" role="group" aria-label="Sugerencias de consulta">
          <span className="chat-suggestions-label">Prueba con:</span>
          <div className="chat-suggestions-scroll">
            {promptShortcuts.map((shortcut, index) => (
              <button
                key={index}
                type="button"
                className="chat-suggestion"
                onClick={() => {
                  onMessageChange(shortcut);
                  textareaRef.current?.focus();
                }}
              >
                {shortcut}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="chat-conversation" ref={conversationRef}>
        {response ? (
          <>
            <ChatBubble role="user" text={response.interpretation.originalMessage} />
            <ChatBubble role="ai">
              {hasFilters(response) ? (
                <div className="chat-filter-chips" aria-label="Filtros detectados">
                  {filterChips(response).map((chip) => (
                    <span key={`${chip.label}-${chip.value}`} className="chat-filter-chip">
                      <span className="chat-filter-chip-label">{chip.label}</span>
                      <span className="chat-filter-chip-value">{chip.value}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              <MarkdownText text={response.answer} className="chat-bubble-markdown" />
              {response.events.length > 0 ? (
                <div className="chat-results">
                  {response.events.slice(0, 4).map((event) => (
                    <ChatEventCard
                      key={event.id}
                      event={event}
                      onOpen={() => onOpenEvent(event.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="chat-no-results">No encontramos eventos que matcheen esos filtros.</div>
              )}
            </ChatBubble>
          </>
        ) : null}

        {loading ? (
          <ChatBubble role="ai">
            <div className="chat-typing" aria-live="polite" aria-label="La IA está escribiendo">
              <span />
              <span />
              <span />
            </div>
          </ChatBubble>
        ) : null}

        {rateLimit ? (
          <div
            className={`chat-rate-limit chat-rate-limit-${rateLimit.scope}`}
            role="status"
            aria-live="polite"
          >
            <span className="chat-rate-limit-icon" aria-hidden="true">⏱</span>
            <div className="chat-rate-limit-copy">
              <strong>
                {rateLimit.scope === 'per_second' ? 'Demasiado rápido' : 'Límite por hora alcanzado'}
              </strong>
              <span>{rateLimit.message}</span>
            </div>
          </div>
        ) : null}

        {error && !rateLimit ? (
          <div className="chat-error" role="alert">
            <strong>No pudimos consultar la IA.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {!hasConversation ? (
          <div className="chat-empty">
            <span className="chat-empty-icon" aria-hidden="true"><IconMessage /></span>
            <p>Tu conversación aparecerá aquí con eventos filtrados y una explicación automática.</p>
          </div>
        ) : null}
      </div>

      <div className="chat-composer">
        <textarea
          ref={textareaRef}
          rows={2}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Mensaje para la IA"
          disabled={loading}
        />
        <div className="chat-composer-meta">
          <span className="chat-composer-hint">
            <kbd>Enter</kbd> para enviar · <kbd>Shift</kbd>+<kbd>Enter</kbd> para salto de línea
          </span>
          <button
            type="button"
            className={`chat-send-btn ${canSend ? 'chat-send-btn-active' : ''}`}
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Enviar consulta al chat IA"
          >
            {loading ? <SpinnerIcon /> : <IconSend />}
          </button>
        </div>
      </div>
    </section>
  );
}

function ChatEventCard({ event, onOpen }: { event: RankedEvent; onOpen: () => void }) {
  const isGdg = event.source === 'gdg';
  return (
    <button
      type="button"
      className="chat-event-card"
      onClick={onOpen}
      aria-label={`Abrir ${event.title}`}
    >
      <div className="chat-event-card-head">
        <span className={`chat-event-score ${event.score >= 85 ? 'chat-event-score-hot' : ''}`}>
          {event.score}
        </span>
        <span className="chat-event-title">{event.title}</span>
      </div>
      <div className="chat-event-meta">
        <span>{formatShortDate(event.date)}</span>
        <span aria-hidden="true">·</span>
        <span>{event.city}, {event.country}</span>
        {isGdg ? <span className="chat-event-source">GDG</span> : null}
      </div>
    </button>
  );
}

function ChatBubble({ role, text, children }: { role: 'user' | 'ai'; text?: string; children?: React.ReactNode }) {
  return (
    <div className={`chat-bubble chat-bubble-${role}`}>
      <div className="chat-bubble-avatar" aria-hidden="true">
        {role === 'user' ? <IconUser /> : <IconSparkle />}
      </div>
      <div className="chat-bubble-body">
        {text ? <p className="chat-bubble-text">{text}</p> : null}
        {children}
      </div>
    </div>
  );
}

type FilterChip = { label: string; value: string };

function filterChips(response: ChatResponse): FilterChip[] {
  const { interpretation } = response;
  const chips: FilterChip[] = [];
  if (interpretation.country) chips.push({ label: 'País', value: interpretation.country });
  if (interpretation.city) chips.push({ label: 'Ciudad', value: interpretation.city });
  if (interpretation.role) chips.push({ label: 'Rol', value: interpretation.role });
  if (interpretation.level) chips.push({ label: 'Nivel', value: interpretation.level });
  if (interpretation.interests.length > 0) {
    chips.push({ label: 'Intereses', value: interpretation.interests.join(', ') });
  }
  return chips;
}

function hasFilters(response: ChatResponse): boolean {
  return filterChips(response).length > 0;
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
      <circle cx="19" cy="4" r="1.5" />
      <circle cx="5" cy="20" r="1.2" opacity="0.7" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l16-8-7 16-2-7-7-1z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 2 1.5-4.5A8 8 0 1 1 21 12z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="chat-spinner" aria-hidden="true">
      <path d="M12 4a8 8 0 0 1 8 8" />
    </svg>
  );
}
