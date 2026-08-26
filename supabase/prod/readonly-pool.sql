-- 1. Rol de solo lectura con login. Sin superuser, sin createdb/createrole.
-- NOINHERIT para que no herede privilegios de roles a los que pertenezca.
do $$
begin
    if not exists (select 1 from pg_roles where
rolname = 'readonly_pool') then
    create role readonly_pool with login
password 'S#kD%2A(CPf$k%B)'
        nosuperuser nocreatedb nocreaterole
noinherit;
    end if;
end $$;

-- 2. Conexión a la base
grant connect on database postgres to
readonly_pool;

-- 3. Uso del schema public (solo public; no auth/storage/etc.)
grant usage on schema public to readonly_pool;

-- 4. SELECT en todas las tablas/vistas actuales de public
grant select on all tables in schema public to
readonly_pool;

-- 5. SELECT automático en tablas futuras de public
alter default privileges in schema public grant
select on tables to readonly_pool;


-- 6. Ver todas las filas saltando RLS (reporting de solo lectura)
alter role readonly_pool bypassrls;

-- 7. Endurecer: revocar cualquier escritura heredada del pseudo-rol PUBLIC
revoke insert, update, delete, truncate on all tables in schema public from readonly_pool;
revoke create on
schema public from
readonly_pool;