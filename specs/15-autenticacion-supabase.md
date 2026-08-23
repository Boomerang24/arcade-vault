# SPEC 15 — Autenticación real con Supabase Auth

> **Estado:** Approved
> **Depende de:** SPEC 04, SPEC 06
> **Fecha:** 2026-08-22
> **Objetivo:** Reemplazar el login/registro falso de `localStorage` (`components/auth-provider.tsx`) por autenticación real con Supabase Auth (email/contraseña + Google/GitHub OAuth), con sesión persistida vía cookies (`@supabase/ssr`), verificación de email obligatoria, recuperación de contraseña y vínculo de `scores` al usuario autenticado.

---

## Por qué esta spec existe

El spec 04 dejó explícitamente fuera de alcance "reemplazar el login/signup falso de `app/iniciar-sesion/page.tsx` por Supabase Auth — spec futuro" y "`middleware.ts` para refresco de sesión — no aplica todavía porque no hay login real". Esta spec es ese futuro: la UI de `iniciar-sesion` ya existe (tabs login/registro, botones sociales, invitado) pero es enteramente decorativa — `submit()` solo guarda `{ name }` en `localStorage` sin validar nada. Esta spec cablea esa UI a autenticación real sin rediseñarla.

---

## Scope

**Incluye:**

- Registro con email + contraseña + username (`supabase.auth.signUp`, con `options.data.display_name` para el username), sujeto a confirmación de email antes de poder iniciar sesión (comportamiento por defecto de Supabase Auth — no se desactiva "Confirm email").
- Login con email + contraseña (`supabase.auth.signInWithPassword`).
- Login con Google y GitHub OAuth (`supabase.auth.signInWithOAuth`), cableando los botones ya existentes en `app/iniciar-sesion/page.tsx`. Requiere pasos manuales de configuración fuera del editor (ver "Pasos manuales de configuración" más abajo) — el código queda funcional una vez esos pasos se completen.
- Ruta de callback `app/auth/callback/route.ts` (`GET`) que intercambia el `code` de OAuth por una sesión (`exchangeCodeForSession`), patrón oficial de `@supabase/ssr` para App Router.
- `proxy.ts` (raíz del proyecto) + `lib/supabase/middleware.ts`, refrescando la sesión de Supabase en cada request según el patrón oficial de `@supabase/ssr`. Nota: Next.js 16 deprecó el nombre de archivo `middleware.ts` en favor de `proxy.ts` (mismo comportamiento, export renombrado a `proxy`); este spec usa la convención vigente del proyecto en vez del nombre literal de Supabase docs.
- Logout real (`supabase.auth.signOut()`).
- Recuperación de contraseña: enlace "¿Olvidaste tu contraseña?" en el tab de login → `supabase.auth.resetPasswordForEmail(email, { redirectTo: .../restablecer-password })` → página nueva `app/restablecer-password/page.tsx` que llama `supabase.auth.updateUser({ password })` con la sesión de recuperación ya activa.
- Reescritura de `components/auth-provider.tsx`: `user` se deriva de `supabase.auth.getUser()` / `onAuthStateChange` (ya no de `localStorage`); `login`/`logout`/`signUp` pasan a llamar a Supabase; se agrega `resetPassword` y `signInWithOAuth` al contexto.
- Estados de error y carga en `app/iniciar-sesion/page.tsx`: credenciales inválidas, email ya registrado, contraseña débil (<6 caracteres, mínimo de Supabase), email sin confirmar, error de red — cada uno con un mensaje visible en la tarjeta, y el botón de submit deshabilitado + texto "..." mientras la request está en vuelo.
- Migración de `scores`: agregar columna `user_id uuid references auth.users(id)`, nullable (para preservar el flujo de invitado). `saveScore` en `auth-provider.tsx` la incluye cuando hay sesión activa.
- Gating de guardado de puntaje en `components/jugar-client.tsx`: si no hay sesión, el bloque de "guardar puntuación" del modal de game over se reemplaza por un CTA "Inicia sesión para guardar tu puntaje" que enlaza a `/iniciar-sesion`. Si hay sesión, el campo de iniciales se sigue mostrando pero pre-rellenado con el `display_name` del usuario (editable, igual que hoy).
- `components/nav.tsx` muestra `user.user_metadata.display_name` (o el username guardado) y el logout real.
- Después de login/registro/OAuth exitoso, redirect siempre a `/` (igual que el comportamiento actual).
- Modo invitado se mantiene: sin sesión se puede navegar y jugar; solo el guardado de puntaje requiere sesión (ver arriba).

