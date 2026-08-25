# Auditoría de seguridad — Ledger

Memoria persistente de `@security-auditor`. Solo ese agente escribe aquí.
Insumo histórico de solo lectura: `references/security/security-checklist.md`.

## Estado por área

| Área                          | Estado    | Abiertos | Última auditoría |
| ----------------------------- | --------- | -------- | ---------------- |
| DB · RLS y policies           | pendiente | 1        | 2026-08-24       |
| DB · funciones y grants       | pendiente | 1        | 2026-08-24       |
| Auth · configuración Supabase | pendiente | 2        | 2026-08-24       |
| App · headers HTTP            | OK        | 0        | 2026-08-24       |
| App · rutas y proxy           | pendiente | 1        | 2026-08-24       |
| App · API routes              | pendiente | 2        | 2026-08-24       |
| App · secrets y env           | OK        | 0        | 2026-08-24       |
| App · validación de input     | pendiente | 1        | 2026-08-24       |

## Hallazgos abiertos

### SEC-001 — Leaked Password Protection deshabilitada

**Severidad:** media · **Área:** Auth · configuración Supabase · **Estado:** abierto
**Detectado:** 2026-08-23 · **Evidencia:** advisor `auth_leaked_password_protection` (WARN, sigue activo)
**Riesgo:** un usuario puede registrarse con una contraseña ya filtrada en brechas conocidas (HaveIBeenPwned); Supabase no la rechaza.
**Remediación propuesta:** ninguna equivalente en código — toggle de dashboard.
**Acción:** paso manual de dashboard (ver abajo), ya documentado en spec 16.

### SEC-002 — `app/api/contact/route.ts` sin validación de formato ni rate limiting

**Severidad:** media · **Área:** App · API routes · **Estado:** abierto
**Detectado:** 2026-08-23 · **Evidencia:** `app/api/contact/route.ts:5-21`
**Riesgo:** solo valida presencia (`.trim()`) de `name`/`email`/`msg`, sin validar formato de email ni longitud máxima. `email` se usa directo como `replyTo` y `name` se interpola sin escapar en `subject: \`Nuevo mensaje de contacto de ${name}\``: un `name`con`\r\n`o caracteres de control podría intentar header injection hacia Resend (mitigado en la práctica si el SDK de Resend sanea el subject, pero no verificado aquí). Sin rate limiting, el endpoint es un vector de spam/abuso del remitente configurado.
**Riesgo:** cualquiera con la URL puede disparar envíos ilimitados de correo en nombre del proyecto.
**Remediación propuesta:** validar formato de email con una regex simple, limitar longitud de`name`/`msg`, y evaluar rate limiting básico (por IP o por ventana de tiempo) antes de llamar a Resend.
**Acción:** `/spec endurecer app/api/contact/route.ts: validar formato de email, longitud máxima de campos y rate limiting básico`.

### SEC-003 — `proxy.ts` no protege rutas privadas

**Severidad:** baja · **Área:** App · rutas y proxy · **Estado:** abierto
**Detectado:** 2026-08-23 · **Evidencia:** `proxy.ts:1-10`, `lib/supabase/middleware.ts`
**Riesgo:** el matcher cubre casi todas las rutas (excluye solo estáticos), pero `updateSession` únicamente refresca la cookie de sesión y redirige a `/` si hay sesión y la ruta es `/iniciar-sesion`. No existe ninguna ruta hoy que requiera sesión para renderizar (el gating de guardado de score es en el modal, spec 15), así que no hay una ruta privada sin proteger todavía — se registra como hardening a futuro, no como hallazgo explotable hoy.
**Remediación propuesta:** si en el futuro se agrega una ruta que deba requerir sesión (p. ej. perfil de usuario, spec 15 la deja fuera de alcance), añadir la guarda en `updateSession` en ese momento.
**Acción:** ninguna ahora — reevaluar cuando exista una ruta que realmente necesite sesión.

### SEC-004 — `scores` acepta `name` y `score` arbitrarios de cualquier usuario autenticado

