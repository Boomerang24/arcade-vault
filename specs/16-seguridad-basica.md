# SPEC 16 — Checklist de seguridad básico

> **Estado:** Approved
> **Depende de:** SPEC 06, SPEC 15
> **Fecha:** 2026-08-23
> **Objetivo:** Cerrar los hallazgos de `references/security/security-checklist.md` que son accionables desde el editor — endurecer la policy de INSERT en `scores`, revocar el EXECUTE público de `rls_auto_enable()`, agregar headers de seguridad en Next.js y validar la fortaleza de la contraseña en el registro con una expresión regular antes de llamar a Supabase — y documentar como pasos manuales los tres toggles de configuración de Supabase Auth que no tienen equivalente de código.

---

## Por qué esta spec existe

`references/security/security-checklist.md` es un checklist externo (linter de seguridad de Supabase + una lista manual) que mezcla tres tipos de hallazgo: (a) una policy de RLS realmente insegura, (b) una función de plataforma con permisos de ejecución más amplios de lo necesario, y (c) toggles del dashboard de Supabase Auth que no se pueden aplicar por código. Esta spec separa lo accionable de lo que queda como checklist manual, siguiendo el mismo patrón que spec 15 usó para la configuración de OAuth.

El hallazgo central: `saveScore` en `components/auth-provider.tsx` ya solo se invoca con sesión activa (spec 15, commit 506ed96), pero la policy de RLS en `scores` sigue siendo `WITH CHECK (true)` para INSERT — cualquiera con la URL y la key pública de Supabase puede insertar un score falso saltándose la UI por completo. El gating en el cliente es cosmético sin el gating correspondiente en la base de datos.

Además, el checklist pide mínimo 8 caracteres para la contraseña; Supabase Auth ya rechaza contraseñas de menos de 6 (mensaje mapeado en `mapAuthError`), pero eso ocurre después del roundtrip a la API. Esta spec agrega una validación de fortaleza (mayúsculas, minúsculas, dígitos, símbolos, 8+ caracteres) en el cliente, solo en el formulario de registro, para no gastar una llamada a Supabase con una contraseña que sabemos que va a fallar o que es débil.

---

## Scope

**Incluye:**

- Migración de RLS sobre `scores`: reemplazar la policy `anyone can insert a score` (`WITH CHECK (true)`) por una policy que exige `auth.uid() = user_id`, de forma que solo un usuario autenticado pueda insertar una fila y únicamente con su propio `user_id`.
- Revocar `EXECUTE` de los roles `anon` y `authenticated` sobre `public.rls_auto_enable()` (función `SECURITY DEFINER` de plataforma, event trigger, no invocada desde la app).
- Headers de seguridad en `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, aplicados a todas las rutas vía `headers()`.
- Documentar en esta spec, como pasos manuales de configuración (fuera del editor, a cargo del usuario), los tres toggles del dashboard de Supabase Auth: longitud mínima de contraseña (8 caracteres), Leaked Password Protection, y límite de signups por IP.
- Re-ejecutar `mcp__supabase__get_advisors` (security) después de la migración para confirmar que el hallazgo de policy permisiva y los dos de `rls_auto_enable` ya no aparecen.
- Validación de fortaleza de contraseña por expresión regular en `app/iniciar-sesion/page.tsx`, **solo en el tab "CREAR CUENTA"**: mínimo 8 caracteres, al menos una minúscula, una mayúscula, un dígito y un símbolo. Se evalúa al hacer submit (no en vivo mientras se escribe); si no cumple, se corta el submit antes de llamar a `signUp` y se muestra un mensaje de error en el mismo bloque de error ya existente (rojo, mono) — sin llamar a Supabase con una contraseña que ya sabemos que es débil.
- El tab "INICIAR SESIÓN" **no** aplica esta regex — una cuenta ya existente puede tener una contraseña creada antes de esta regla, y el login no debe romperse por eso.
- Proteccion de rutas con Proxy Nest.js - informacion sobre proxy aqui: https://nextjs.org/docs/app/getting-started/proxy

Ejemplo: proxy.ts
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}
 
// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }
 
export const config = {
  matcher: '/about/:path*',
}
```

**Fuera de alcance (para futuras specs):**

