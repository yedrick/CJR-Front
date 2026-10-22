# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Frontend de **CJN Campamentos** (inscripciones a campamentos, talleres, olimpiadas, pagos y panel de administración) en React 19 + TypeScript + Vite + Tailwind v4. Toda la UI, los comentarios y los mensajes de error están en español: mantén ese idioma.

## Comandos

```bash
npm run dev            # vite --mode testing en :3000 (usa .env.testing → API simulada)
npm run dev:prod       # dev con .env.production
npm run build          # build de producción (genera también dist/sw.js)
npm run build:testing  # build con .env.testing
npm run preview:testing
npm run lint           # = tsc --noEmit (no hay ESLint)
npm run docs:api       # regenera docs/API.md desde src/api/routes.ts
```

- No hay framework de tests. La verificación es `npm run lint` + `npm run build` + probar en el navegador (con `playwright-cli`).
- `npx tsc --noEmit --noUnusedLocals` sirve para detectar código muerto.
- Hay `pnpm-lock.yaml` y `bun.lock`; los scripts se ejecutan con npm/pnpm indistintamente.

## Entornos y API simulada

- La configuración está tipada en [src/config/env.ts](src/config/env.ts) y sale de `.env.testing` / `.env.production` (plantilla: `.env.example`). Todas son `VITE_*` y quedan incrustadas en el bundle.
- `VITE_USE_MOCK_API=true` hace que **todo el backend corra en el navegador**: [src/api/mock/](src/api/mock/) implementa JWT, sesiones, permisos, validaciones y códigos HTTP reales. Su base vive en `localStorage` (`cjn_mock_db_v1`).
- Si cambias los datos semilla o la forma de `MockDb` ([db.ts](src/api/mock/db.ts)), sube `DB_VERSION`. Si no, los navegadores siguen usando la base vieja guardada.
- Las cuentas demo (`superadmin@cjn.bo` / `Super123*`, `admin@cjn.bo` / `Admin123*`, etc.) están en [demoAccounts.ts](src/api/mock/demoAccounts.ts).
- `VITE_MOCK_LATENCY_MS` y `VITE_MOCK_ERROR_RATE` simulan latencia y errores 500.

## Arquitectura

### Contrato de la API: una sola fuente de verdad

[src/api/routes.ts](src/api/routes.ts) (`API_ROUTES`) define cada endpoint: id, método, path, `access` y errores posibles. De ahí salen todas las capas:

- [src/api/services.ts](src/api/services.ts): wrappers tipados (`campsApi`, `registrationsApi`…) que llaman a `apiRequest(routeId, …)`.
- [src/api/http.ts](src/api/http.ts) elige el adaptador (mock o `fetch` a `VITE_API_URL`). También agrega el Bearer, renueva el token ante un 401 con un único reintento, y convierte las respuestas de error en `ApiError` ([errors.ts](src/api/errors.ts)).
- [src/api/mock/server.ts](src/api/mock/server.ts) enruta con el mismo catálogo y aplica `access` antes de llamar al handler de [handlers.ts](src/api/mock/handlers.ts). Para el acceso `{ own, or }`, la propiedad del recurso la valida el handler (`grantedByPermission`).
- El Explorador de API del panel y `docs/API.md` también se generan desde ese catálogo.

**Para agregar un endpoint:** ruta en `routes.ts` → handler en `handlers.ts` (y registrarlo en `HANDLERS`) → método en `services.ts` → `npm run docs:api`.

### Permisos

[src/auth/permissions.ts](src/auth/permissions.ts) define `PERMISSIONS`, `DEFAULT_ROLES`, `ROLE_LABEL`/`ROLE_TONE` y `hasPermission`. Los roles son editables, así que la UI debe decidir por **permiso** (`useAuth().can(...)`), no por id de rol.

### Navegación (sin router)

No hay react-router. [src/auth/access.ts](src/auth/access.ts) (`VIEW_ROUTES`) mapea cada URL a un `ViewTab`, con su título y el permiso que exige.

- `CampContext` guarda la pantalla activa y sincroniza la URL con `pushState`/`popstate`. Para navegar se usa `setActiveTab(tab, params)`.
- [App.tsx](src/App.tsx) renderiza la pantalla según `activeTab`; las de `admin-*` van dentro de `AdminLayout`.
- **Para agregar una pantalla:** tipo en `ViewTab` ([types/camp.ts](src/types/camp.ts)) → entrada en `VIEW_ROUTES` → render en `App.tsx` → enlace en `AdminLayout`/`Navbar`.

### Estado global

Orden de los providers: `ToastProvider` → `AuthProvider` → `CampProvider` → `ConfirmProvider`.

- `AuthContext` restaura la sesión con el refresh token al cargar (`isRestoring`) y expone `currentUser`, `can`, `requireLogin`, etc.
- `CampContext` es el store de datos. Carga los datos públicos y privados cuando termina la restauración, y vuelve a cargarlos cuando cambian el usuario o sus permisos.
  - Las mutaciones pasan por `run()`: si la llamada falla, muestra el toast de error y devuelve `null`, así que el componente no recibe el `ApiError`.
  - Cuando un formulario necesita los errores por campo (422), llama al servicio directamente, como hacen `EnrollmentWizard` o `UsersManager`.
- Para avisos y confirmaciones usa `useToast()` (`toast`, `toastError`) y `useConfirm()` (`confirm`, `notify`), no `alert`/`confirm`.

### Código compartido: reutilízalo antes de escribir helpers locales

- [src/utils/campUtils.ts](src/utils/campUtils.ts):
  - Fechas: `todayISO`, `nowStamp`, `nowLocalStamp`, `formatShortDate`/`formatLongDate`/`formatDateRange`.
  - Formato y texto: `formatBs`, `normalizeText`/`stripAccents`, `digitsOf`, `plural`.
  - Campamentos y talleres: `getCampPhase` + `PHASE_META`, `courseWindowState`, `coursesOverlap`.
  - Otros: `isPaymentPending`, `openImageInNewTab`, `readFileAsDataUrl`.
- [src/utils/validation.ts](src/utils/validation.ts): `EMAIL_RE`, `PHONE_RE` (celular boliviano), `localPhone`. Las reglas de contraseña están en [PasswordPolicy.tsx](src/components/auth/PasswordPolicy.tsx).
- [src/components/admin/ui.tsx](src/components/admin/ui.tsx): `Modal`, `Field`, `TextInput`, `SelectInput`, `Button`, `Badge`, `EmptyState`, `Toggle`, `ImageInput`, `CampFilterSelect`. Los usan también las pantallas públicas.
- [src/components/common/Portal.tsx](src/components/common/Portal.tsx): `Portal`, `useLockBodyScroll`, `useEscapeKey` para modales y overlays.
- El servidor mock repite a propósito algunas validaciones (regex y contraseña), porque imita al backend real.

### PWA

- No usa ningún plugin. El plugin `cjnServiceWorker` de [vite.config.ts](vite.config.ts) genera `dist/sw.js` en el build a partir de [src/pwa/sw-template.js](src/pwa/sw-template.js), con el precache y una versión calculada del contenido.
- En `vite dev` no hay service worker. Lo registra [src/pwa/registerSW.ts](src/pwa/registerSW.ts), y las notificaciones se consultan cada `VITE_NOTIFICATIONS_POLL_MS`.
- El proyecto viene de Google AI Studio (`.aistudio/`, `metadata.json`). La configuración de HMR/watch en `vite.config.ts` depende de `DISABLE_HMR` y no debe modificarse.
