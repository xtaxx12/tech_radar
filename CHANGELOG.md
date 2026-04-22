# Changelog

Todas las versiones notables de Tech Radar LATAM. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado con [SemVer](https://semver.org/lang/es/).

## [Unreleased]

Sin cambios pendientes.

---

## [1.0.0] — 2026-04-21

Primer release público. MVP end-to-end con web, móvil, API pública y flujo de distribución de keys para comunidades.

### Added — Core

- Backend Node + Express + Drizzle + PostgreSQL con sincronización multi-fuente (Meetup, Eventbrite, GDG Chapters).
- Motor de ranking que pondera país, rol, nivel, intereses y cercanía temporal; cada evento expone `reasons`.
- Limpieza, deduplicación y clasificación automática (nivel + tags + resumen con IA).
- Chain de providers de IA con circuit breaker: Ollama (local) → OpenAI → Gemini → fallback heurístico. Se apaga un provider tras 3 fallas consecutivas por 60s.
- Cache de enriquecimiento con `content_hash` para evitar re-llamar a la IA en eventos no modificados.
- Server-Sent Events en `/events/stream` — el feed se actualiza solo cuando termina una sync.

### Added — Web (React 19 + Vite)

- Dashboard responsive mobile-first con bottom-sheet drawer para el chat.
- Búsqueda por texto (`?q=...`) sobre título, descripción, tags y ciudad.
- Filtros por país, ciudad y fuente con chips y selects dependientes.
- Chat IA conversacional con parser de intención (país, rol, nivel, intereses, ciudad, timeframe).
- Login con Google Sign-In (GIS, cookie httpOnly de 7 días).
- Favoritos y RSVP persistidos por usuario.
- **PWA completa**: manifest, service worker con Workbox (NetworkFirst para eventos, StaleWhileRevalidate para options), InstallPrompt custom con cooldown de 30 días, UpdateBanner al haber nueva versión.

### Added — Mobile (Expo SDK 54 + expo-router)

- App nativa iOS + Android con Google Sign-In nativo (`@react-native-google-signin`).
- 4 tabs (Radar, Favoritos, Chat IA, Perfil) con iconos de Ionicons.
- Featured card con LinearGradient + shadow + score badge; rows con borde izquierdo coloreado por fuente.
- Chat con historial persistido en AsyncStorage (últimos 50 mensajes).
- Haptics en favoritos, RSVP y pull-to-refresh.
- Share nativo de eventos desde el detalle.
- Tipografía Inter cargada vía `@expo-google-fonts/inter`.
- Filtros en Home: país / fuente / favoritos-only con bottom-sheet modal.
- Sentence-case inteligente para títulos en MAYÚSCULAS (preserva acrónimos como AI, GDG, DSA).
- Distribución vía EAS Build — APK directo para Android, TestFlight para iOS.

### Added — API pública para comunidades

- `GET /public/v1/events` · `/events/:id` · `/countries` · `/sources` — read-only, CORS `*`, rate limit 1000 req/h por key.
- Keys hasheadas con SHA-256 en DB; plaintext solo visible al emitir.
- `POST /public/keys/request` con validación (email, website, caso de uso) y rate-limit por IP (3/h).
- OpenAPI 3.1 spec + docs interactivos en `/public/docs` con Scalar UI.
- `widget.js` — script embebible que cualquier comunidad usa con un `<script>` para mostrar sus eventos.
- CLI admin: `keys:issue`, `keys:list`, `keys:requests`, `keys:approve`, `keys:reject`.

### Added — Flujo admin de aprobación

- Notificación de solicitudes nuevas a Discord con embed estructurado.
- **Magic links firmados** (JWT HS256, TTL 72h, acción embebida en el payload): aprobar/rechazar con un click desde el celular.
- Páginas HTML de confirmación con el branding del producto (fondo oscuro, ring de color según variante).
- Envío automático de emails via **Resend**: template de aprobación con la key + ejemplo `curl`, template de rechazo con motivo.
- One-use efectivo: si el link se reusa, el estado ya cambió y el handler responde "ya procesada".

### Added — Infra

- Docker Compose con Postgres 16 Alpine (host `:5434` → contenedor `:5432`) para dev local.
- Migraciones con Drizzle Kit (`db:generate`, `db:migrate`, `db:studio`).
- Deploy guide para Render (API + DB) + Vercel (web) + EAS (móvil) en [docs/DEPLOY.md](docs/DEPLOY.md).

### Security

- Rate limit en memoria por user/IP en `/chat` (1 req/s, 30 req/hora).
- Rate limit por API key en `/public/v1/*` con headers `X-RateLimit-*`.
- Bearer token fallback en middleware de auth → web y móvil comparten la superficie.
- PKCE code exchange (`/auth/google/exchange`) para clientes nativos.
- Cookies httpOnly, SameSite configurable para cross-origin en producción.

---

[Unreleased]: https://github.com/<tu-user>/tech-radar/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/<tu-user>/tech-radar/releases/tag/v1.0.0