- Aplicar los toggles del dashboard de Supabase Auth vía código — no existe tool de MCP para eso; quedan documentados como pasos manuales, no implementados por este spec.
- Feedback en vivo de fortaleza de contraseña (checklist tipo ✓ mayúscula / ✓ número mientras se escribe) — la validación es solo al submit.
- Medidor visual de fortaleza (barra de progreso, "débil/media/fuerte") — fuera de alcance, solo se valida cumple/no cumple.
- Content-Security-Policy, Strict-Transport-Security, Permissions-Policy u otros headers no listados en el checklist original — decisión explícita de no ampliar el alcance dado.
- Rate limiting o CAPTCHA propio en `app/iniciar-sesion/page.tsx` más allá del límite nativo de Supabase Auth (ya cubierto por spec 15 como fuera de alcance).
- Auditoría de RLS en `games` (política `games are publicly readable`, `USING (true)` en SELECT) — es lectura pública intencional del catálogo, no un hallazgo del checklist.
- Cualquier otro warning que aparezca en `get_advisors` que no esté en `references/security/security-checklist.md`.

---

## Modelo de datos

Esta spec no introduce estructuras nuevas. Modifica una policy de RLS existente sobre `scores` (spec 06/15) y revoca un privilegio sobre una función de plataforma. No cambia columnas ni tablas.

```sql
-- Antes (spec 06/15)
-- policy "anyone can insert a score" on scores for insert with check (true)

-- Después
create policy "authenticated users can insert their own score"
  on scores for insert
  to authenticated
  with check (auth.uid() = user_id);
```

```ts
// app/iniciar-sesion/page.tsx — solo tab "up" (registro)
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
```

Cualquier carácter que no sea letra ni dígito cuenta como símbolo (no hay lista cerrada). No se agrega ningún campo nuevo de estado — reutiliza `pass` y el bloque `error` ya existentes.

---

## Plan de implementación

1. **Migración de RLS en `scores`.** Vía `mcp__supabase__apply_migration`: `drop policy "anyone can insert a score" on scores;` seguido del `create policy` de arriba (`to authenticated`, `with check (auth.uid() = user_id)`). Verificación manual: `mcp__supabase__execute_sql` con `select * from pg_policies where tablename = 'scores'` muestra la policy nueva y no la vieja.
2. **Revocar EXECUTE de `rls_auto_enable`.** Misma migración o una siguiente: `revoke execute on function public.rls_auto_enable() from anon, authenticated;`. El sistema sigue funcional — la función es un event trigger interno, no se invoca desde el cliente.
3. **Verificar con el linter.** Ejecutar `mcp__supabase__get_advisors` (`type: security`). Confirmar que `rls_policy_always_true`, `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` ya no aparecen en la lista.
4. **Probar el gating de RLS end-to-end.** Con `mcp__supabase__execute_sql` (o un cliente anónimo si aplica), confirmar que un INSERT en `scores` sin sesión (rol `anon`) es rechazado por RLS, y que jugar una partida con sesión activa en el navegador sigue guardando el score correctamente (mismo flujo que spec 15, paso 8).
5. **Headers de seguridad.** Editar `next.config.ts`: agregar `headers: async () => [{ source: '/(.*)', headers: securityHeaders }]` con el array de 3 headers del checklist. Verificación manual: `npm run dev`, luego `curl -I http://localhost:3000/` muestra los tres headers en la respuesta.
6. **Validación de contraseña en registro.** En `app/iniciar-sesion/page.tsx`, dentro de `submit`, cuando `tab === "up"`: si `pass` no matchea `PASSWORD_PATTERN`, hacer `setError(...)` con el mensaje "La contraseña debe tener mínimo 8 caracteres, con mayúsculas, minúsculas, números y símbolos." y hacer `return` antes de llamar a `signUp`. Verificación manual: intentar crear cuenta con `abc123` (sin mayúscula ni símbolo) muestra el error sin logs de red hacia Supabase; con `Abc123!@` pasa la validación y sí llama a `signUp`.
7. **Proteccion de rutas con Proxy Next.js**
8. **Revisión final.** `npm run build` sin errores. `npm run lint` limpio. Flujo en navegador sin regresión: jugar de invitado (sin guardar, igual que spec 15), jugar con sesión y guardar puntaje (aparece en leaderboard y en `/salon-de-la-fama`), login con una cuenta existente de contraseña débil (creada antes de esta spec) sigue funcionando.

### Pasos manuales de configuración (fuera del editor, a cargo del usuario)

