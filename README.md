# Tech Radar LATAM

Agregador inteligente de eventos tech de Latinoamérica con recomendaciones personalizadas, chat conversacional con IA y apps web + móvil nativas.

Fuentes agregadas: **Meetup**, **Eventbrite**, **GDG Chapters**. Cada evento se limpia, dedupea, clasifica por nivel y temática, y recibe un resumen corto con IA. Un motor de ranking pondera país, rol, nivel, intereses y cercanía temporal del usuario.

**Demo**:
- Web: `https://tech-radar-latam.vercel.app/`
- API: `https://tech-radar-api.onrender.com`
- Móvil: iOS (TestFlight / dev build) · Android (APK vía EAS)

---

## 📸 Screenshots

### Web — vista desktop

![Dashboard con recomendaciones, filtros y chat sticky](docs/images/web-dashboard.png)

![Detalle de evento con score, tags y acciones](docs/images/web-event-detail.png)

### Web — vista mobile (chat drawer)

<p align="center">
  <img src="docs/images/mobile-home.png" alt="Home responsive en móvil" width="260"/>
  <img src="docs/images/web-mobile-chat.png" alt="Chat drawer abierto desde el FAB" width="260"/>
</p>

### Móvil — iOS

<p align="center">
  <img src="docs/images/mobile-login.png" alt="Login con Google Sign-In nativo" width="220"/>
  <img src="docs/images/mobile-home.png" alt="Radar con featured card + score" width="220"/>
  <img src="docs/images/mobile-detail.png" alt="Detalle de evento con share y RSVP" width="220"/>
  <img src="docs/images/mobile-favorites.png" alt="Pestaña de favoritos" width="220"/>
</p>

### Móvil — chat IA con historial

<p align="center">
  <img src="docs/images/mobile-chat-empty.png" alt="Chat con sugerencias rápidas" width="260"/>
  <img src="docs/images/mobile-chat-history.png" alt="Conversación con eventos relacionados" width="260"/>
</p>

---

## ✨ Features

### Descubrir y filtrar
- **Búsqueda de texto** libre sobre título, descripción, tags, ciudad.
- **Filtros**: país, ciudad, fuente, favoritos-only.
- **Recomendaciones rankeadas** (score 0-100) con razones explicadas.
- **Live sync** vía SSE: el feed se actualiza sólo cuando el backend termina una sync.

### IA
- **Chat conversacional**: "Eventos de IA esta semana en Ecuador para junior" → filtra y explica.
- **Clasificación automática** de nivel, tags y resumen por evento.
- **Multi-provider** con fallback automático: Ollama (local), OpenAI, Gemini.
- **Circuit breaker**: después de 3 fallas consecutivas, el provider queda fuera 60s para no saturar.

### Cuenta y persistencia
- **Google Sign-In**: cookie httpOnly en web (JWT 7 días), Bearer token en móvil.
- **Favoritos y RSVP** persistidos por usuario en Postgres.
- **Perfil editable** (país, rol, nivel, intereses) para personalizar recomendaciones.

### Cross-platform
- **Web** responsive mobile-first con bottom-sheet drawer para el chat.
- **Móvil nativo** iOS + Android con expo-router, haptics, animaciones (Reanimated), Inter font.
- **PWA**: instalable en Android/iOS desde el navegador, funciona offline con cache de eventos (Workbox).
- **Monorepo**: tipos compartidos entre web y móvil.

### API pública para comunidades
- **REST read-only** en `/public/v1/*` con **OpenAPI 3.1** spec + docs interactivos vía **Scalar UI**.
- **Rate limit 1000 req/h** por key, CORS `*` (cualquier dominio puede consumir).
- **Widget embebible** (`widget.js`) — un `<script>` y cualquier comunidad muestra tus eventos en su sitio.
- **Flujo de alta**: formulario público en `/api` → notificación a Discord → **magic-link aprobar/rechazar** con 1 click desde el celular → email automático via Resend con la key.

---

## 🧱 Stack

| Capa | Stack |
|---|---|
| Backend | Node.js 20 · Express · TypeScript · Drizzle ORM · PostgreSQL |
| Web | React 19 · Vite 6 · TypeScript · CSS vanilla (mobile-first) |
| Móvil | Expo SDK 54 · expo-router 6 · React Native 0.81 · Reanimated 4 |
| Auth | Google Identity Services (web) · `@react-native-google-signin` (iOS/Android) |
| IA | Ollama local (Qwen 2.5 7B) · OpenAI gpt-4o-mini · Gemini 1.5 |
| Realtime | Server-Sent Events |
| PWA | vite-plugin-pwa · Workbox (NetworkFirst/StaleWhileRevalidate) |
| API pública | OpenAPI 3.1 · Scalar UI · API keys hasheadas (SHA-256) |
| Email | Resend (approval/rejection templates) |
| Admin | Magic-link firmados (JWT, TTL 72h) desde Discord webhook |
| DB local | Postgres 16 en Docker |
| Deploy | Render (API + DB) · Vercel (Web) · EAS (Móvil) |

