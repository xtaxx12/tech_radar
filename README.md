# Tech Radar LATAM

MVP funcional para descubrir y recomendar eventos tecnológicos en Latinoamérica con un backend en Express, un frontend en React + Vite y una capa de IA con fallback local si no hay API key.

## Estructura

- `apps/api`: backend Node.js + Express + TypeScript
- `apps/web`: frontend React + Vite + TypeScript

## Requisitos

- Node.js 20 o superior
- npm 10 o superior

## Variables de entorno

Crea estos archivos si quieres activar IA externa:

### `apps/api/.env`

```bash
PORT=4000
CORS_ORIGIN=http://localhost:5173
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

## Producción local

```bash
npm run build
npm run start
```

## Qué incluye

- Onboarding de perfil de usuario
- Ranking de eventos con etiquetas como `Trending` y `Para ti`
- Resumen automático por evento
- Chat de IA con filtros conversacionales
- Datos simulados para Ecuador, México, Perú, Colombia, Chile y más
