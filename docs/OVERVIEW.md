# Tech Radar LATAM — Guía para colaboradores

> Un radar de eventos tech LATAM que entiende tu perfil y te explica el porqué.
> Pensado para hacer visible la actividad de comunidades grandes y chicas por
> igual (sí, Quito y Cuenca cuentan 😉).

Esta guía te pone al día en **10 minutos**. Si algo queda confuso, abre un
issue o preguntá en el canal del chapter.

---

## 1. Qué resuelve

Hoy la agenda tech de la región vive repartida entre **Meetup, Eventbrite,
GDG, Twitter/X, Discord y grupos privados**. Descubrir lo que importa
implica revisar 4 sitios distintos, con filtros pobres y sin contexto.

Los chapters pequeños (GDG Cuenca, Machala....) quedan invisibles
porque quedan enterrados bajo los eventos masivos de Brasil y EE. UU.

Tech Radar LATAM:

- **Agrega** eventos reales de Meetup, Eventbrite y GDG (sin fallback/seed).
- **Descubre chapters pequeños** iterando los IDs de GDG en `/api/search/`
  + scraping del `chapterId` del HTML, así Cuenca o Machala siempre aparecen
  aunque no tengan nada publicado en las próximas dos semanas.
- **Limpia y deduplica** eventos que se publican en varias fuentes.
- **Enriquece con IA** (nivel, tags, resumen corto) con fallback a
  heurísticas cuando no hay API key.
- **Rankea por perfil**: país, rol, nivel, intereses, cercanía temporal.
  Cada recomendación viene con **razones explicables** (nada de caja negra).
- **Chat conversacional**: “Eventos de IA esta semana en Ecuador para
  junior” → lista filtrada + explicación.
- **Favoritos y RSVP** persistidos en Postgres, login con Google.
- **Tiempo real con SSE**: cuando el sync termina, todos los browsers
  conectados reciben la notificación sin polling.

---

## 2. Cómo impacta a la comunidad tech LATAM

| Público | Valor |
|---|---|
| **Juniors** que arrancan | Filtro por nivel + chat natural; ranking explica por qué se recomienda algo |
| **Chapters chicos** (Cuenca, Machala, Sincelejo…) | Aparecen con su propio filtro de ciudad, no quedan tapados por chapters masivos |
| **Organizadores** | Pueden medir qué tan visible es su evento vs. otros del país/nivel |
| **Comunidad regional** | Visibilidad cruzada entre países (ver qué pasa en México estando en Ecuador) |
| **Contribuidores open-source** | Stack familiar (TS + React + Express + Postgres + Drizzle). Primer PR en <1h |

---

## 3. Arquitectura

```
┌──────────────┐   SSE / HTTPS    ┌────────────────────┐
│  apps/web    │ ───────────────▶ │                    │
│  (React 19)  │ ◀────────────── │                    │
└──────────────┘                   │   apps/api         │
                                   │   (Express + TS)   │
┌──────────────┐   Bearer JWT      │                    │
│  apps/mobile │ ───────────────▶ │                    │
│  (Expo 52)   │                   └────┬──────────┬────┘
└──────────────┘                        │          │
                                 Drizzle │          │ fetch
                                        ▼          ▼
                                  ┌────────┐  ┌──────────────┐
                                  │ Postgres│  │  Meetup /    │
                                  │   16    │  │  Eventbrite/ │
                                  │ (Docker)│  │  GDG         │
                                  └────────┘  └──────────────┘
                                                   │
                                                   ▼
                                             ┌────────────┐
                                             │   IA       │
                                             │ (Ollama /  │
                                             │  OpenAI /  │
                                             │  Gemini /  │
                                             │  fallback) │
                                             └────────────┘
```

**Servicios y módulos clave** (todos en TypeScript):

- `apps/api/src/services/{meetup,eventbrite,gdg,sync}.service.ts` —
  ingesta y orquestación.
- `apps/api/src/lib/event-processing.ts` — limpieza, dedupe, enriquecimiento IA
  en paralelo por lotes de 6.