**Fuera de alcance (para futuras specs):**

- Migrar automáticamente las sesiones falsas viejas de `localStorage` (`av_user`). Simplemente dejan de leerse; el usuario debe loguearse de nuevo.
- Página de perfil / "mis puntajes" que use la nueva columna `scores.user_id` — esta spec solo agrega la columna y la puebla, no construye UI sobre ella.
- Roles, permisos o cuentas de administrador.
- Eliminar cuenta / exportar datos (RGPD-like).
- Rate limiting o CAPTCHA en el formulario de registro más allá de lo que Supabase Auth aplica por defecto.
- Cambiar el diseño visual de `app/iniciar-sesion/page.tsx` (tabs, tarjeta, layout) — solo se cablea a datos reales y se agregan estados de error/carga y el enlace de reset, sin rehacer el mockup.
- Row Level Security (RLS) detallada por política en `scores`/`games` más allá de lo mínimo necesario para que `user_id` se pueda insertar desde el cliente autenticado — si el catálogo ya tiene RLS de spec 06, esta spec solo ajusta la policy de insert en `scores` para incluir `user_id`, no audita el resto.

---

## Modelo de datos

```sql
-- Migración sobre la tabla existente `scores`
alter table scores
  add column user_id uuid references auth.users(id);
```

- `user_id` es **nullable**: los invitados no pueden guardar (ver Scope), pero la columna nullable evita romper filas históricas sembradas antes de esta spec.
- No se crea una tabla `profiles`. El username vive en `auth.users.raw_user_meta_data.display_name` (vía `options.data.display_name` en `signUp`), no en una tabla propia — evita una segunda fuente de verdad para un solo campo.
- `components/auth-provider.tsx` — tipo `User` cambia de `{ name: string }` a:

```ts
type User = {
  id: string; // auth.users.id
  email: string;
  name: string; // user_metadata.display_name
};
```

- `ScoreEntry` (ya existente) no cambia de forma pública; `saveScore` internamente agrega `user_id: user?.id ?? null` al insert.

---

## Plan de implementación