---

## 🗂 Estructura

```
tech-radar/
├── apps/
│   ├── api/          # Express + Drizzle + sincronización multi-fuente
│   ├── web/          # React 19 + Vite
│   └── mobile/       # Expo 54 + expo-router
├── docs/             # DEPLOY.md, OVERVIEW.md, PRESENTATION.md, images/
├── docker-compose.yml
└── package.json      # workspaces
```

Módulos principales del backend:

| Archivo | Responsabilidad |
|---|---|
| `src/services/{meetup,eventbrite,gdg}.service.ts` | Adapters por fuente con fallback |
| `src/services/sync.service.ts` | Orquesta la sincronización y emite `sync:completed` |
| `src/lib/event-processing.ts` | Limpia, dedupea y enriquece con IA |
| `src/lib/ranking.ts` | Score de recomendación + parser de intención del chat |
| `src/lib/ai.ts` | Chain de providers con circuit breaker |
| `src/lib/auth.ts` | Verificación de idTokens + PKCE code exchange |
| `src/lib/admin-tokens.ts` | JWT firmado para magic-links aprobar/rechazar |
| `src/lib/email.ts` · `notifications.ts` | Resend templates + Discord webhook |
| `src/routes/public-api.ts` | `/public/v1/*` — read-only para comunidades |
| `src/routes/public-docs.ts` | OpenAPI spec + Scalar UI en `/public/docs` |
| `src/routes/key-request.ts` | `POST /public/keys/request` — form de comunidades |
| `src/routes/admin-magic.ts` | `/admin/approve` · `/admin/reject` magic-links |
| `src/repositories/*` | Postgres vía Drizzle (con fallback a memoria sin DATABASE_URL) |

---

## 🚀 Quick start

### Requisitos

- Node.js 20+
- npm 10+
- Docker (para Postgres local)
- Xcode y/o Android Studio (solo si vas a correr la app móvil)

### 1. Clonar e instalar

```bash
git clone <repo>
cd tech-radar
npm install        # instala workspaces (api, web, mobile)
```

### 2. Levantar Postgres

```bash
docker compose up -d    # Postgres 16 en host :5434
```

### 3. Variables de entorno

Copia los ejemplos y rellena:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env   # si existe, sino crea desde README móvil
```

Lo mínimo para arrancar (sin auth ni IA):

**`apps/api/.env`**
```bash
PORT=4000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgres://postgres:postgres@localhost:5434/tech_radar_latam
```

**`apps/web/.env`**
```bash
VITE_API_URL=http://localhost:4000
```

### 4. Arrancar todo

```bash
npm run dev        # api (:4000) + web (:5173) en paralelo
```

### 5. (Opcional) App móvil

```bash
cd apps/mobile
npx expo prebuild --clean         # genera ios/ y android/
npx expo run:ios                  # simulador iOS
# o: npx expo run:ios --device "<nombre>" para iPhone físico
# o: npx expo run:android          para Android
```

Más detalle en [apps/mobile/README.md](apps/mobile/README.md).

---

## 🔐 Variables de entorno completas

<details>
<summary><strong><code>apps/api/.env</code></strong> (click para expandir)</summary>

```bash
PORT=4000
CORS_ORIGIN=http://localhost:5173
SYNC_INTERVAL_MINUTES=60

# PostgreSQL
DATABASE_URL=postgres://postgres:postgres@localhost:5434/tech_radar_latam
PG_POOL_MAX=10
PG_SSL=false     # true en Neon/Supabase/Render

# Fuentes de datos (opcional)
MEETUP_API_KEY=
EVENTBRITE_API_KEY=

# Auth (Google)
GOOGLE_CLIENT_ID=            # Web Client ID
GOOGLE_CLIENT_SECRET=        # solo backend
GOOGLE_IOS_CLIENT_ID=        # para validar idTokens de la app iOS
GOOGLE_ANDROID_CLIENT_ID=    # idem para Android
AUTH_SESSION_SECRET=         # openssl rand -base64 48

