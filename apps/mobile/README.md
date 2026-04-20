# Tech Radar LATAM · Mobile

App nativa iOS + Android con Expo + expo-router + TypeScript. Consume la API de `apps/api` y autentica con Google.

## Estructura

```
apps/mobile/
├── app/                       # rutas de expo-router
│   ├── _layout.tsx            # providers (Auth, Profile) y Stack raíz
│   ├── index.tsx              # gate: redirige a /login o /(tabs)
│   ├── login.tsx              # Sign in with Google (expo-auth-session)
│   ├── (tabs)/
│   │   ├── _layout.tsx        # Tabs: Radar · Chat IA · Perfil
│   │   ├── index.tsx          # Home con recomendaciones + favoritos
│   │   ├── chat.tsx           # Chat IA (POST /chat, protegido)
│   │   └── profile.tsx        # Editar perfil + logout
│   └── event/[id].tsx         # Detalle + favorito + RSVP
├── lib/
│   ├── api.ts                 # cliente fetch (inyecta Bearer, resuelve host Android)
│   ├── auth.tsx               # AuthProvider + useAuth()
│   ├── profile.tsx            # ProfileProvider + useProfile()
│   ├── storage.ts             # expo-secure-store (token) + AsyncStorage (perfil)
│   ├── theme.ts               # colores/espaciado
│   └── types.ts               # tipos compartidos con API
├── app.json, babel, metro     # config Expo + monorepo
└── .env                       # variables públicas (EXPO_PUBLIC_*)
```

## Requisitos

- Node 20+
- Xcode (iOS Simulator) y/o Android Studio (emulador)
- API corriendo en `apps/api`

## Variables de entorno (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=<tu client id WEB de Google Cloud>
# Opcionales, mejoran UX cuando se use dev build:
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

El cliente resuelve host automáticamente: en Android emulador reemplaza `localhost` → `10.0.2.2`.

## Correr

```bash
# Desde la raíz del monorepo
npm install

# API corriendo en paralelo
npm run dev --workspace apps/api

# Móvil (terminal aparte)
npm run --workspace apps/mobile start
```

Luego:
- `i` → iOS Simulator
- `a` → Android emulator
- Escanea el QR con **Expo Go** en un dispositivo físico (misma red Wi-Fi).

En **dispositivo físico**, cambia `EXPO_PUBLIC_API_URL` a tu IP LAN (`http://192.168.x.x:4000`) o usa `ngrok`.

## Auth flow

1. Login screen dispara `expo-auth-session/providers/google` con el Web Client ID.
2. Google devuelve `id_token`.
3. POST `/auth/google` con `{ credential: id_token }` → API devuelve `{ user, token }` (JWT propio).
4. Token se guarda en `expo-secure-store` y se inyecta como `Authorization: Bearer <jwt>` en cada request.
5. `GET /auth/me` al abrir la app valida la sesión; si falla, se borra el token y vuelve a `/login`.

## Dev build (opcional, para UX nativa de Google Sign-In)

Cuando quieras la hoja del sistema en iOS/Android (en lugar del navegador in-app de Expo Go):

1. Crear Client IDs **iOS** y **Android** en Google Cloud con el `bundleIdentifier` / `package` de [app.json](app.json) (`com.techradar.mobile`).
2. Poner los IDs en `.env`.
3. `npx expo prebuild` → genera proyectos nativos.
4. `npx expo run:ios` / `npx expo run:android`.

## Endpoints consumidos

| Endpoint | Pantalla |
|---|---|
| `GET /profile-options` | Perfil |
| `POST /auth/google` | Login |
| `GET /auth/me` | Gate raíz |
| `POST /auth/logout` | Perfil |
| `GET /events/recommended` | Home |
| `GET /events/:id` | Detalle |
| `POST /chat` | Chat IA |
| `GET /me/favorites` | Home + Detalle |
| `POST /me/events/:id/favorite` | Home + Detalle |
| `POST /me/events/:id/rsvp` | Detalle |
