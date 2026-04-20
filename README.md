# Tech Radar LATAM

Tech Radar LATAM ahora incluye un backend agregador multi-fuente para eventos reales de Latinoamérica (Meetup/Eventbrite/GDG), con limpieza, deduplicación y enriquecimiento con IA.

## Estructura

- `apps/api`: backend Node.js + Express + TypeScript
- `apps/web`: frontend React + Vite + TypeScript

### Backend (`apps/api`) - módulos principales

- `src/services/meetup.service.ts`: integración Meetup API + fallback
- `src/services/eventbrite.service.ts`: integración Eventbrite API + fallback
- `src/services/gdg.service.ts`: consumo de endpoints JSON internos/simulados + fallback
- `src/services/sync.service.ts`: `syncEvents()` para sincronizar fuentes
- `src/lib/event-processing.ts`: limpieza, dedupe y clasificación/resumen con IA
- `src/repositories/event.repository.ts`: persistencia PostgreSQL (o memoria si no hay `DATABASE_URL`)

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- Docker (para levantar PostgreSQL local)

## Base de datos local (Docker)

En la raíz del repo:

```bash
docker compose up -d            # levanta postgres en :5434 (host)
docker compose ps               # verifica que esté "healthy"
docker compose logs -f postgres # para ver logs
docker compose down             # detener (los datos persisten en el volumen)
docker compose down -v          # detener y borrar datos
```

El contenedor crea la base `tech_radar_latam` con usuario `postgres` / clave `postgres`. El host usa `5434` para no chocar con un Postgres local (Homebrew/Postgres.app) que suele ocupar `5432`; dentro del contenedor sigue siendo `5432`. El `DATABASE_URL` por defecto de `apps/api/.env.example` ya apunta a `localhost:5434`.

### Migraciones

```bash
npm -w apps/api run db:generate   # regenera SQL cuando cambias el schema Drizzle
npm -w apps/api run db:migrate    # aplica migraciones pendientes (también corre al arrancar la API)
npm -w apps/api run db:studio     # abre Drizzle Studio (GUI) en el navegador
```

## Variables de entorno

Crea estos archivos:

### `apps/api/.env`

```bash
PORT=4000
CORS_ORIGIN=http://localhost:5173
SYNC_INTERVAL_MINUTES=60

# Fuentes de datos (opcional, si no hay key se usa scraping público)
MEETUP_API_KEY=
EVENTBRITE_API_KEY=

# PostgreSQL
# Formato: postgres://usuario:password@host:puerto/base
# Ejemplos:
#   Local:       postgres://postgres:postgres@localhost:5434/tech_radar_latam
#   Neon:        postgres://user:pass@ep-xxx.neon.tech/tech_radar_latam?sslmode=require
#   Supabase:    postgres://postgres.xxx:pass@aws-0-xxx.pooler.supabase.com:6543/postgres
#   Railway:     postgres://postgres:pass@containers-us-xxx.railway.app:6543/railway
DATABASE_URL=
# Pool: ajusta si tu plan tiene pocos slots (ej. Supabase free = 15)
PG_POOL_MAX=10
# SSL: true para proveedores cloud (Neon, Supabase, Render). false para localhost.
PG_SSL=false

# Auth (pendiente de implementar)
GOOGLE_CLIENT_ID=
AUTH_SESSION_SECRET=

# IA local opcional (Ollama)
USE_OLLAMA=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct

# IA cloud opcional
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

### `apps/web/.env`

```bash
VITE_API_URL=http://localhost:4000
```

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Endpoints backend

- `GET /events`
Lista todos los eventos ya sincronizados (con ranking y metadata de recomendación).

- `GET /events/recommended`
Recomendaciones por perfil. Query params:
`country`, `role`, `level`, `interests`, `limit`

- `POST /chat`
Consulta en lenguaje natural y devuelve eventos + explicación IA.

- `POST /sync`
Sincronización manual de fuentes (además de la sincronización periódica).

- `GET /events/:id`
Detalle de evento por id.

## Sincronización

- Arranque inicial: se ejecuta `syncEvents()` al iniciar la API.
- Periódica: `SYNC_INTERVAL_MINUTES` (por defecto 60).
- Manual: `POST /sync`.

Si una API externa falla, cada fuente usa fallback estructurado para mantener el sistema operativo.

## Producción local

```bash
npm run build
npm run start
```

## Qué incluye

- Integración real con Eventbrite API (si hay `EVENTBRITE_API_KEY`)
- Integración de Meetup API (si hay `MEETUP_API_KEY`)
- Integración GDG vía endpoints JSON internos/simulados y fallback seguro
- Limpieza y deduplicación de eventos multi-fuente
- Clasificación automática (nivel y temática) + resumen corto con IA
- Persistencia en PostgreSQL (o memoria si no se configura `DATABASE_URL`)
- Endpoints de consulta, recomendación y chat IA
