import { GoogleSignIn } from '../auth/GoogleSignIn';
import type { ChatResponse, UserProfile } from '../types';
import { EventCard } from './EventCard';

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
};

const promptShortcuts = [
  'Eventos de IA esta semana en Ecuador para junior',
  'Meetups de frontend en México para mid level',
  'Eventos de data en Perú este mes'
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
  loginRequired = false
}: Props) {
  const placeholder = `Ejemplo: Eventos de IA esta semana en ${profile.country} para ${profile.level}`;

  if (loginRequired) {
    return (
      <section className="panel chat-panel chat-panel-gated" aria-label="Chat IA (requiere iniciar sesión)">
        <div className="eyebrow">Chat IA</div>
        <h2>Inicia sesión para chatear con la IA.</h2>
        <p className="muted">
          Limitamos el chat a usuarios autenticados para controlar los costos del modelo. El resto del radar sigue público.
        </p>
        <div className="chat-gate-signin">
          <GoogleSignIn />
        </div>
      </section>
    );
  }

  return (
    <section className="panel chat-panel" aria-label="Chat IA de recomendación de eventos">
      <div className="eyebrow">Chat IA</div>
      <h2>Busca eventos como si hablaras con un curador local.</h2>
      <p className="muted">Pregunta algo como "Eventos de IA esta semana en Ecuador para junior" y obtén una lista filtrada con explicación.</p>

      <div className="prompt-pills" role="group" aria-label="Sugerencias de consulta">
        {promptShortcuts.map((shortcut, index) => (
          <button
            key={index}
            type="button"
            className="prompt-pill"
            onClick={() => onMessageChange(shortcut)}
            aria-label={`Usar sugerencia: ${shortcut}`}
          >
            {shortcut}
          </button>
        ))}
      </div>

      <div className="chat-input-shell">
        <textarea
          rows={4}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder={placeholder}
          aria-label="Mensaje para la IA"
        />
        <button
          className="primary-button"
          type="button"
          onClick={onSubmit}
          disabled={loading || message.trim().length === 0}
          aria-label="Enviar consulta al chat IA"
        >
          {loading ? 'Consultando IA...' : 'Consultar'}
        </button>
      </div>

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

      {response ? (
        <div className="chat-response">
          <div className="chat-answer">{response.answer}</div>
          <div className="chat-meta">Filtros detectados: {formatInterpretation(response)}</div>
          <div className="chat-results">
            {response.events.slice(0, 3).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                onOpen={() => onOpenEvent(event.id)}
              />
            ))}
          </div>
        </div>
      ) : !error && !rateLimit ? (
        <div className="chat-empty">Tu consulta aparecerá aquí con eventos filtrados y una explicación automática.</div>
      ) : null}
    </section>
  );
}

function formatInterpretation(response: ChatResponse): string {
  const parts = [response.interpretation.country, response.interpretation.role, response.interpretation.level, response.interpretation.interests.join(', ')].filter(Boolean);
  return parts.join(' · ') || 'sin filtros extra';
}