# Cookie: en prod con dominios distintos → SAMESITE=none, SECURE=true
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_DOMAIN=

# IA — elige proveedor
NODE_ENV=development
AI_PROVIDER=ollama           # ollama | openai | gemini | auto
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# API pública — emails para aprobación (Resend, 3000 emails/mes gratis)
RESEND_API_KEY=
RESEND_FROM_EMAIL=Tech Radar LATAM <onboarding@resend.dev>
PUBLIC_DOCS_URL=https://tech-radar-api.onrender.com/public/docs

# Notificación a Discord cuando entra una solicitud (opcional)
DISCORD_WEBHOOK_URL=

# Magic-link admin (aprobar/rechazar desde Discord). Si no se setea,
# reutiliza AUTH_SESSION_SECRET. Recomendado tener uno dedicado en prod.
ADMIN_TOKEN_SECRET=
API_BASE_URL=https://tech-radar-api.onrender.com
```

</details>

<details>
<summary><strong><code>apps/web/.env</code></strong></summary>

```bash
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=
```

</details>

<details>
<summary><strong><code>apps/mobile/.env</code></strong></summary>

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=    # para verificar idToken en backend
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=    # dev build iOS
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

En dispositivo físico, cambia la URL al IP LAN del Mac (`http://192.168.x.x:4000`) o usa un tunnel/la URL pública de Render.

</details>

---

## 🧠 Arquitectura destacada

### Provider chain de IA con circuit breaker

La selección del proveedor se decide por `AI_PROVIDER` + `NODE_ENV`. Cada provider tiene timeout propio (Ollama 45s para CPU local, cloud 15s) y un breaker que lo saca del chain después de 3 fallas consecutivas durante 60s. Ver [apps/api/src/lib/ai.ts](apps/api/src/lib/ai.ts).

### Auth dual (web + móvil)

El mismo endpoint valida tokens emitidos por cualquier Client ID (web, iOS, Android). El middleware acepta cookie httpOnly **o** `Authorization: Bearer`, así web y móvil comparten la misma superficie. Ver [apps/api/src/lib/auth.ts](apps/api/src/lib/auth.ts).

### Live sync con SSE

El backend emite `sync:completed` al terminar cada sincronización. El frontend mantiene un EventSource con reconexión automática; no hace polling innecesario. Ver [apps/api/src/lib/event-bus.ts](apps/api/src/lib/event-bus.ts) y el bloque SSE en [App.tsx](apps/web/src/App.tsx).

### Score de recomendación

Función pura en [ranking.ts](apps/api/src/lib/ranking.ts). Ponderación: país (28), rol (18), nivel (16), intereses (hasta 20), cercanía temporal (hasta 10). Cada razón queda expuesta en `event.reasons` para que la UI muestre el porqué.

### Rate limit del chat

Limiter en memoria por userId (o IP si no hay sesión): **1 req/s y 30 req/hora** en `/chat`. Protege el presupuesto de IA si alguien filtra un token. Ver [rate-limit.middleware.ts](apps/api/src/middleware/rate-limit.middleware.ts).

### PWA — instalable + offline

Configurada con [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app). Manifest inyectado en build, service worker generado con Workbox:

- `/events*` → **NetworkFirst** con 5s timeout y 24h cache. Si Render está dormido, el usuario ve eventos cacheados mientras despierta.
- `/profile-options` → **StaleWhileRevalidate**, 7 días.
- Endpoints sensibles (`/auth/*`, `/me/*`, `/chat`, `/admin/*`) **nunca** se cachean.

El `[InstallPrompt]` captura `beforeinstallprompt` y muestra card flotante en Android; en iOS el manifest + apple-touch-icon permiten "Agregar a pantalla de inicio" desde Safari. El `[UpdateBanner]` avisa cuando hay una nueva versión y dispara reload controlado. Ver [vite.config.ts](apps/web/vite.config.ts) y [src/components/](apps/web/src/components/).

### API pública para comunidades

Keys emitidas con `npm -w apps/api run keys:issue -- --owner "Flutter Ecuador"` (CLI) o vía formulario público en `/api`. Se hashean con SHA-256 antes de guardar (`api_keys.key_hash`), sólo devolvemos el plaintext al momento de emisión. Rate limit por key con ventana deslizante en memoria.

El flujo de **alta con aprobación manual**:

1. Usuario llena form en `/api` → `POST /public/keys/request` guarda pending.
2. Webhook a Discord con embed + dos **magic links** firmados (JWT 72h, acción en el payload).
3. Admin tap en "✅ Aprobar" desde Discord → `GET /admin/approve?token=...` emite la key, marca aprobada, manda email via Resend.
4. Tap en "❌ Rechazar" → form HTML para motivo → `POST /admin/reject` envía email explicativo.