1. **Migración de `scores`.** Aplicar la migración de arriba con `mcp__supabase__apply_migration`. El sistema sigue funcional: la columna nueva es nullable y nada la usa todavía.
2. **Middleware de sesión.** Crear `lib/supabase/middleware.ts` (función `updateSession(request)` con el patrón oficial `@supabase/ssr`: `createServerClient` + `getUser()` para refrescar cookies) y `proxy.ts` en la raíz (convención Next.js 16, reemplaza el `middleware.ts` deprecado) que lo invoca con el `matcher` recomendado (excluye assets estáticos). Verificación manual: la app sigue cargando todas las rutas sin errores.
3. **Reescribir `components/auth-provider.tsx`.** `user` se popula desde `supabase.auth.getUser()` en el `useEffect` inicial y se mantiene con `supabase.auth.onAuthStateChange`. Se agregan `signUp(email, password, name)`, `login(email, password)` (renombra el `signInWithPassword`), `signInWithOAuth(provider)`, `logout` (→ `signOut`), `resetPassword(email)`. `saveScore` agrega `user_id`. Verificación manual: `npm run build` pasa (los componentes que usan `useAuth` aún no están actualizados, se espera error de tipos temporal si el resto del paso no se hace en el mismo commit).
4. **Callback de OAuth.** Crear `app/auth/callback/route.ts` (`GET`): lee `code` de `searchParams`, llama `exchangeCodeForSession`, redirige a `/`. Verificación: no se puede probar end-to-end sin credenciales OAuth reales (ver Riesgos), pero la ruta debe compilar y responder sin `code` con un error controlado (no un 500 sin manejar).
5. **Página `restablecer-password`.** Crear `app/restablecer-password/page.tsx`: formulario de nueva contraseña, llama `supabase.auth.updateUser({ password })`, muestra éxito/error, redirige a `/` tras éxito. Verificación manual: formulario renderiza y valida longitud mínima antes de enviar.
6. **Cablear `app/iniciar-sesion/page.tsx`.** Tab "Iniciar sesión" llama a `login(email, pass)`; tab "Crear cuenta" llama a `signUp(email, pass, user)`; agregar el campo de email también al tab de login (hoy solo pide "Usuario"); botones GOOGLE/GITHUB llaman `signInWithOAuth`; agregar enlace "¿Olvidaste tu contraseña?" que llama `resetPassword(email)` y muestra confirmación. Agregar estado de error visible y estado de carga (botón deshabilitado). Verificación manual en navegador: registrar una cuenta real, ver el correo de confirmación (o el log de Supabase si el email no está configurado en el proyecto), intentar login antes de confirmar (debe fallar con mensaje claro), confirmar y loguear con éxito.
7. **`components/nav.tsx`.** Mostrar `user.name`, logout real. Verificación visual: el botón de cuenta cambia de "Iniciar Sesión" a `{name} ▾` tras loguear, y de vuelta tras logout.
8. **`components/jugar-client.tsx`.** Gating del guardado de puntaje descrito en Scope. Verificación manual: jugar sin sesión → modal de game over muestra el CTA de login en vez del input; jugar con sesión → input de iniciales pre-rellenado con el username, guardar funciona y el score queda con `user_id` no nulo (verificar con `mcp__supabase__execute_sql`).
9. **Revisión final.** `npm run build` sin errores. Flujo completo en navegador: registro → confirmación de email → login → jugar de invitado (sin guardar) → logout → login → jugar → guardar puntaje → aparece en `/salon-de-la-fama` y en el leaderboard del juego → reset de contraseña de punta a punta.

### Pasos manuales de configuración (fuera del editor, a cargo del usuario)

- **Confirmación de email:** verificar en el dashboard de Supabase (Authentication → Providers → Email) que "Confirm email" está activado (es el default).
- **Google OAuth:** crear credenciales OAuth 2.0 en Google Cloud Console, agregar el redirect URI que expone Supabase, y pegar Client ID/Secret en Authentication → Providers → Google.
- **GitHub OAuth:** crear una OAuth App en GitHub Developer Settings, mismo patrón, en Authentication → Providers → GitHub.
- **Email de reset de contraseña:** confirmar que la plantilla "Reset Password" del dashboard de Supabase apunta a `.../restablecer-password` (`redirectTo` ya lo fuerza desde el código, pero la plantilla de correo debe usar `{{ .ConfirmationURL }}` sin overrides que la rompan).

---

## Criterios de aceptación

- [x] `npm run build` completa sin errores de tipos ni de build.
- [x] Registrar una cuenta nueva con email + contraseña + username crea el usuario en Supabase Auth y no permite iniciar sesión hasta confirmar el email.
- [x] Tras confirmar el email, el login con esas credenciales funciona y redirige a `/`.
- [x] Login con credenciales inválidas muestra un mensaje de error visible en la tarjeta, sin excepción no controlada en consola.
- [x] Logout limpia la sesión (`user` vuelve a `null`) y el botón de nav vuelve a "Iniciar Sesión".
- [x] "¿Olvidaste tu contraseña?" envía el correo de recuperación (verificado hasta el 429 de rate-limit del plan gratuito de Supabase; ver nota abajo) y `app/restablecer-password/page.tsx` permite setear una contraseña nueva — **verificación manual pendiente** del clic real en el correo, no bloqueante (mismo criterio que OAuth).
- [x] Sin sesión activa, el modal de fin de juego no permite guardar el puntaje y muestra el CTA de login en su lugar.
- [x] Con sesión activa, guardar un puntaje inserta una fila en `scores` con `user_id` igual al `id` del usuario logueado (verificado con `mcp__supabase__execute_sql`, fila de prueba luego eliminada).
- [x] El modo invitado (navegar y jugar sin cuenta) sigue funcionando exactamente igual que antes de este spec, salvo el guardado de puntaje.
- [x] Los botones GOOGLE/GITHUB llaman a `signInWithOAuth` y compilan sin error — el flujo end-to-end de OAuth queda marcado como **verificación manual pendiente** hasta que el usuario complete los pasos de configuración externos (ver arriba); no es bloqueante para cerrar esta spec.
- [x] `proxy.ts` refresca la sesión sin romper ninguna ruta existente (`/`, `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon-de-la-fama`, `/about`, `/iniciar-sesion`).

