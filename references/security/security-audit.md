# Auditoría de seguridad — Ledger

Memoria persistente de `@security-auditor`. Solo ese agente escribe aquí.
Insumo histórico de solo lectura: `references/security/security-checklist.md`.

## Estado por área

| Área                          | Estado    | Abiertos | Última auditoría |
| ----------------------------- | --------- | -------- | ---------------- |
| DB · RLS y policies           | OK        | 0        | 2026-08-23       |
| DB · funciones y grants       | OK        | 0        | 2026-08-23       |
| Auth · configuración Supabase | pendiente | 1        | 2026-08-23       |
| App · headers HTTP            | OK        | 0        | 2026-08-23       |
| App · rutas y proxy           | pendiente | 1        | 2026-08-23       |
| App · API routes              | pendiente | 1        | 2026-08-23       |
| App · secrets y env           | OK        | 0        | 2026-08-23       |
| App · validación de input     | OK        | 0        | 2026-08-23       |

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
- **Qué:** `proxy.ts` no valida sesión en ninguna ruta (solo refresca cookie). **Motivo:** hoy no hay ninguna ruta que requiera sesión para renderizar — el gating real es a nivel de modal de guardado de score (spec 15) y de RLS en la base de datos (spec 16), no de ruta. **Decidido:** 2026-08-23, registrado como SEC-003 arriba.

## Pasos manuales de dashboard

- [ ] Longitud mínima de contraseña — 8 caracteres (Supabase Dashboard → Authentication → Policies).
- [ ] Leaked Password Protection (HaveIBeenPwned) — Authentication → Policies. Ver SEC-001.
- [ ] Límite de signups por IP — Authentication → Rate Limits.

## Historial de auditorías

- 2026-08-23 — primera auditoría (creación del agente `@security-auditor`). 3 abiertos (SEC-001 media, SEC-002 media, SEC-003 baja), 2 cerrados (RLS de `scores`, grants de `rls_auto_enable`, ambos por spec 16), 2 riesgos aceptados documentados.
