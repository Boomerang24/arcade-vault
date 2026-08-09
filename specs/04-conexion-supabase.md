# 04 — Conexión con Supabase

**Estado:** Implemented
**Depende de:** Ninguno
**Fecha:** 2026-08-08

**Objetivo:** Configurar el cliente de Supabase (browser y server) en la app Next.js, con variables de entorno y una ruta de verificación temporal, sin implementar autenticación real ni tablas todavía.

## Alcance

**Incluye:**

- Instalar las dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Cliente de browser: `lib/supabase/client.ts`, exporta una función `createClient()` que usa `createBrowserClient(url, anonKey)` de `@supabase/ssr`.
- Cliente de servidor: `lib/supabase/server.ts`, exporta una función async `createClient()` que usa `createServerClient` de `@supabase/ssr` con el manejo de cookies de `next/headers`, para uso en Server Components y Route Handlers.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`:
  - Añadidas sin valores a `.env.template` (versionado).
  - Añadidas con los valores reales del proyecto a `.env.local` (no versionado; el usuario completa los valores manualmente después de la implementación).
- Ruta de verificación temporal `app/api/health/supabase/route.ts` (`GET`): instancia el cliente de servidor, llama a `supabase.auth.getSession()`, y responde `200 { ok: true }` si no hay error, o `500 { ok: false, error }` si falla (por ejemplo, env vars faltantes o URL inválida).

**No incluye (fuera de alcance):**

- Reemplazar el login/signup falso de `app/iniciar-sesion/page.tsx` (localStorage vía `components/auth-provider.tsx`) por Supabase Auth — spec futuro.
- Autenticación con Google/GitHub OAuth — spec futuro.
- Tablas `profiles` y `scores` y sus migraciones — spec futuro, aunque el objetivo general del proyecto incluye auth + puntuaciones + perfiles reales.
- `middleware.ts` para refresco de sesión — no aplica todavía porque no hay login real; se agrega en el spec de autenticación.
- Realtime y Edge Functions — mencionados como visión a futuro, fuera de alcance de este spec.
- Cambios a `lib/data.ts` (`GAMES`, `seededScores`) o a `/salon-de-la-fama` — se mantienen como están.
- Crear el proyecto de Supabase — el usuario ya tiene uno creado y proveerá la URL y la anon key manualmente en `.env.local`.

## Modelo de datos

No se introducen estructuras de datos ni tablas en Supabase. Este spec solo configura la conexión (clientes + variables de entorno); las tablas `profiles` y `scores` se definirán en un spec futuro.

## Plan de implementación

1. **Instalar dependencias.** `npm install @supabase/supabase-js @supabase/ssr`.
2. **Variables de entorno.** Agregar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` a `.env.template` (sin valores). Agregar ambas a `.env.local` con los valores reales del proyecto (el usuario los completa).
3. **Cliente de browser.** Crear `lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr`, leyendo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts` con una función async `createClient()` usando `createServerClient` de `@supabase/ssr`, integrando `cookies()` de `next/headers` según el patrón oficial de Supabase para Next.js App Router.
5. **Ruta de verificación.** Crear `app/api/health/supabase/route.ts` (`GET`): instancia el cliente de servidor, llama `supabase.auth.getSession()`, responde `{ ok: true }` (200) si no hay error o `{ ok: false, error }` (500) si falla.
6. **Revisión final.** Con `.env.local` configurado, visitar `/api/health/supabase` y confirmar `{ ok: true }`. Correr `npm run build` y confirmar que no hay errores de tipos ni de build.

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` están declarados en `package.json`.
- [ ] `lib/supabase/client.ts` exporta un cliente de Supabase utilizable desde componentes cliente.
- [ ] `lib/supabase/server.ts` exporta un cliente de Supabase utilizable desde Server Components y Route Handlers, usando cookies de `next/headers`.
- [ ] `.env.template` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores.
- [ ] Con `.env.local` configurado con credenciales reales, `GET /api/health/supabase` responde `200 { ok: true }`.
- [ ] Si las variables de entorno faltan o son inválidas, `/api/health/supabase` responde con un error claro (`ok: false`) en vez de lanzar una excepción no controlada.
- [ ] `npm run build` completa sin errores de tipos ni de build.
- [ ] `app/iniciar-sesion/page.tsx`, `lib/data.ts` y `components/auth-provider.tsx` no se modifican.

## Decisiones tomadas y descartadas

- **Alcance reducido a solo la conexión, sin auth ni tablas todavía.** Decisión explícita del usuario: aunque la visión del proyecto incluye auth + puntuaciones + perfiles reales (y a futuro realtime + edge functions), este spec sienta únicamente la base de conexión; el resto llega en specs incrementales futuros.
- **`@supabase/supabase-js` + `@supabase/ssr`, en vez de solo `supabase-js`.** Sienta la base correcta para Server Components / Route Handlers en el App Router antes de implementar auth real, evitando un refactor posterior de los clientes.
- **Clientes separados de browser y de servidor**, en vez de un cliente único compartido. Es el patrón oficial recomendado por Supabase para Next.js App Router: el manejo de cookies difiere entre cliente y servidor.
- **Ruta de verificación temporal (`app/api/health/supabase/route.ts`)**, en vez de confiar solo en `npm run build`. Permite confirmar en runtime que la URL y la anon key son válidas y que el proyecto responde, no solo que el código compila.
- **Sin `middleware.ts` de refresco de sesión.** No aplica todavía porque no hay login real; se agrega junto con el spec de autenticación.
- **No se crea ningún proyecto nuevo en Supabase.** El usuario ya tiene uno creado y proveerá `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` manualmente en `.env.local`.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en vez de `NEXT_PUBLIC_SUPABASE_ANON_KEY`.** Durante el Paso 2 se detectó que `.env.local` ya traía la key en el formato moderno de Supabase (`sb_publishable_...`, guardada como `PUBLISHABLE_KEY`) en vez de la legacy anon/JWT key. Se decidió respetar ese nombre en vez de renombrar la variable, y usarlo también en `.env.template` y en los clientes.

## Riesgos identificados

- **Sin `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas en `.env.local`, el cliente falla al instanciarse o al llamar a la API.** Mitigado por el health check (paso 5 del plan), que expone el error de forma clara en vez de romper el build o una página.
- **`@supabase/ssr` requiere manejo correcto de cookies en Route Handlers.** Un manejo incorrecto no compromete nada ahora (sin sesiones reales), pero sentaría una base incorrecta para el spec de autenticación. Mitigado siguiendo el patrón oficial de la documentación de Supabase para Next.js App Router.