**Severidad:** media · **Área:** DB · RLS y policies / App · validación de input · **Estado:** abierto
**Detectado:** 2026-08-24 · **Evidencia:** `pg_policies` → `authenticated users can insert their own score`, `with_check: (auth.uid() = user_id)`; `information_schema.columns` para `scores` (`name text NOT NULL` sin longitud máxima, `score integer NOT NULL`, sin `CHECK`); `components/auth-provider.tsx:90-99` (`saveScore` envía `name` y `score` tal cual llegan del cliente).
**Riesgo:** la policy solo ancla `user_id`. Un usuario con cuenta confirmada puede hacer `POST /rest/v1/scores` directo con la key publicable y su cookie de sesión, insertando `score` arbitrario (hasta `int` máximo) y `name` arbitrario — incluyendo el `display_name` de otro jugador, ya que `name` no está atado a `auth.users.raw_user_meta_data.display_name`. Resultado: leaderboard y `/salon-de-la-fama` falsificables e impersonación de nombre. Sin límite de longitud, `name` también permite filas con texto enorme que rompen el render del leaderboard. No hay límite de inserts por usuario/juego.
**Remediación propuesta:** derivar `name` del `display_name` del JWT en la base (columna generada, trigger `before insert`, o `with_check` que compare contra `auth.jwt()`), y añadir `CHECK` de rango en `score` y de longitud en `name`. Opcionalmente encapsular el guardado en una función `SECURITY DEFINER` con `EXECUTE` acotado en vez de un INSERT directo desde el cliente.
**Acción:** `/spec endurecer el guardado de puntajes: atar scores.name al display_name del JWT, CHECK de longitud en name y de rango en score, y límite de inserts por usuario y juego`.

### SEC-005 — Política de contraseña solo aplicada en el cliente

**Severidad:** media · **Área:** Auth · configuración Supabase · **Estado:** abierto
**Detectado:** 2026-08-24 · **Evidencia:** `app/iniciar-sesion/page.tsx:5-6` (`PASSWORD_PATTERN`, 8+ con mayúscula/minúscula/dígito/símbolo) evaluado en `submit()` antes de llamar a `signUp`; `app/restablecer-password/page.tsx` solo exige `password.length < 6`; el paso manual "longitud mínima 8" sigue sin marcar en este ledger.
**Riesgo:** la regla de spec 16 es puramente de UI. Un `supabase.auth.signUp` directo contra la API (o el propio flujo de reset de contraseña dentro de la app) crea/actualiza cuentas con contraseñas de 6 caracteres sin complejidad. Combinado con SEC-001 (Leaked Password Protection apagado), las cuentas quedan expuestas a fuerza bruta y credential stuffing.
**Remediación propuesta:** subir la longitud mínima y los requisitos de caracteres en el dashboard de Supabase (Authentication → Policies), que es la única capa que aplica a todos los caminos, y alinear `restablecer-password` con la misma regex del registro.
**Acción:** paso manual de dashboard (ver abajo) + `/spec alinear la validación de contraseña de app/restablecer-password con la regex de registro de spec 16`.

### SEC-006 — `anon`/`authenticated` con grants de INSERT/UPDATE/DELETE sobre `games` y `scores`

**Severidad:** baja · **Área:** DB · funciones y grants · **Estado:** abierto
**Detectado:** 2026-08-24 · **Evidencia:** `information_schema.role_table_grants` → ambos roles tienen `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, SELECT` en `games` y `scores`.
**Riesgo:** no explotable hoy — RLS está habilitado en ambas tablas y no existe ninguna policy de `UPDATE`/`DELETE`, así que esas operaciones se rechazan. Es la ausencia de defensa en profundidad: si una policy futura se escribe de más (o RLS se deshabilita por error en una migración), los grants ya están concedidos y el impacto es inmediato. Son los grants por defecto de Supabase, no una concesión explícita del proyecto.
**Remediación propuesta:** revocar `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` de `anon` en ambas tablas y de `authenticated` en `games`, dejando a `authenticated` solo `SELECT, INSERT` en `scores`.
**Acción:** `/spec revocar de anon y authenticated los grants de tabla no usados en games y scores, dejando solo SELECT publico e INSERT de scores para authenticated`.

### SEC-007 — `/api/health/supabase` devuelve mensajes de error internos

**Severidad:** baja · **Área:** App · API routes · **Estado:** abierto
**Detectado:** 2026-08-24 · **Evidencia:** `app/api/health/supabase/route.ts:7-17` — devuelve `error.message` y `err.message` sin filtrar, con status 500.
**Riesgo:** endpoint público y sin autenticación que expone detalle interno (mensajes de la librería de Supabase, posibles fragmentos de configuración o de URL) útil para reconocimiento. Impacto acotado: no revela credenciales.
**Remediación propuesta:** devolver `{ ok: false }` con un mensaje genérico y registrar el detalle solo en el log del servidor.
**Acción:** `/spec dejar de exponer mensajes de error internos en app/api/health/supabase/route.ts y registrarlos solo en el log del servidor`.

