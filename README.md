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
- `src/repositories/event.repository.ts`: persistencia MongoDB (o memoria si no hay URI)

## Requisitos

- Node.js 20 o superior
- npm 10 o superior

## Variables de entorno

Crea estos archivos:

### `apps/api/.env`

```bash
PORT=4000
CORS_ORIGIN=http://localhost:5173
MEETUP_API_KEY=
EVENTBRITE_API_KEY=
MONGODB_URI=
MONGODB_DB=tech_radar_latam
MONGODB_COLLECTION=events
SYNC_INTERVAL_MINUTES=60

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
- Persistencia en MongoDB (o memoria si no se configura `MONGODB_URI`)
- Endpoints de consulta, recomendación y chat IA
