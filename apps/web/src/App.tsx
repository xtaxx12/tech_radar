import { useEffect, useRef, useState } from 'react';
import { getChatResponse, getEventDetail, getProfileOptions, getRecommendations } from './api';
import { ChatPanel } from './components/ChatPanel';
import { EventCard } from './components/EventCard';
import { EventCardSkeletonGrid } from './components/EventCardSkeleton';
import { EventDetail } from './components/EventDetail';
import { EventsEmptyState } from './components/EventsEmptyState';
import { FilterBar, type EventFilters } from './components/FilterBar';
import { ProfileForm } from './components/ProfileForm';
import type { ChatResponse, ProfileOptions, RankedEvent, RecommendationsResponse, UserProfile } from './types';

const defaultProfile: UserProfile = {
  country: 'Ecuador',
  role: 'frontend',
  level: 'mid',
  interests: ['ia', 'web']
};

const emptyFilters: EventFilters = { source: '', country: '', city: '' };

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RankedEvent | null>(null);
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('Eventos de IA esta semana en Ecuador para junior');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [profileReady, setProfileReady] = useState(Boolean(localStorage.getItem('techRadarProfile')));
  const [filters, setFilters] = useState<EventFilters>(emptyFilters);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const scrollPositionsRef = useRef<Record<string, number>>({});

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
      const saved = scrollPositionsRef.current['/'];
      if (typeof saved === 'number') {
        requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'auto' }));
      }
      return;
    }

    const eventId = decodeURIComponent(match[1]);
    let active = true;

    setDetailLoading(true);
    setDetailError(null);
    setSelectedEvent(null);
    window.scrollTo({ top: 0, behavior: 'auto' });

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
    getRecommendations(profile, filters)
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
  }, [profile, profileReady, filters]);

  const saveProfile = () => {
    setProfileReady(true);
  };

  const handleChatSubmit = () => {
    setLoadingChat(true);
    setChatError(null);
    getChatResponse(chatMessage, profile)
      .then((data) => setChatResponse(data))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Ocurrió un error consultando la IA.';
        setChatError(message);
        setChatResponse(null);
      })
      .finally(() => setLoadingChat(false));
  };

  const topEvents = recommendations?.recommendations ?? [];
  const allEvents = recommendations?.events ?? [];
  const totalEvents = recommendations?.context.total ?? allEvents.length;
  const trendingCount = recommendations?.context.trending ?? 0;
  const isEventRoute = routePath.startsWith('/events/');
  const hasFilters = Boolean(filters.source || filters.country || filters.city);
  const isEmpty = profileReady && !loadingProfile && allEvents.length === 0;

  const openEventAndRemember = (eventId: string) => {
    scrollPositionsRef.current['/'] = window.scrollY;
    openEvent(eventId);
  };

  if (isEventRoute && detailLoading) {
    return <DetailLoading onBack={handleBackToRadar} />;
  }

  if (isEventRoute && detailError) {
    return <DetailError message={detailError} onBack={handleBackToRadar} />;
  }

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={handleBackToRadar} />;
  }

  const countriesCovered = new Set(
    allEvents
      .map((event) => event.country?.trim())
      .filter((value): value is string => Boolean(value) && value.toLowerCase() !== 'latam')
  ).size || 6;
  const listLimit = showAllEvents ? allEvents.length : 6;
  const listSlice = allEvents.slice(0, listLimit);

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-one" aria-hidden="true" />
      <div className="background-orb background-orb-two" aria-hidden="true" />

      <header className="topbar">
        <div>
          <div className="brand">Tech Radar LATAM</div>
          <p className="muted">Descubre eventos tecnológicos relevantes con IA y datos de Meetup, Eventbrite y GDG.</p>
        </div>
        <div className="status-pill" aria-label="Estado de la API">
          <span className="status-dot" aria-hidden="true" />
          API + IA fallback local
        </div>
      </header>

      {!profileReady ? (
        <main className="hero-grid">
          <section className="hero-copy panel">
            <div className="eyebrow">LATAM events intelligence</div>
            <h1>Un radar de eventos tech que entiende tu perfil y te explica el porqué.</h1>
            <p>
              Tech Radar LATAM combina recomendaciones personalizadas, ranking inteligente y chat conversacional para descubrir eventos en Ecuador,
              México, Perú y el resto de la región.
            </p>
            <div className="metric-row">
              <Metric value={totalEvents ? `${totalEvents}` : '—'} label="eventos analizados" />
              <Metric value={`${countriesCovered}`} label="países cubiertos" />
              <Metric value="IA" label="resumen y chat" />
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
            <div className="eyebrow">Estás viendo</div>
            <h2>{profile.country}</h2>
            <div className="profile-stack">
              <ProfileField label="Rol" value={profile.role} />
              <ProfileField label="Nivel" value={profile.level} />
              <ProfileField label="Intereses" value={profile.interests.join(', ') || '—'} />
            </div>
            <button className="secondary-button" type="button" onClick={() => setProfileReady(false)}>
              Editar perfil
            </button>

            <div className="insight-card">
              <div className="insight-label">Resumen del radar</div>
              <div className="insight-value">{totalEvents} eventos analizados</div>
              <div className="insight-note">{trendingCount} marcados como Trending</div>
            </div>
          </aside>

          <section className="content-column">
            <section className="summary-panel panel">
              <div className="eyebrow">Dashboard</div>
              <h1>Recomendaciones para ti</h1>
              <p className="muted">La lista se ordena por país, rol, nivel, intereses y cercanía temporal. Cada evento trae un resumen corto y una razón clara.</p>

              <div className="metric-row">
                <Metric value={topEvents[0]?.rankLabel ?? '—'} label="mejor coincidencia" />
                <Metric value={topEvents[0]?.score?.toString() ?? '0'} label="score principal" />
                <Metric value={totalEvents.toString()} label="eventos disponibles" />
              </div>

              <FilterBar
                filters={filters}
                onChange={setFilters}
                events={allEvents}
                profileCountry={profile.country}
              />
            </section>

            {loadingProfile && allEvents.length === 0 ? (
              <EventCardSkeletonGrid count={4} />
            ) : isEmpty ? (
              <EventsEmptyState
                title={hasFilters ? 'Sin eventos con esos filtros' : 'Todavía no hay eventos en tu radar'}
                description={
                  hasFilters
                    ? 'Intenta limpiar los filtros o ampliar tu búsqueda a otra ciudad o fuente.'
                    : 'El backend sigue sincronizando. Vuelve en unos segundos o revisa tu conexión a la API.'
                }
                onReset={hasFilters ? () => setFilters(emptyFilters) : undefined}
              />
            ) : (
              <section className="events-grid" aria-busy={loadingProfile}>
                {topEvents.map((event, index) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    featured={index === 0}
                    onOpen={() => openEventAndRemember(event.id)}
                  />
                ))}
              </section>
            )}

            {allEvents.length > 0 ? (
              <section className="panel list-panel">
                <div className="panel-title-row">
                  <div>
                    <div className="eyebrow">Lista completa</div>
                    <h2>Más eventos en tu radar</h2>
                  </div>
                  <span className="muted">
                    {loadingProfile ? 'Actualizando…' : `Mostrando ${listSlice.length} de ${allEvents.length}`}
                  </span>
                </div>
                <div className="compact-list">
                  {listSlice.map((event) => (
                    <div key={event.id} className="compact-row">
                      <div>
                        <div className="compact-title">{event.title}</div>
                        <div className="muted compact-subtitle">{event.city}, {event.country} · {event.rankLabel}</div>
                      </div>
                      <button
                        className="compact-score"
                        type="button"
                        onClick={() => openEventAndRemember(event.id)}
                        aria-label={`Abrir ${event.title}, score ${event.score}`}
                      >
                        {event.score}
                      </button>
                    </div>
                  ))}
                </div>
                {allEvents.length > 6 ? (
                  <button
                    type="button"
                    className="text-link-button list-toggle"
                    onClick={() => setShowAllEvents((current) => !current)}
                  >
                    {showAllEvents ? 'Mostrar menos' : `Mostrar todos (${allEvents.length})`}
                  </button>
                ) : null}
              </section>
            ) : null}
          </section>

          <div className="chat-column">
            <ChatPanel
              profile={profile}
              message={chatMessage}
              onMessageChange={setChatMessage}
              onSubmit={handleChatSubmit}
              loading={loadingChat}
              response={chatResponse}
              error={chatError}
              onOpenEvent={openEventAndRemember}
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
          ← Volver al radar
        </button>
        <div className="eyebrow">Cargando detalle</div>
        <h1>Estamos cargando el evento</h1>
        <p className="muted">Si la conexión al backend tarda un poco, aquí verás el estado mientras se resuelve.</p>
        <EventCardSkeletonGrid count={2} />
      </section>
    </main>
  );
}

function DetailError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <main className="detail-shell">
      <section className="panel detail-panel">
        <button className="secondary-button" type="button" onClick={onBack}>
          ← Volver al radar
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