- `apps/api/src/lib/ranking.ts` — score + razones por evento.
- `apps/api/src/lib/ai.ts` — abstracción sobre Ollama/OpenAI/Gemini, con
  `fetchWithTimeout` y fallback cuando no hay keys.
- `apps/api/src/lib/auth.ts` — Google Identity Services + JWT firmado.
- `apps/api/src/lib/event-bus.ts` — `EventEmitter` para empujar SSE cuando el
  sync termina.
- `apps/api/src/db/{schema,client,migrate}.ts` — Drizzle schema para
  `events`, `users`, `user_events`.
- `apps/web/src/auth/{AuthContext, GoogleAuthBridge, GoogleSignIn, UserMenu}.tsx`
  — auth en el cliente. El `GoogleAuthBridge` monta
  `@react-oauth/google` usando el Client ID que devuelve `/auth/config`
  (única fuente de verdad).
- `apps/mobile/app/login.tsx` + `apps/mobile/lib/auth.tsx` — Google Sign-In
  con `@react-native-google-signin/google-signin` y token guardado en
  `expo-secure-store`.

---

## 4. Stack decisions (con el porqué)

| Decisión | Por qué |
|---|---|
| **Monorepo npm workspaces** | Compartir tipos/archivos entre web, mobile y api sin publicar paquetes |
| **Postgres + Drizzle** (no Prisma) | Drizzle es ESM nativo, sin paso de `generate`, schema en 1 archivo TS con tipos inferidos |
| **Docker para Postgres local** | `docker compose up -d` y listo. Puerto 5434 para no chocar con Postgres locales comunes |
| **Google Identity Services** (vs Auth0/Clerk/Supabase) | Cero dependencias SaaS, cookie httpOnly propia, sigue funcionando cuando Clerk esté caído |
| **SSE** (vs WebSocket) | Un push unidireccional es suficiente; SSE reconecta solo; cero requests extra a fuentes externas |
| **IA cascada**: Ollama → OpenAI → Gemini → fallback heurístico | Que funcione aunque no tengas tarjeta de crédito. En desarrollo local corre sin keys |
| **Fallback events removido** | Para presentar a la comunidad real, los datos tienen que ser reales. Si las fuentes fallan, el empty state explica por qué |
| **Drizzle con pgEnum** para `source` y `level` | Integridad real a nivel DB, no solo a nivel aplicación |

---

## 5. Poner el proyecto a correr en 5 minutos

```bash
# 1. Clonar y dependencias
git clone https://github.com/xtaxx12/tech_radar.git
cd tech_radar
npm install

# 2. Postgres local con Docker
docker compose up -d

# 3. Configurar .env
cp apps/api/.env.example apps/api/.env
# Editá apps/api/.env con tu DATABASE_URL (el default de docker compose matchea)
cp apps/web/.env.example apps/web/.env    # opcional
cp apps/mobile/.env.example apps/mobile/.env  # si vas a correr móvil

# 4. Migraciones (drizzle-kit) — se corren también en el bootstrap de la API
npm -w apps/api run db:migrate

# 5. Dev (API + web en paralelo)
npm run dev
```

Listo: `http://localhost:5173` (web) y `http://localhost:4000` (API).
El primer sync tarda ~35 seg porque descubre los chapters GDG LATAM; después
queda cacheado 24 h.

**Móvil** (opcional, en otra terminal):
```bash
npm run --workspace apps/mobile start   # iOS: presioná `i`. Android: `a`.
```

---

## 6. Estructura del repo

