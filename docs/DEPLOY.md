# Despliegue — Neon + Render + Vercel

Guía completa para poner Tech Radar LATAM en producción **gratis**, con el
frontend en Vercel, el backend en Render y la base en Neon. Toma ~30 minutos
la primera vez. Seguí los pasos en orden.

> Prerequisitos: cuentas gratis en [Neon](https://neon.tech),
> [Render](https://render.com) y [Vercel](https://vercel.com), y el repo ya
> pusheado a GitHub.

---

## Paso 1 · Neon (Postgres)

1. **New Project** → nombre `tech-radar-latam`, region más cerca de vos.
2. Cuando termine, copiá el **Pooled connection string**.
   Se ve así: `postgres://user:password@ep-xxx-pooler.us-east-1.aws.neon.tech/tech_radar_latam?sslmode=require`.
3. Guardalo temporalmente — lo vas a pegar en Render como `DATABASE_URL`.

> Neon arranca con compute autosuspend: la primera query después de inactividad
> tarda ~1-2s. No es problema para nosotros porque el sync corre una vez al
> arranque y después cada 60 min.

---

## Paso 2 · Google Cloud Console (OAuth)

Como Vercel y Render están en dominios distintos, las cookies viajan
cross-origin y el Client ID tiene que reconocer ambos.

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   → tu OAuth 2.0 Client ID (Web application).
2. **Authorized JavaScript origins**, agregá:
   - `http://localhost:5173` (dev)
   - `https://tu-app.vercel.app` *(lo vas a tener después del paso 4; volvé acá a completarlo)*
3. No necesitás configurar "Authorized redirect URIs" — el flujo web usa
   `postMessage` de Google Identity Services, no redirects.
4. Copiá el **Client ID** y el **Client Secret** (solo si planeás usar el
   flujo PKCE desde la app móvil).

---

## Paso 3 · Render (backend)

### Opción A — con el blueprint (`render.yaml`)

1. En Render → **New → Blueprint** → seleccioná este repo.
2. Detecta `render.yaml` automáticamente y lista `tech-radar-api`.
3. Completá las env vars marcadas con "sync: false":
   - `CORS_ORIGIN` → déjalo en placeholder ahora (lo corregís en el paso 5).
   - `DATABASE_URL` → connection string de Neon (paso 1).
   - `GOOGLE_CLIENT_ID` → del paso 2.
   - `GOOGLE_CLIENT_SECRET` → solo si usás móvil con PKCE.
   - `OPENAI_API_KEY` → tu key de OpenAI.
   - `GEMINI_API_KEY` → opcional, fallback gratuito.
   - `AUTH_SESSION_SECRET` y `SYNC_API_KEY` se generan solos (`generateValue: true`).
4. **Apply** y Render clona, instala, construye y arranca.
5. Anotá la URL que te da: `https://tech-radar-api-xxxx.onrender.com`.

### Opción B — manual desde el dashboard

Si preferís no usar blueprint:

- **New → Web Service** → conectá el repo.
- **Root Directory**: dejalo **vacío** (raíz del repo). Si ponés `apps/api`
  acá, `npm install` falla con *"No workspaces found"* porque el
  `package.json` raíz es donde viven los workspaces.
- Build Command: `npm ci --include=dev && npm run build --workspace apps/api`
  *(el `--include=dev` es obligatorio: con `NODE_ENV=production` en el servicio,
  `npm install` omite devDependencies y `tsc` no queda disponible para el build)*.
- Start Command: `npm run start --workspace apps/api`
- Health Check Path: `/health`
- Plan: Free
- Agregá las env vars del `render.yaml` a mano.

### Verificá que arrancó

```bash
curl https://tu-api.onrender.com/health
# → {"ok":true,...}
```

El primer sync tarda ~35s (discovery de chapters GDG LATAM). Los logs
de Render lo muestran en vivo.

---

## Paso 4 · Vercel (frontend)

1. Vercel → **Add New… → Project** → importá el repo.
2. **Root Directory**: dejalo **vacío** (raíz del repo). El `vercel.json` de
   la raíz del repo ya define que `npm install` corre ahí arriba para que
   los workspaces funcionen, y apunta `outputDirectory` a `apps/web/dist`.
   Si lo seteás en `apps/web` rompe el install por la misma razón que Render.
3. **Framework Preset**: "Other" (dejá el default que detecte).
4. **Build Command** y **Install Command**: vienen del `vercel.json` — no
   los sobrescribas en la UI.
5. **Environment Variables** (Settings → Environment Variables):
   - `VITE_API_URL` = `https://tu-api.onrender.com` *(sin slash final)*.
   - El Google Client ID ya **no** hace falta aquí: el frontend lo lee desde
     `/auth/config` del backend (single source of truth).
6. **Deploy**. Tarda ~1 min.
7. Anotá la URL: `https://tu-app.vercel.app`.

---

## Paso 5 · Cerrar el círculo (CORS + Google)

1. Volvé a **Render → tu-servicio → Environment** y actualizá:
   - `CORS_ORIGIN` = `https://tu-app.vercel.app` *(exacto, sin trailing slash)*.
2. Render reinicia el servicio (~30s).
3. Volvé a **Google Cloud Console → Credentials** y agregá
   `https://tu-app.vercel.app` a **Authorized JavaScript origins**.
4. Abrí `https://tu-app.vercel.app` en una ventana privada y probá:
   - ¿Arrancan los skeletons?
   - ¿Aparecen eventos después de unos segundos?
   - ¿El botón "Sign in with Google" funciona?
   - ¿Se puede favoritar un evento y persiste al recargar?

Si algo falla, revisá el log de Render (a veces es Neon tardando en la primera
query) y la consola del browser (errores de CORS se notan claro).

---

## Paso 6 · Mantener despierto el backend (opcional pero recomendado)

Render free duerme tras **15 minutos de inactividad** — el primer request
después tarda ~30s porque Node arranca de cero + la primera query a Neon.
Para el demo del GDG Quito querés evitar ese cold start.

1. Registrate en [UptimeRobot](https://uptimerobot.com) (gratis, 50 monitors).
2. **Add New Monitor**:
   - Type: HTTP(s)
   - URL: `https://tu-api.onrender.com/health`
   - Monitoring Interval: 5 minutes
3. Opcional: monitor separado para disparar sync periódico desde afuera:
   - Type: HTTP(s) POST
   - URL: `https://tu-api.onrender.com/sync`
   - Custom Header: `X-API-Key: <tu SYNC_API_KEY de Render>`
   - Interval: 60 minutes
   (Esto además te da métricas de uptime bonitas para mostrar en la charla.)

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `CORS error` en el browser | `CORS_ORIGIN` no matchea el dominio de Vercel | Ponelo **exacto**, incluyendo `https://`, sin slash final. |
| Cookie no viaja al backend | `SameSite` / `Secure` mal configurados | Render tiene que tener `AUTH_COOKIE_SAMESITE=none` y `AUTH_COOKIE_SECURE=true`. |
| "Failed to load resource: 401" en `/auth/me` | La sesión no se está guardando | Verificá que `AUTH_COOKIE_DOMAIN` esté **vacío** (cookie host-only). |
| Login con Google da `idpiframe_initialization_failed` | El origin de Vercel no está en la lista de Google | Añadilo en Credentials → Authorized JavaScript origins. |
| Primer request tarda ~40s | Render dormido + Neon suspendido | UptimeRobot cada 5 min lo evita. |
| `ERROR: SSL connection is required` | `DATABASE_URL` sin `?sslmode=require` | Agregalo al connection string. |
| Build falla con `No workspaces found: --workspace=apps/api` | Configuraste `rootDir: apps/api` (Render) o `Root Directory: apps/web` (Vercel) | Dejá Root Directory **vacío** en ambos. Los `render.yaml` y `vercel.json` del repo usan comandos con `--workspace` desde la raíz. |
| Build falla con `sh: tsc: not found` o `Cannot find module 'drizzle-kit'` en Render | `NODE_ENV=production` hace que `npm install` salte devDependencies, y `tsc` está ahí | Build Command tiene que incluir `--include=dev`: `npm ci --include=dev && npm run build --workspace apps/api`. |
| Chat responde con texto genérico | No hay `OPENAI_API_KEY` | En prod, Ollama se omite automáticamente; sin OpenAI/Gemini, cae al fallback heurístico. |
| `/events` devuelve `[]` la primera vez | Sync aún corriendo en background | Esperá ~35s, la UI lo detecta vía SSE y refresca sola. |

---

## Actualizaciones futuras

- `git push` a `main` → Render y Vercel despliegan automáticamente.
- Nuevas migraciones de Drizzle: se aplican en el bootstrap del backend
  (`runMigrations()` en `index.ts`), nada manual.
- Nuevos chapters LATAM: se descubren automáticamente la próxima vez que
  caduca el cache de 24h.

---

## Costos reales (al día de hoy)

| Servicio | Plan | Límite | Suficiente para |
|---|---|---|---|
| Neon | Free | 512 MB storage, 0.25 vCPU | ~50k eventos + usuarios reales |
| Render | Free | 512 MB RAM, 750 hrs/mes | 1 instancia 24/7 (con cold start) |
| Vercel | Hobby | 100 GB bandwidth | Cualquier tráfico razonable |
| OpenAI | pay-as-you-go | $0.15/MTok `gpt-4o-mini` | ~5k chats/mes con $2 |
| **Total** | | | **~$0–2/mes** |

Si alguna vez superás los límites, el primer upgrade obvio es Render
($7/mes por instancia siempre despierta) o Neon ($19/mes por capacidad
extra). Todo lo demás sigue en tier gratis.