- **Longitud mínima de contraseña:** Supabase Dashboard → Authentication → Policies (Password) → establecer mínimo 8 caracteres.
- **Leaked Password Protection:** Supabase Dashboard → Authentication → Policies (Password) → activar la verificación contra HaveIBeenPwned.
- **Límite de signups por IP:** Supabase Dashboard → Authentication → Rate Limits → configurar un límite de signups por IP (anti-bot).

---

## Criterios de aceptación

- [ ] `select * from pg_policies where tablename = 'scores' and cmd = 'INSERT'` devuelve únicamente la policy nueva (`with_check` referenciando `auth.uid() = user_id`), no `WITH CHECK (true)`.
- [ ] Un intento de INSERT en `scores` con el rol `anon` (sin sesión) es rechazado por RLS.
- [ ] Un usuario autenticado sigue pudiendo guardar su puntaje normalmente tras jugar una partida (verificado en navegador, fila nueva en `scores` con `user_id` correcto).
- [ ] `mcp__supabase__get_advisors(type: security)` ya no lista `rls_policy_always_true` ni los dos hallazgos de `rls_auto_enable`.
- [ ] `curl -I` (o el network tab del navegador) sobre cualquier ruta muestra `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] `npm run build` y `npm run lint` completan sin errores.
- [ ] El modo invitado (jugar sin guardar) y el flujo de guardado autenticado de spec 15 siguen funcionando sin regresión visible.
- [ ] En el tab "CREAR CUENTA", enviar una contraseña que no cumple el patrón (ej. `abc123`, `password`, `12345678`) muestra el mensaje de error y **no** dispara una llamada a `signUp`.
- [ ] En el tab "CREAR CUENTA", enviar una contraseña que sí cumple el patrón (ej. `Abc123!@`) pasa la validación y procede a `signUp` normalmente.
- [ ] El tab "INICIAR SESIÓN" no aplica la regex: una cuenta existente con contraseña débil (previa a esta spec) puede seguir iniciando sesión sin bloqueo del cliente.

---

## Decisiones

- **Sí:** endurecer la policy de INSERT en `scores` a `auth.uid() = user_id` en vez de solo documentar el hallazgo. Razón: el gating en el cliente (spec 15) ya asume que solo usuarios autenticados guardan puntaje; la policy vieja dejaba ese supuesto sin aplicar en la capa que realmente importa.
- **Sí:** revocar `EXECUTE` de `rls_auto_enable()` en vez de dejarlo fuera de esta spec. Razón: es una revocación de un privilegio sin uso legítimo desde el cliente (es un event trigger), cierra dos warnings del linter sin riesgo de romper nada.
- **Sí:** documentar los tres toggles de Supabase Auth como pasos manuales en vez de omitirlos del documento. Razón: mismo patrón que OAuth en spec 15 — quedan visibles como checklist de configuración externa aunque no se puedan aplicar por código.
- **No:** agregar CSP, HSTS o Permissions-Policy. Razón: no estaban en el checklist original; decisión explícita del usuario de no ampliar el alcance de headers.
- **No:** tocar la policy de SELECT pública en `games`/`scores`. Razón: es lectura pública intencional del catálogo y leaderboard, no un hallazgo de seguridad.
- **Sí:** aplicar la regex de contraseña solo en registro, no en login. Razón: cuentas ya existentes pueden tener contraseñas creadas antes de esta regla; bloquear su login por una validación nueva las dejaría fuera del sistema.
- **Sí:** validar solo al submit, no en vivo. Razón: decisión explícita del usuario — evita el trabajo de UI de un checklist de fortaleza en tiempo real, que no fue lo pedido.
- **Sí:** cualquier carácter no alfanumérico cuenta como símbolo (sin lista cerrada). Razón: más simple de mantener que una whitelist, y cubre el caso general sin fricción para el usuario.

---

## Qué **no** está en esta spec

- Los tres toggles de configuración de Supabase Auth (longitud de password, leaked password protection, rate limit de signups) — quedan como pasos manuales, no implementados por código.
- CSP, HSTS, Permissions-Policy u otros headers fuera de los tres del checklist.
- Rate limiting o CAPTCHA propio en el formulario de registro.
- Auditoría de RLS más allá de lo listado en el checklist (`games`, policies de SELECT).

Cada uno de estos, si se necesita, va en su propia spec.
