import { useEffect, useRef, useState } from 'react';
import { ApiError, getChatResponse, getEventDetail, getProfileOptions, getRecommendations, getSyncStatus, triggerSync } from './api';
import { useAuth } from './auth/AuthContext';
import { GoogleSignIn } from './auth/GoogleSignIn';
import { UserMenu } from './auth/UserMenu';
import { ApiKeyRequestPage } from './components/ApiKeyRequestPage';
import { ChatPanel } from './components/ChatPanel';
import { EventCard } from './components/EventCard';
import { EventCardSkeletonGrid } from './components/EventCardSkeleton';
import { EventDetail } from './components/EventDetail';
import { EventsEmptyState } from './components/EventsEmptyState';
import { FilterBar, type EventFilters } from './components/FilterBar';
import { ProfileForm } from './components/ProfileForm';
import type { ChatResponse, ProfileOptions, RankedEvent, RecommendationsResponse, SyncStatus, UserProfile } from './types';

const defaultProfile: UserProfile = {
  country: 'Ecuador',
  role: 'frontend',
  level: 'mid',
  interests: ['ia', 'web']
};

const emptyFilters: EventFilters = { source: '', country: '', city: '', q: '' };

export default function App() {
  const { user, favorites, rsvp, config: authConfig, toggleFavorite, toggleRsvp } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [savedProfile, setSavedProfile] = useState<UserProfile>(loadProfile);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RankedEvent | null>(null);
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('Eventos de IA esta semana en Ecuador para junior');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatRateLimit, setChatRateLimit] = useState<{ scope: 'per_second' | 'per_hour'; message: string } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [profileReady, setProfileReady] = useState(Boolean(localStorage.getItem('techRadarProfile')));
  const [filters, setFilters] = useState<EventFilters>(emptyFilters);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [triggeringSync, setTriggeringSync] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const scrollPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!chatDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [chatDrawerOpen]);

  useEffect(() => {
    void getProfileOptions().then(setOptions).catch(() => setOptions(null));
    void getSyncStatus().then(setSyncStatus).catch(() => setSyncStatus(null));
  }, []);

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    const source = new EventSource(`${base}/events/stream`, { withCredentials: true });

    const onSync = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { saved?: number; finishedAt?: string };
        setSyncStatus((current) => ({
          running: false,
          lastResult: payload.saved !== undefined
            ? {
                fetched: current?.lastResult?.fetched ?? payload.saved,
                cleaned: current?.lastResult?.cleaned ?? payload.saved,
                deduped: current?.lastResult?.deduped ?? payload.saved,
                saved: payload.saved,
                startedAt: current?.lastResult?.startedAt ?? payload.finishedAt ?? new Date().toISOString(),
                finishedAt: payload.finishedAt ?? new Date().toISOString(),
                sources: current?.lastResult?.sources ?? []
              }
            : current?.lastResult ?? null
        }));
        setReloadKey((key) => key + 1);
      } catch {
        // ignore malformed payloads
      }
    };

    source.addEventListener('sync:completed', onSync as EventListener);

    // onopen se dispara tanto en el primer connect como en cada reconexión
    // automática del browser — perfecto para "limpiar" el chip de reconnecting.
    source.onopen = () => {
      setSseStatus('connected');
      // Si el browser acaba de reconectar, pedimos un status fresco por si
      // nos perdimos un 'sync:completed' durante el downtime.
      void getSyncStatus().then((status) => {
        setSyncStatus(status);
        if ((status.lastResult?.saved ?? 0) > 0 && !status.running) {
          setReloadKey((key) => key + 1);
        }
      }).catch(() => undefined);
    };

    source.onerror = () => {
      // readyState 0=CONNECTING (browser ya está reintentando), 2=CLOSED (murió)
      if (source.readyState === EventSource.CLOSED) {
        setSseStatus('reconnecting');
      } else if (source.readyState === EventSource.CONNECTING) {
        setSseStatus('reconnecting');
      }
    };

    return () => {
      source.removeEventListener('sync:completed', onSync as EventListener);
      source.onerror = null;
      source.onopen = null;
      source.close();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    const timer = setInterval(() => {
      if (!active) return;
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(timer);
        return;
      }

      void getSyncStatus()
        .then((status) => {
          if (!active) return;
          setSyncStatus(status);

          const settled = !status.running && status.lastResult !== null;
          const hasData = (status.lastResult?.saved ?? 0) > 0;

          if (settled && hasData) {
            setReloadKey((key) => key + 1);
            clearInterval(timer);
          } else if (settled && !hasData) {
            clearInterval(timer);
          }
        })
        .catch(() => undefined);
    }, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
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
  }, [profile, profileReady, filters, reloadKey]);

  const saveProfile = () => {
    setSavedProfile(profile);
    setProfileReady(true);
  };

  const cancelEdit = () => {
    setProfile(savedProfile);
    setProfileReady(true);
  };

  const openEditor = () => {
    setSavedProfile(profile);
    setProfileReady(false);
  };

  const profileHasChanges = !sameProfile(profile, savedProfile);

  const handleRetrySync = () => {
    setTriggeringSync(true);
    setSyncStatus((current) => (current ? { ...current, running: true } : { running: true, lastResult: null }));
    triggerSync()
      .then((data) => {
        setSyncStatus({ running: false, lastResult: data.result });
        setReloadKey((key) => key + 1);
      })
      .catch(() => undefined)
      .finally(() => {
        setTriggeringSync(false);
      });
  };

  const handleChatReset = () => {
    setChatResponse(null);
    setChatError(null);
    setChatRateLimit(null);
  };

  const handleChatSubmit = () => {
    setLoadingChat(true);
    setChatError(null);
    setChatRateLimit(null);
    getChatResponse(chatMessage, profile)
      .then((data) => setChatResponse(data))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setChatError('Inicia sesión con Google para usar el chat IA.');
        } else if (error instanceof ApiError && error.status === 429) {
          const rawScope = error.details?.scope;
          const scope: 'per_second' | 'per_hour' = rawScope === 'per_hour' ? 'per_hour' : 'per_second';
          setChatRateLimit({ scope, message: error.message });
        } else {
          const message = error instanceof Error ? error.message : 'Ocurrió un error consultando la IA.';
          setChatError(message);
        }
        setChatResponse(null);
      })
      .finally(() => setLoadingChat(false));
  };

  const chatLoginRequired = Boolean(authConfig?.enabled) && !user;

  const topEvents = recommendations?.recommendations ?? [];
  const allEvents = recommendations?.events ?? [];
  const totalEvents = recommendations?.context.total ?? allEvents.length;
  const trendingCount = recommendations?.context.trending ?? 0;
  const isEventRoute = routePath.startsWith('/events/');
  const isApiRoute = routePath === '/api' || routePath.startsWith('/api/');
  const hasFilters = Boolean(filters.source || filters.country || filters.city || filters.q);
  const showSkeleton = loadingProfile && recommendations === null;
  const isEmpty = profileReady && !showSkeleton && allEvents.length === 0;
  const healthySources = syncStatus?.lastResult?.sources.filter((source) => source.count > 0 && !source.error).length ?? 0;
  const totalSources = syncStatus?.lastResult?.sources.length ?? 0;

  const openEventAndRemember = (eventId: string) => {
    scrollPositionsRef.current['/'] = window.scrollY;
    openEvent(eventId);
  };

  if (isApiRoute) {
    return <ApiKeyRequestPage onBack={handleBackToRadar} />;
  }

  if (isEventRoute && detailLoading) {
    return <DetailLoading onBack={handleBackToRadar} />;
  }

  if (isEventRoute && detailError) {
    return <DetailError message={detailError} onBack={handleBackToRadar} />;
  }

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={handleBackToRadar}
        isFavorite={favorites.has(selectedEvent.id)}
        isGoing={rsvp.has(selectedEvent.id)}
        canInteract={Boolean(user)}
        authEnabled={Boolean(authConfig?.enabled)}
        onToggleFavorite={user ? () => void toggleFavorite(selectedEvent.id) : undefined}
        onToggleRsvp={user ? () => void toggleRsvp(selectedEvent.id) : undefined}
      />
    );
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
        <div className="topbar-actions">
          {sseStatus === 'reconnecting' ? (
            <div className="status-pill status-pill-warn" aria-live="polite" aria-label="Reconectando al stream en vivo">
              <span className="status-dot" aria-hidden="true" />
              Reconectando…
            </div>
          ) : null}
          <div
            className={`status-pill ${totalSources > 0 && healthySources === 0 ? 'status-pill-warn' : ''}`}
            aria-label="Estado de las fuentes de datos"
          >
            <span className="status-dot" aria-hidden="true" />
            {totalSources > 0
              ? `${healthySources}/${totalSources} fuentes activas`
              : 'Conectando fuentes…'}
          </div>
          <a
            href="/api"
            className="api-topbar-link"
            onClick={(event) => {
              event.preventDefault();
              window.history.pushState({}, '', '/api');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            <span className="api-topbar-icon" aria-hidden="true">{'{ }'}</span>
            <span>API pública</span>
          </a>
          {authConfig?.enabled ? (user ? <UserMenu /> : <GoogleSignIn compact />) : null}
        </div>
      </header>

      {!profileReady ? (
        recommendations !== null ? (
          <main className="edit-shell">
            <div className="edit-topbar">
              <button className="back-chip" type="button" onClick={cancelEdit}>
                <span aria-hidden="true">←</span>
                <span>Volver al radar</span>
              </button>
              <div className="breadcrumb" aria-label="Ruta">
                <span>Radar</span>
                <span aria-hidden="true">/</span>
                <span className="breadcrumb-current">Editar perfil</span>
              </div>
            </div>
            <ProfileForm
              profile={profile}
              options={options}
              onChange={setProfile}
              onSubmit={saveProfile}
              submitting={loadingProfile}
              mode="edit"
              onCancel={cancelEdit}
              hasChanges={profileHasChanges}
            />
          </main>
        ) : (
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
              mode="onboarding"
            />
          </main>
        )
      ) : (
        <main className="dashboard-grid">
          <aside className="panel sidebar-panel">
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="eyebrow">Estás viendo</div>
                <h2>
                  <span className="profile-country-flag" aria-hidden="true"><IconLocation /></span>
                  {profile.country}
                </h2>
              </div>

              <dl className="profile-stack">
                <div className="profile-row">
                  <dt>
                    <span className="profile-row-icon" aria-hidden="true"><IconRole /></span>
                    Rol
                  </dt>
                  <dd>
                    <span className="profile-chip profile-chip-role">{formatRole(profile.role)}</span>
                  </dd>
                </div>

                <div className="profile-row">
                  <dt>
                    <span className="profile-row-icon" aria-hidden="true"><IconLevel /></span>
                    Nivel
                  </dt>
                  <dd>
                    <span className={`level-badge level-badge-${profile.level}`}>
                      <span className="level-badge-dot" aria-hidden="true" />
                      {profile.level}
                    </span>
                  </dd>
                </div>

                <div className="profile-row profile-row-interests">
                  <dt>
                    <span className="profile-row-icon" aria-hidden="true"><IconSpark /></span>
                    Intereses
                  </dt>
                  <dd>
                    {profile.interests.length > 0 ? (
                      <div className="interest-chip-list">
                        {profile.interests.map((interest) => (
                          <span key={interest} className="interest-chip">#{interest}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">Sin intereses guardados</span>
                    )}
                  </dd>
                </div>
              </dl>

              {user ? (
                <div className="profile-engagement" aria-label="Tus interacciones">
                  <div>
                    <strong>{favorites.size}</strong>
                    <span>Favoritos</span>
                  </div>
                  <div className="profile-engagement-divider" aria-hidden="true" />
                  <div>
                    <strong>{rsvp.size}</strong>
                    <span>Asistiré</span>
                  </div>
                </div>
              ) : null}

              <button className="secondary-button profile-edit-btn" type="button" onClick={openEditor}>
                <IconPencil />
                <span>Editar perfil</span>
              </button>
            </div>

            <div className="insight-card">
              <div className="insight-label">Resumen del radar</div>
              <div className="insight-value">
                <strong>{totalEvents}</strong>
                <span>eventos analizados</span>
              </div>
              <div className="insight-note">
                <span className="insight-dot" aria-hidden="true" />
                {trendingCount} marcados como Trending
              </div>
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

            {showSkeleton ? (
              <div className="skeleton-wrapper">
                {syncStatus?.running ? (
                  <div className="sync-banner" role="status">
                    <span className="sync-banner-dot" aria-hidden="true" />
                    Sincronizando fuentes reales (Meetup, Eventbrite, GDG)…
                  </div>
                ) : null}
                <EventCardSkeletonGrid count={4} />
              </div>
            ) : isEmpty ? (
              <EventsEmptyState
                title={
                  hasFilters
                    ? 'Sin eventos con esos filtros'
                    : syncStatus?.running
                      ? 'Sincronizando fuentes reales…'
                      : 'Todavía no hay eventos en tu radar'
                }
                description={
                  hasFilters
                    ? 'Intenta limpiar los filtros o ampliar tu búsqueda a otra ciudad o fuente.'
                    : syncStatus?.running
                      ? 'Estamos consultando Meetup, Eventbrite y GDG en vivo. En unos segundos aparecerán los eventos.'
                      : 'Las fuentes públicas (Meetup, Eventbrite, GDG) no devolvieron eventos transformables. Reintenta la sincronización o revisa el detalle debajo.'
                }
                onReset={hasFilters ? () => setFilters(emptyFilters) : undefined}
                syncStatus={hasFilters ? null : syncStatus?.lastResult ?? null}
                syncRunning={triggeringSync || Boolean(syncStatus?.running)}
                onRetrySync={hasFilters || syncStatus?.running ? undefined : handleRetrySync}
              />
            ) : (
              <section className="events-grid" aria-busy={loadingProfile}>
                {topEvents.map((event, index) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    featured={index === 0}
                    onOpen={() => openEventAndRemember(event.id)}
                    favorite={favorites.has(event.id)}
                    canFavorite={Boolean(user)}
                    onToggleFavorite={user ? () => void toggleFavorite(event.id) : undefined}
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

          <div className={`chat-column${chatDrawerOpen ? ' chat-column-open' : ''}`}>
            <div className="chat-drawer-header">
              <div className="chat-drawer-handle" aria-hidden="true" />
              <button
                type="button"
                className="chat-drawer-close"
                onClick={() => setChatDrawerOpen(false)}
                aria-label="Cerrar chat"
              >
                ✕
              </button>
            </div>
            <ChatPanel
              profile={profile}
              message={chatMessage}
              onMessageChange={setChatMessage}
              onSubmit={handleChatSubmit}
              onReset={handleChatReset}
              loading={loadingChat}
              response={chatResponse}
              error={chatError}
              rateLimit={chatRateLimit}
              onOpenEvent={(id) => {
                setChatDrawerOpen(false);
                openEventAndRemember(id);
              }}
              loginRequired={chatLoginRequired}
            />
          </div>

          {chatDrawerOpen ? (
            <button
              type="button"
              className="chat-backdrop"
              onClick={() => setChatDrawerOpen(false)}
              aria-label="Cerrar chat"
            />
          ) : null}

          <button
            type="button"
            className={`chat-fab${chatDrawerOpen ? ' chat-fab-hidden' : ''}`}
            onClick={() => setChatDrawerOpen(true)}
            aria-label="Abrir chat con IA"
          >
            <span aria-hidden="true">✨</span> Pregúntale a la IA
          </button>
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

const ROLE_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  fullstack: 'Fullstack',
  data: 'Data',
  design: 'Diseño',
  founder: 'Founder',
  mobile: 'Mobile',
  devops: 'DevOps',
  product: 'Product'
};

function formatRole(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

function IconLocation() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconRole() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconLevel() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20v-6M12 20V8M20 20V4" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}

function sameProfile(a: UserProfile, b: UserProfile): boolean {
  if (a.country !== b.country) return false;
  if (a.role !== b.role) return false;
  if (a.level !== b.level) return false;
  if (a.interests.length !== b.interests.length) return false;
  const sortedA = [...a.interests].sort();
  const sortedB = [...b.interests].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
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