"One-use" efectivo: si el link se reusa, el handler ve el nuevo status del request y responde "ya procesada". Ver [admin-tokens.ts](apps/api/src/lib/admin-tokens.ts) y [admin-magic.ts](apps/api/src/routes/admin-magic.ts).

---

## 📡 Endpoints

### Públicos
- `GET /health` — health check
- `GET /events` — lista completa con ranking + filtros (`country`, `role`, `level`, `interests`, `source`, `countryFilter`, `city`, `q`, `limit`)
- `GET /events/:id` — detalle enriquecido
- `GET /events/recommended` — top rankeado
- `GET /events/stream` — Server-Sent Events (`hello`, `sync:completed`)
- `GET /profile-options` — valores soportados para el perfil
- `POST /sync` — dispara sincronización manual
- `GET /sync/status` — último resultado de sync

### Auth
- `GET /auth/config` — flag de si la auth está habilitada
- `POST /auth/google` — body `{credential: <idToken>}` (web)
- `POST /auth/google/exchange` — body `{code, codeVerifier, redirectUri, clientId}` (móvil PKCE)
- `GET /auth/me` — user actual
- `POST /auth/logout`

### Protegidos (requieren sesión)
- `GET /me/favorites`
- `POST /me/events/:id/favorite` — toggle
- `POST /me/events/:id/rsvp` — toggle
- `POST /chat` — body `{message, profile}`

### API pública — comunidades
Requieren `Authorization: Bearer <key>` o `X-API-Key`. CORS `*`. Rate limit 1000/h por key.

- `GET /public/v1/events` — `country`, `city`, `source`, `tag`, `q`, `upcoming`, `limit`, `offset`
- `GET /public/v1/events/:id`
- `GET /public/v1/countries` — conteo por país
- `GET /public/v1/sources`
- `GET /public/docs` — Scalar UI interactiva
- `GET /public/openapi.json` — spec 3.1
- `POST /public/keys/request` — formulario, rate-limit por IP (3/h)

### Admin (magic-link desde Discord)
- `GET /admin/approve?token=<jwt>` — aprueba + emite key + email
- `GET /admin/reject?token=<jwt>` — form para motivo
- `POST /admin/reject` — procesa rechazo + email

---

## 🚢 Despliegue

Guía paso a paso en **[docs/DEPLOY.md](docs/DEPLOY.md)**:

- **API**: Render con Postgres managed
- **Web**: Vercel (root = `apps/web`, framework = Vite)
- **Móvil**: EAS Build → TestFlight (iOS) · APK directo (Android)

Checklist incluye: CORS cross-domain, cookie SameSite=None + Secure, Google OAuth authorized origins, rotación de secrets, cold-start del free tier de Render.

Costo estimado para demo: **$0–7/mes** (free tiers + opcional Render paid para evitar cold starts).

---

## 🧪 Desarrollo

```bash
npm run dev                          # api + web
npm -w apps/api run lint             # type-check api
npm -w apps/web run lint             # type-check web
npm -w apps/mobile run lint          # type-check mobile

# DB
npm -w apps/api run db:generate      # SQL nuevo al cambiar schema Drizzle
npm -w apps/api run db:migrate       # aplica migraciones
npm -w apps/api run db:studio        # GUI de Drizzle
```

---

## 📚 Docs adicionales

- [CHANGELOG.md](CHANGELOG.md) — historial de releases
- [docs/OVERVIEW.md](docs/OVERVIEW.md) — visión técnica general
- [docs/PRESENTATION.md](docs/PRESENTATION.md) — script para demo en vivo
- [docs/DEPLOY.md](docs/DEPLOY.md) — despliegue paso a paso
- [apps/mobile/README.md](apps/mobile/README.md) — setup específico móvil (dev build, Google OAuth, etc.)

---

## 🗺️ Roadmap corto

- [x] Skip de enriquecimiento IA para eventos no modificados (reduce costo OpenAI ~30×)
- [ ] Tab "Mis favoritos" con agrupación por mes
- [ ] Notificaciones push móvil para eventos con RSVP
- [ ] Exportar evento a calendario (`.ics`)
- [ ] Fuentes adicionales: Platzi Live, Devfolio, community Discord bots

---

## 📝 Licencia

MIT — úsalo, forkealo, haz tu versión para tu país. Si lo extiendes, me encantaría ver el resultado.