---

## Decisiones

- **Sí:** confirmación de email obligatoria (default de Supabase Auth). Razón: evita cuentas basura sin costo adicional de implementación; el usuario lo confirmó como preferencia.
- **Sí:** incluir Google/GitHub OAuth en esta spec, aunque su verificación end-to-end dependa de configuración manual externa. Razón: decisión explícita del usuario; el código queda listo para cuando la configuración externa se complete, en vez de abrir una spec aparte solo para cablear dos llamadas a `signInWithOAuth`.
- **Sí:** `user_id` nullable en `scores` en vez de obligatorio. Razón: preserva el modo invitado para jugar (aunque no para guardar) y no rompe las filas sembradas antes de esta spec.
- **Sí:** username en `user_metadata.display_name` en vez de una tabla `profiles` nueva. Razón: es el único campo de perfil que existe hoy; una tabla aparte sería sobre-ingeniería hasta que haya más de un campo que gestionar (avatar, bio, etc.) — se documenta explícitamente para cuando llegue ese momento.
- **No:** migrar automáticamente las sesiones falsas de `localStorage`. Razón: no hay usuarios reales en producción con `av_user` hoy (etapa temprana), y no hay contraseña previa que migrar — no hay nada real que preservar.
- **No:** tabla `profiles` separada, RLS granular más allá de `scores.user_id`, rate limiting custom, eliminar cuenta. Razón: ninguno fue mencionado como necesidad actual; quedan para specs futuros si surge la necesidad.
- **No:** rediseñar visualmente `app/iniciar-sesion/page.tsx`. Razón: el mockup ya está aprobado (specs 01/13); esta spec es de cableado a datos reales, no de diseño.

---

## Riesgos

| Riesgo                                                                                                                                     | Mitigación                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth (Google/GitHub) no se puede probar end-to-end sin credenciales reales configuradas fuera del editor.                                 | Código y ruta de callback quedan implementados y compilando; el criterio de aceptación de OAuth queda marcado como verificación manual pendiente, no bloqueante.  |
| Confirmación de email no funciona si el proyecto de Supabase no tiene un proveedor SMTP configurado (usa el default limitado de Supabase). | Se documenta como parte de los pasos manuales; en desarrollo se puede leer el link de confirmación desde los logs de Supabase Auth sin depender del correo real.  |
| `proxy.ts` mal configurado puede bloquear rutas públicas o crear loops de redirect.                                                        | `matcher` sigue el patrón oficial de `@supabase/ssr` (excluye estáticos); verificación manual de las 7 rutas listadas en Criterios de aceptación antes de cerrar. |
| Password reset con `redirectTo` mal formado en producción vs. desarrollo (URL absoluta vs relativa).                                       | Usar `${process.env.NEXT_PUBLIC_SITE_URL ?? request origin}` como base; si `NEXT_PUBLIC_SITE_URL` no existe aún en `.env.template`, se agrega en esta spec.       |

---

## Qué **no** está en esta spec

- Migración automática de sesiones `localStorage` viejas.
- Página de perfil / historial de "mis puntajes".
- Roles, permisos, cuentas de administrador.
- Eliminar cuenta o exportar datos.
- Rediseño visual de la pantalla de auth.
- RLS granular más allá del insert de `scores.user_id`.

Cada uno de estos, si se necesita, va en su propia spec.