## Hallazgos cerrados

### SEC-000a — Policy de INSERT en `scores` con `WITH CHECK (true)`

**Severidad:** alta (cuando estaba abierto) · **Área:** DB · RLS y policies
**Detectado:** ver `references/security/security-checklist.md` (advisor `rls_policy_always_true`) · **Evidencia:** `pg_policies` mostraba `with_check: true` para `anyone can insert a score`
**Riesgo:** cualquiera con la URL y la key pública podía insertar un score falso saltándose la UI.
**Cerrado:** 2026-08-23 (spec 16) — verificado con `select * from pg_policies where tablename='scores'`: la policy vigente es `authenticated users can insert their own score`, `cmd: INSERT`, `roles: {authenticated}`, `with_check: (auth.uid() = user_id)`. `get_advisors(security)` ya no lista `rls_policy_always_true`.

### SEC-000b — `rls_auto_enable()` ejecutable por `anon`/`authenticated`

**Severidad:** media (cuando estaba abierto) · **Área:** DB · funciones y grants
**Detectado:** ver `references/security/security-checklist.md` (advisors `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable`)
**Riesgo:** función `SECURITY DEFINER` invocable vía `/rest/v1/rpc/rls_auto_enable` sin necesidad legítima desde el cliente.
**Cerrado:** 2026-08-23 (spec 16) — verificado con `select grantee, privilege_type from information_schema.routine_privileges where routine_name='rls_auto_enable'`: solo `postgres` y `service_role` tienen `EXECUTE`; `get_advisors(security)` ya no lista ninguno de los dos hallazgos.

## Riesgo aceptado

- **Qué:** ausencia de `Content-Security-Policy`, `Strict-Transport-Security` y `Permissions-Policy` en `next.config.ts`. **Motivo:** decisión explícita de spec 16 de no ampliar el alcance de headers más allá del checklist original. **Decidido:** 2026-08-23 (spec 16, sección Decisiones).
- **Qué:** identidad de sesión gestionada íntegramente por Supabase Auth vía cookies de `@supabase/ssr`; ya no existe el `av_user` de `localStorage`. **Motivo:** verificado en esta corrida — `components/auth-provider.tsx:42-53` deriva `user` de `supabase.auth.getUser()` + `onAuthStateChange`, no de storage; `lib/supabase/middleware.ts` refresca la cookie con `getUser()` (validación contra el servidor de Auth, no `getSession()`). La identidad no es falsificable desde el cliente: el `user_id` que se inserta en `scores` lo re-deriva la base con `auth.uid()` en la policy, no se confía en el valor enviado. **Decidido:** 2026-08-24 (confirma spec 15 implementada; anula la descripción de `localStorage` que sigue en `CLAUDE.md`).
- **Qué:** `proxy.ts` no valida sesión en ninguna ruta (solo refresca cookie). **Motivo:** hoy no hay ninguna ruta que requiera sesión para renderizar — el gating real es a nivel de modal de guardado de score (spec 15) y de RLS en la base de datos (spec 16), no de ruta. **Decidido:** 2026-08-23, registrado como SEC-003 arriba.

## Pasos manuales de dashboard

- [ ] Longitud mínima de contraseña — 8 caracteres (Supabase Dashboard → Authentication → Policies). Ver SEC-005: hoy la regla de 8+complejidad solo existe en el cliente.
- [ ] Leaked Password Protection (HaveIBeenPwned) — Authentication → Policies. Ver SEC-001.
- [ ] Límite de signups por IP — Authentication → Rate Limits.

## Historial de auditorías

- 2026-08-24 — auditoría enfocada en la capa de autenticación (sweep completo de DB + app igualmente ejecutado). 4 nuevos (SEC-004 media, SEC-005 media, SEC-006 baja, SEC-007 baja), 0 cerrados. SEC-001/002/003 siguen abiertos y reproducen sin cambios (`get_advisors` solo lista `auth_leaked_password_protection`). Confirmado que spec 15 está realmente implementada: no queda rastro del auth de `localStorage`; nuevo riesgo aceptado documentado al respecto.
- 2026-08-23 — primera auditoría (creación del agente `@security-auditor`). 3 abiertos (SEC-001 media, SEC-002 media, SEC-003 baja), 2 cerrados (RLS de `scores`, grants de `rls_auto_enable`, ambos por spec 16), 2 riesgos aceptados documentados.
