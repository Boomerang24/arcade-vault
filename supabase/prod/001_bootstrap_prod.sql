-- Arcade Vault — bootstrap de PRODUCCIÓN
--
-- Reconstruye en el proyecto Supabase de producción el esquema que hoy vive
-- en el proyecto de desarrollo (tablas, RLS, policies, funciones, trigger,
-- event trigger e índice), y siembra el catálogo de juegos.
--
-- Uso: pegar este archivo completo en el SQL Editor del proyecto de
-- PRODUCCIÓN y ejecutarlo. Es idempotente: se puede volver a correr sin
-- duplicar nada ni fallar si ya se corrió antes.
--
-- Este script NO toca auth.* ni inserta filas en `scores` — producción
-- arranca con leaderboards vacíos. auth.users se puebla solo cuando la
-- gente se registra en producción.

-- =============================================================
-- 1. TABLAS
-- =============================================================

create table if not exists public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat = any (array['ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'])),
  cover text not null,
  color text not null check (color = any (array['cyan', 'magenta', 'yellow', 'green'])),
  best integer not null default 0,
  plays text not null default '0'
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id) on update no action on delete no action,
  name text not null check (char_length(name) <= 30),
  score integer not null check (score >= 0 and score <= 999999999),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on update no action on delete no action
);

-- =============================================================
-- 2. ÍNDICE
-- =============================================================

create index if not exists scores_user_game_created_idx
  on public.scores using btree (user_id, game_id, created_at desc);

-- =============================================================
-- 3. ROW LEVEL SECURITY + POLICIES
-- =============================================================

alter table public.games enable row level security;
alter table public.scores enable row level security;

drop policy if exists "games are publicly readable" on public.games;
create policy "games are publicly readable"
  on public.games
  for select
  to public
  using (true);

drop policy if exists "scores are publicly readable" on public.scores;
create policy "scores are publicly readable"
  on public.scores
  for select
  to public
  using (true);

drop policy if exists "authenticated users can insert their own score" on public.scores;
create policy "authenticated users can insert their own score"
  on public.scores
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- =============================================================
-- 4. GRANTS — mínimos necesarios (más estrictos que los defaults de
--    Supabase; RLS ya contiene el acceso, esto cierra la puerta también
--    a nivel de privilegio de tabla)
-- =============================================================

revoke all on public.games from anon, authenticated;
revoke all on public.scores from anon, authenticated;

grant select on public.games to anon, authenticated;
grant select on public.scores to anon, authenticated;
grant insert on public.scores to authenticated;

-- =============================================================
-- 5. FUNCIÓN + TRIGGER: enforce_score_insert
--    Fuerza el nombre mostrado desde auth.users (evita spoofing de
--    nombre) y aplica un rate limit de 5s por (user_id, game_id).
-- =============================================================

create or replace function public.enforce_score_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_display_name text;
  v_last_created timestamptz;
begin
  select coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
    into v_display_name
    from auth.users
    where id = new.user_id;

  new.name := left(coalesce(v_display_name, 'JUGADOR'), 30);

  select created_at into v_last_created
    from scores
    where user_id = new.user_id
      and game_id = new.game_id
    order by created_at desc
    limit 1;

  if v_last_created is not null and now() - v_last_created < interval '5 seconds' then
    raise exception 'Guardado demasiado frecuente, esperá unos segundos.';
  end if;

  return new;
end;
$function$;

revoke execute on function public.enforce_score_insert() from public, anon, authenticated;

drop trigger if exists enforce_score_insert_trigger on public.scores;
create trigger enforce_score_insert_trigger
  before insert on public.scores
  for each row
  execute function public.enforce_score_insert();

-- =============================================================
-- 6. FUNCIÓN + EVENT TRIGGER: rls_auto_enable
--    Activa RLS automáticamente en cualquier tabla nueva creada en
--    el schema public, para que no quede una tabla futura sin RLS
--    por descuido.
-- =============================================================

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog', 'information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- =============================================================
-- 7. SEED: catálogo de juegos
--    best/plays se siembran en 0 — los valores no-cero en dev son
--    ruido de pruebas, no historia real que deba viajar a producción.
-- =============================================================

insert into public.games (id, title, short, long, cat, cover, color, best, plays)
values
  (
    'arkanoid',
    'ARKANOID',
    'Pala, bola y una pared de bloques que no perdona un rebote.',
    'Desliza la pala de un lado a otro para devolver la bola contra una pared de bloques de colores. Cada bloque roto suma puntos y estalla en una pequeña explosión con su propio sonido de rotura. Tres vidas, tres niveles cada vez más densos, y una bola que gana velocidad con cada avance.',
    'ARCADE',
    'cover-bricks',
    'magenta',
    0,
    '0'
  ),
  (
    'asteroides',
    'ASTEROIDES',
    'Nave vectorial, campo de rocas, cero gravedad.',
    'Pilota una nave de líneas blancas sobre el vacío absoluto. Rota, propulsa y dispara para partir asteroides en fragmentos cada vez más pequeños mientras el campo envuelve los bordes de la pantalla. Tres vidas, sin piedad.',
    'SHOOTER',
    'cover-rocas',
    'yellow',
    0,
    '0'
  ),
  (
    'frogger',
    'FROGGER',
    'Cruza la carretera y el río sin convertirte en papilla.',
    'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
    'ARCADE',
    'cover-rana',
    'green',
    0,
    '0'
  ),
  (
    'snake',
    'SNAKE',
    'Una serpiente, una cuadrícula, y cada fruta te acerca un poco más a chocar contigo mismo.',
    'Guía la serpiente por un tablero de 40x30 celdas: cada fruta comida la hace crecer un segmento y suma puntos, mientras el espacio libre se reduce con tu propia cola. El ritmo del movimiento se acelera cada cinco frutas, y un solo golpe contra una pared o contra tu cuerpo termina la partida.',
    'ARCADE',
    'cover-snake',
    'green',
    0,
    '0'
  ),
  (
    'tetris',
    'TETRIS',
    'Piezas que caen, líneas que estallan, ritmo que no perdona.',
    'Encaja las ocho piezas clásicas contra el reloj: rota con wall kicks, guarda una en reserva y hunde el tablero con hard drops. Cada diez líneas el ritmo se acelera y aparecen piezas especiales con bombas, rayos y tintes que reescriben el tablero. Cuatro pieles visuales, un solo objetivo: no dejar que la torre llegue al techo.',
    'PUZZLE',
    'cover-tetro',
    'cyan',
    0,
    '0'
  )
on conflict (id) do update set
  title = excluded.title,
  short = excluded.short,
  long = excluded.long,
  cat = excluded.cat,
  cover = excluded.cover,
  color = excluded.color;
-- best/plays deliberadamente excluidos del do update: si producción ya
-- acumuló puntajes/plays reales, una re-corrida de este script no los pisa.

-- =============================================================
-- 8. VERIFICACIÓN — revisa la salida de estos SELECT tras ejecutar
-- =============================================================

select 'games' as tabla, count(*) as filas from public.games
union all
select 'scores', count(*) from public.scores;
-- Esperado: games = 5, scores = 0

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
-- Esperado: 3 filas (games/select/public, scores/select/public,
-- scores/insert/authenticated)

select tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal;
-- Esperado: enforce_score_insert_trigger

select evtname, evtenabled
from pg_event_trigger
where evtname = 'ensure_rls';
-- Esperado: ensure_rls, enabled = 'O'
