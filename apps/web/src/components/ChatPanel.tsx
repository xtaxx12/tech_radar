import type { ChatResponse, UserProfile } from '../types';
import { EventCard } from './EventCard';

type Props = {
  profile: UserProfile;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  response: ChatResponse | null;
  onOpenEvent: (eventId: string) => void;
};

const promptShortcuts = [
  'Eventos de IA esta semana en Ecuador para junior',
  'Meetups de frontend en México para mid level',
  'Eventos de data en Perú este mes'
];

export function ChatPanel({ profile, message, onMessageChange, onSubmit, loading, response, onOpenEvent }: Props) {
  return (
    <section className="panel chat-panel">
      <div className="eyebrow">Chat IA</div>
      <h2>Busca eventos como si hablaras con un curador local.</h2>
      <p className="muted">Pregunta algo como “Eventos de IA esta semana en Ecuador para junior” y obtén una lista filtrada con explicación.</p>

      <div className="prompt-pills">
        {promptShortcuts.map((shortcut) => (
          <button key={shortcut} type="button" className="prompt-pill" onClick={() => onMessageChange(shortcut)}>
            {shortcut}
          </button>
        ))}
      </div>

      <div className="chat-input-shell">
        <textarea
          rows={4}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder={`Ejemplo: Eventos de IA esta semana en ${profile.country} para ${profile.level}`}
        />
        <button className="primary-button" type="button" onClick={onSubmit} disabled={loading || message.trim().length === 0}>
          {loading ? 'Consultando IA...' : 'Consultar'}
        </button>
      </div>

      {response ? (
        <div className="chat-response">
          <div className="chat-answer">{response.answer}</div>
          <div className="chat-meta">Filtros detectados: {formatInterpretation(response)}</div>
          <div className="chat-results">
            {response.events.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} onOpen={() => onOpenEvent(event.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-empty">Tu consulta aparecerá aquí con eventos filtrados y una explicación automática.</div>
      )}
    </section>
  );
}

function formatInterpretation(response: ChatResponse): string {
  const parts = [response.interpretation.country, response.interpretation.role, response.interpretation.level, response.interpretation.interests.join(', ')].filter(Boolean);
  return parts.join(' · ') || 'sin filtros extra';
}
