import { useEffect, useState } from 'react';
import { getChatResponse, getEventDetail, getProfileOptions, getRecommendations } from './api';
import { ChatPanel } from './components/ChatPanel';
import { EventCard } from './components/EventCard';
import { EventDetail } from './components/EventDetail';
import { ProfileForm } from './components/ProfileForm';
import type { ChatResponse, ProfileOptions, RecommendationsResponse, UserProfile } from './types';

const defaultProfile: UserProfile = {
  country: 'Ecuador',
  role: 'frontend',
  level: 'mid',
  interests: ['ia', 'web']
};

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RecommendationsResponse['events'][number] | null>(null);
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('Eventos de IA esta semana en Ecuador para junior');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [profileReady, setProfileReady] = useState(Boolean(localStorage.getItem('techRadarProfile')));

  useEffect(() => {
    void getProfileOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoutePath(window.location.pathname);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    const match = routePath.match(/^\/events\/([^/]+)$/);

    if (!match) {
      setSelectedEvent(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    const eventId = decodeURIComponent(match[1]);
    let active = true;

    setDetailLoading(true);
    setDetailError(null);
    setSelectedEvent(null);

    getEventDetail(eventId)
      .then((data) => {
        if (active) {
          setSelectedEvent(data.event);
        }
      })
      .catch(() => {
        if (active) {
          setDetailError('No pudimos cargar el detalle de este evento.');
        }
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [routePath]);

  useEffect(() => {
    localStorage.setItem('techRadarProfile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (!profileReady) {
      return;
    }

    let active = true;

    setLoadingProfile(true);
    getRecommendations(profile)
      .then((data) => {
        if (active) {
          setRecommendations(data);
        }
      })
      .catch(() => {
        if (active) {
          setRecommendations(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [profile, profileReady]);

  const saveProfile = () => {
    setProfileReady(true);
    localStorage.setItem('techRadarProfile', JSON.stringify(profile));
    void getRecommendations(profile).then(setRecommendations).catch(() => setRecommendations(null));
  };

  const handleChatSubmit = () => {
    setLoadingChat(true);
    getChatResponse(chatMessage, profile)
      .then((data) => setChatResponse(data))
      .finally(() => setLoadingChat(false));
  };

  const topEvents = recommendations?.recommendations ?? [];
  const allEvents = recommendations?.events ?? [];
  const isEventRoute = routePath.startsWith('/events/');

  if (isEventRoute && detailLoading) {
    return <DetailLoading onBack={handleBackToRadar} />;
  }

  if (isEventRoute && detailError) {
    return <DetailError message={detailError} onBack={handleBackToRadar} />;
  }

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={handleBackToRadar} />;
  }

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-one" />
      <div className="background-orb background-orb-two" />

      <header className="topbar">
        <div>
          <div className="brand">Tech Radar LATAM</div>
          <p className="muted">Descubre eventos tecnológicos relevantes con IA y datos simulados listos para usar.</p>
        </div>
        <div className="status-pill">API + IA fallback local</div>
      </header>

      {!profileReady ? (
        <main className="hero-grid">
          <section className="hero-copy panel">
            <div className="eyebrow">Latam events intelligence</div>
            <h1>Un radar de eventos tech que entiende tu perfil y te explica el porqué.</h1>
            <p>
              Tech Radar LATAM combina recomendaciones personalizadas, ranking inteligente y chat conversacional para descubrir eventos en Ecuador,
              México, Perú y el resto de la región.
            </p>
            <div className="metric-row">
              <Metric value="12+" label="eventos simulados" />
              <Metric value="6" label="países cubiertos" />
              <Metric value="AI" label="resumen y chat" />
            </div>
          </section>

          <ProfileForm
            profile={profile}
            options={options}
            onChange={setProfile}
            onSubmit={saveProfile}
            submitting={loadingProfile}
          />
        </main>
      ) : (
        <main className="dashboard-grid">
          <aside className="panel sidebar-panel">
            <div className="eyebrow">Tu perfil</div>
            <h2>{profile.country}</h2>
            <div className="profile-stack">
              <ProfileField label="Rol" value={profile.role} />
              <ProfileField label="Nivel" value={profile.level} />
              <ProfileField label="Intereses" value={profile.interests.join(', ')} />
            </div>
            <button className="secondary-button" type="button" onClick={() => setProfileReady(false)}>
              Editar perfil
            </button>

            <div className="insight-card">
              <div className="insight-label">Resumen del radar</div>
              <div className="insight-value">{recommendations?.context.total ?? 0} eventos analizados</div>
              <div className="insight-note">{recommendations?.context.trending ?? 0} marcados como Trending</div>
            </div>
          </aside>

          <section className="content-column">
            <section className="summary-panel panel">
              <div className="eyebrow">Dashboard</div>
              <h1>Recomendaciones para ti</h1>
              <p className="muted">La lista se ordena por país, rol, nivel, intereses y cercanía temporal. Cada evento trae un resumen corto y una razón clara.</p>

              <div className="metric-row">
                <Metric value={topEvents[0]?.rankLabel ?? '---'} label="mejor coincidencia" />
                <Metric value={topEvents[0]?.score?.toString() ?? '0'} label="score principal" />
                <Metric value={allEvents.length.toString()} label="eventos disponibles" />
              </div>
            </section>

            <section className="events-grid">
              {topEvents.map((event, index) => (
                <EventCard key={event.id} event={event} featured={index === 0} onOpen={() => openEvent(event.id)} />
              ))}
            </section>

            <section className="panel list-panel">
              <div className="panel-title-row">
                <div>
                  <div className="eyebrow">Lista completa</div>
                  <h2>Más eventos en tu radar</h2>
                </div>
                <span className="muted">{loadingProfile ? 'Actualizando...' : 'Ordenado por score'}</span>
              </div>
              <div className="compact-list">
                {allEvents.slice(0, 6).map((event) => (
                  <div key={event.id} className="compact-row">
                    <div>
                      <div className="compact-title">{event.title}</div>
                      <div className="muted compact-subtitle">{event.city}, {event.country} · {event.rankLabel}</div>
                    </div>
                    <button className="compact-score" type="button" onClick={() => openEvent(event.id)}>
                      {event.score}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <div className="chat-column">
            <ChatPanel
              profile={profile}
              message={chatMessage}
              onMessageChange={setChatMessage}
              onSubmit={handleChatSubmit}
              loading={loadingChat}
              response={chatResponse}
              onOpenEvent={openEvent}
            />
          </div>
        </main>
      )}
    </div>
  );
}

function openEvent(eventId: string) {
  window.history.pushState({}, '', `/events/${eventId}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function handleBackToRadar() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function DetailLoading({ onBack }: { onBack: () => void }) {
  return (
    <main className="detail-shell">
      <section className="panel detail-panel">
        <button className="secondary-button" type="button" onClick={onBack}>
          Volver al radar
        </button>
        <div className="eyebrow">Cargando detalle</div>
        <h1>Estamos cargando el evento</h1>
        <p className="muted">Si la conexión al backend tarda un poco, aquí verás el estado mientras se resuelve.</p>
      </section>
    </main>
  );
}

function DetailError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <main className="detail-shell">
      <section className="panel detail-panel">
        <button className="secondary-button" type="button" onClick={onBack}>
          Volver al radar
        </button>
        <div className="eyebrow">Detalle no disponible</div>
        <h1>No pudimos abrir este evento</h1>
        <p className="muted">{message}</p>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem('techRadarProfile');
    if (!raw) {
      return defaultProfile;
    }

    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      country: parsed.country ?? defaultProfile.country,
      role: parsed.role ?? defaultProfile.role,
      level: parsed.level ?? defaultProfile.level,
      interests: parsed.interests?.length ? parsed.interests : defaultProfile.interests
    };
  } catch {
    return defaultProfile;
  }
}
