# Despliegue a producción — Arcade Vault

Runbook para llevar el proyecto Supabase de **producción** (nuevo, separado
del de desarrollo) al mismo estado funcional que desarrollo. Claude Code no
tiene ni tendrá acceso a este proyecto: `.mcp.json` sigue apuntando solo al
proyecto de desarrollo (`pqlgbrdlpiowigajpxtu`) y no se toca. Todo lo de acá
lo ejecutás vos, a mano, en el dashboard de Supabase de producción.

## 1. Esquema y datos (SQL Editor)

1. Abrí el proyecto de **producción** en supabase.com/dashboard.
2. Andá a **SQL Editor → New query**.
3. Pegá el contenido completo de [`supabase/prod/001_bootstrap_prod.sql`](../supabase/prod/001_bootstrap_prod.sql) y ejecutalo.
4. Revisá la salida de los 4 `select` finales del script:
   - `games = 5`, `scores = 0`
   - 3 policies listadas
   - trigger `enforce_score_insert_trigger` presente
   - event trigger `ensure_rls` presente y `enabled = 'O'`

El script es idempotente — podés volver a correrlo si hace falta sin
duplicar datos ni romper nada.

## 2. Auth → URL Configuration

**Authentication → URL Configuration**:

- **Site URL**: `https://<tu-dominio-de-produccion>`
- **Redirect URLs**, agregar:
  - `https://<tu-dominio-de-produccion>/auth/callback` (usada por `app/auth/callback/route.ts` para OAuth)
  - `https://<tu-dominio-de-produccion>/restablecer-password` (usada por `resetPassword` en `components/auth-provider.tsx`)

## 3. Auth → Providers → Email

**Authentication → Providers → Email**:

- Dejar **Confirm email** activado.
- Activar **Leaked Password Protection** (chequea contra HaveIBeenPwned). Este
  es el único advisor de seguridad abierto hoy en desarrollo — arrancar
  producción sin esta deuda.
- Revisar la longitud mínima de password según tu criterio.

## 4. Auth → Providers → Google y GitHub

Producción usa **apps OAuth propias, nunca las de desarrollo** (client
id/secret distintos, dominio distinto).

Para cada proveedor, el callback URI a registrar del lado del proveedor es
siempre el mismo formato (Supabase, no tu dominio):

```
https://<project-ref-de-produccion>.supabase.co/auth/v1/callback
```

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) → crear (o
   reusar) un proyecto → **APIs & Services → Credentials → Create OAuth
   client ID** (tipo _Web application_).
2. **Authorized redirect URIs**: la URL de arriba.
3. Copiar **Client ID** y **Client Secret**.
4. En Supabase (producción): **Authentication → Providers → Google** →
   activar, pegar client id/secret, guardar.

### GitHub

1. [GitHub → Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/developers).
2. **Authorization callback URL**: la URL de arriba.
3. Copiar **Client ID** y generar/copiar **Client Secret**.
4. En Supabase (producción): **Authentication → Providers → GitHub** →
   activar, pegar client id/secret, guardar.

## 5. Auth → Emails

**Authentication → Emails**:

- Traducir/ajustar las plantillas (confirmación, recuperación de password)
  a español, consistente con el resto de la UI.
- Configurar **SMTP propio** (Settings → Auth → SMTP Settings). El SMTP por
  defecto de Supabase tiene límite bajo de envíos y no es apto para
  producción real.

## 6. Database → Backups

**Database → Backups**: confirmar que el plan del proyecto de producción
tiene backups diarios (y PITR si el plan lo incluye) activados.

## 7. Advisors

Después de correr el script SQL y configurar Auth, andá a
**Advisors → Security** y **Advisors → Performance** en el proyecto de
producción y confirmá que no queden hallazgos sin revisar.

## 8. Variables de entorno de la app