```
tech_radar/
├─ apps/
│  ├─ api/          # Express + TS (puerto 4000)
│  │  ├─ src/
│  │  │  ├─ db/            # schema Drizzle, pool pg, migrador
│  │  │  ├─ lib/           # auth, ai, event-bus, ranking, text, ...
│  │  │  ├─ middleware/    # requireAuth, optionalAuth
│  │  │  ├─ repositories/  # events, users, user-events (Drizzle)
│  │  │  └─ services/      # meetup, eventbrite, gdg, sync
│  │  └─ drizzle/   # migraciones SQL versionadas
│  ├─ web/          # React 19 + Vite (puerto 5173)
│  │  └─ src/
│  │     ├─ auth/          # AuthContext + GoogleAuthBridge
│  │     └─ components/    # EventCard, EventDetail, FilterBar, ...
│  └─ mobile/       # Expo SDK 52 + expo-router
│     ├─ app/             # rutas
│     ├─ components/      # UI reutilizable
│     └─ lib/             # api, auth, profile, theme, haptics
├─ docker-compose.yml
├─ docs/            # ← estás acá
└─ README.md
```

---

## 7. Cómo contribuir

1. **Fork + branch desde `main`** con nombre `feat/...`, `fix/...` o `docs/...`.
2. **Corré `npm run lint` y `npm run build`** antes de hacer push — CI los
   corre también.
3. **PR en español o inglés** (ambos están bien). Incluí:
   - Qué resolvés y por qué.
   - Screenshot / GIF si tocaste UI.
   - Cómo lo probaste localmente.
4. **Commits**: estilo convencional (`feat(api): …`, `fix(web): …`).
   No requerido, pero ayuda al changelog.
5. **Issues**: marcá con la etiqueta `good-first-issue` los que ya tienen
   alcance claro para gente nueva.

### Áreas bienvenidas para contribuir

- **Más fuentes**: agregar ingesta de Lu.ma, Devfolio, Platzi Events, etc.
- **Más países**: Suriname, Guyana, Belice, Caribe anglófono.
- **Mejoras de ranking**: user feedback loop (“no me interesa este tipo”).
- **Internacionalización**: i18n en el web para portugués (Brasil) e inglés.
- **Observabilidad**: métricas de sync (qué fuente suele fallar, tiempos).
- **Accesibilidad**: auditoría con Lighthouse, tests con axe.
- **Mobile**: notificaciones push cuando un evento favorito está cerca.

---

## 8. Troubleshooting rápido

| Síntoma | Causa probable | Fix |
|---|---|---|
| `role "postgres" does not exist` | Colisión con Postgres local en :5432 | El docker-compose usa :5434; revisá `DATABASE_URL` |
| Login de Google no aparece | Falta `GOOGLE_CLIENT_ID`, `AUTH_SESSION_SECRET` o `DATABASE_URL` en backend | Los 3 son obligatorios; si falta uno, auth se deshabilita |
| Dropdown de país no muestra ciudades | Primer sync aún corriendo | Esperá ~35 s (discovery de chapters GDG) o presioná “Reintentar sincronización” |
| `/chat` devuelve 401 | Auth está habilitada y la sesión expiró | Login con Google de nuevo |
| Cuenca/Machala no aparecen | Son chapters sin eventos futuros publicados | El service trae los últimos ≤12 meses; si aún así están vacíos es porque GDG no tiene nada registrado |

---

## 9. Roadmap público

- [x] Migración a PostgreSQL + Drizzle
- [x] Auth con Google (web + mobile)
- [x] SSE para tiempo real sin hammering de fuentes
- [x] Discovery de chapters chicos GDG LATAM
- [ ] Notificaciones push (mobile) para eventos favoritos cercanos
- [ ] Métricas de sync expuestas en un `/admin`
- [ ] Integración de más fuentes (Lu.ma, Devfolio)
- [ ] i18n (pt-BR, en)
- [ ] Deploy público en producción (Railway / Fly.io)

---

## 10. Contacto

- **Maintainer actual**: @xtaxx12
- **Repo**: https://github.com/xtaxx12/tech_radar
- **Charla GDG Quito Build with AI** → ver [`docs/PRESENTATION.md`](./PRESENTATION.md).

> Si te entusiasma que la comunidad tech latinoamericana deje de estar
> dispersa, éste es un buen lugar para empezar a contribuir. ¡Bienvenidx!