Ver `.env.template` — cargar en el hosting (Vercel u otro) los 4 valores de
producción: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`. No hay `SUPABASE_SERVICE_ROLE_KEY` ni
otras variables en el código — no hace falta introducir ninguna.

## 9. Verificación end-to-end (ya con la app apuntando a producción)

1. `npm run build` local con el `.env` de producción → compila sin errores.
2. `/biblioteca` muestra los 5 juegos.
3. Registro con email nuevo → llega el correo de confirmación (valida SMTP
   y plantillas).
4. Login con Google y con GitHub → redirigen a `/auth/callback` y vuelven
   autenticados (valida las Redirect URLs).
5. Jugar y guardar un puntaje → aparece en el leaderboard del juego y en
   `/salon-de-la-fama`, con el nombre igual al `display_name` de la cuenta
   (prueba de que `enforce_score_insert` está activo).
6. Guardar dos puntajes seguidos en menos de 5 segundos → el segundo falla
   con "Guardado demasiado frecuente" (prueba del rate limit).
7. Sin sesión iniciada, intentar insertar un score directamente (por
   ejemplo desde la consola del navegador) → rechazado por RLS.
8. Re-correr los advisors de seguridad → sin hallazgos nuevos.

## 10. Acceso de solo lectura a la base (`readonly_pool`)

Rol de Postgres creado **a mano** en el proyecto de producción para reporting /
integraciones externas de solo lectura. No lo usa la app de Arcade Vault (que
solo habla con Supabase por la publishable key y RLS); es para herramientas de
BI, dashboards o servicios que necesiten SQL directo sin poder escribir.

### Cómo se creó (SQL Editor de producción)

```sql
-- Rol con login, sin superuser/createdb/createrole, NOINHERIT.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'readonly_pool') then
    create role readonly_pool with login password '<password>'
      nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

grant connect on database postgres to readonly_pool;
grant usage on schema public to readonly_pool;              -- solo public; no auth/storage/etc.
grant select on all tables in schema public to readonly_pool;
alter default privileges in schema public grant select on tables to readonly_pool;
alter role readonly_pool bypassrls;                          -- ve todas las filas (reporting)
revoke insert, update, delete, truncate on all tables in schema public from readonly_pool;
revoke create on schema public from readonly_pool;
```

Verificado el 2026-08-25 con un cliente Postgres externo (`readonly_pool`):
`bypassrls` quedó activo (`public.games` devuelve las 5 filas sin políticas),
no hay escritura sobre `public.*` ni vía el pseudo-rol `PUBLIC`, y `auth`,
`storage`, `pg_catalog.pg_authid` responden `permission denied`.

### Cadenas de conexión

`<project-ref>` de producción = `jtfxdgnutgzktrejvrjb`. La contraseña va
**percent-encoded** en la URI (los `# % @ / : ?` la rompen); conviene generar
una sin esos caracteres (`openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32`).

| Uso                                                                         | Cadena                                                                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Servicio / serverless de solo lectura** (transaction pooler, :6543, IPv4) | `postgresql://readonly_pool.jtfxdgnutgzktrejvrjb:<PW>@aws-0-us-east-2.pooler.supabase.com:6543/postgres` |
| **Conexión persistente** (session pooler, :5432, IPv4)                      | `postgresql://readonly_pool.jtfxdgnutgzktrejvrjb:<PW>@aws-0-us-east-2.pooler.supabase.com:5432/postgres` |
| **GUI / migraciones / backups** (directa, :5432)                            | `postgresql://readonly_pool:<PW>@db.jtfxdgnutgzktrejvrjb.supabase.co:5432/postgres`                      |

Notas:

- Por el pooler el usuario es `readonly_pool.<project-ref>` (Supavisor usa el
  sufijo para rutear al tenant); en la conexión directa es solo `readonly_pool`.
- El host directo `db.<ref>.supabase.co` resuelve **solo IPv6** (sin registro
  `A`). Inservible desde Vercel serverless u otros runtimes IPv4-only — ahí hay
  que usar el pooler (o contratar el add-on IPv4).
- Transaction mode (:6543) no admite prepared statements con nombre.
- Todas exigen TLS.
- La contraseña se rota con `alter role readonly_pool with password '<nueva>';`
  en el SQL Editor de producción. No se versiona en este repo ni en `.env*`.
