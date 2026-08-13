# 06 — Tablas reales de juegos y leaderboard en Supabase

**Estado:** Approved
**Depende de:** SPEC 04
**Fecha:** 2026-08-12

**Objetivo:** Crear las tablas `games` y `scores` en Supabase (con datos reales de los 9 juegos actuales) y migrar el catálogo y el leaderboard de la app de datos mock (`GAMES`, `seededScores`, `localStorage`) a estas tablas, manteniendo el resto del flujo (login simulado, UI) sin cambios.

## Alcance

**Incluye:**

- Tabla `games` en Supabase: una fila por juego, con las mismas columnas que el tipo `Game` actual (`id` como texto/slug primary key, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`). Sembrada por migración con los 9 juegos que hoy viven en `GAMES` (`lib/data.ts`), datos idénticos (mismos ids, textos, `best`/`plays`).
- Tabla `scores` en Supabase: `id` (uuid/serial), `game_id` (texto, FK a `games.id`), `name` (texto), `score` (entero), `created_at` (timestamp, default now). Arranca vacía — no se siembra con datos de ejemplo.
- RLS habilitado en ambas tablas con policies públicas: `SELECT` público en `games` y `scores`, `INSERT` público en `scores` (sin auth real todavía, igual que hoy cualquiera guarda con cualquier nombre).
- Nuevo módulo de acceso a datos server-side (p. ej. `lib/games.ts`, `lib/scores.ts`) con funciones async que usan `lib/supabase/server.ts`: `getGames()`, `getGame(id)`, `getTopScores(gameId, limit)`, `getAllTopScores(limit)` (para el salón de la fama, todas las listas por juego en una sola carga).
- `app/page.tsx` (biblioteca) pasa a Server Component: hace `await getGames()` y renderiza un nuevo subcomponente cliente (p. ej. `components/biblioteca-client.tsx`) que recibe la lista como prop y conserva toda la interactividad actual (buscador, chips de categoría, animaciones `reveal`, tilt).
- `app/juego/[id]/page.tsx` (ya Server Component) reemplaza `seededScores` por `getGame(id)` + `getTopScores(id, 10)`; si no hay filas, muestra un estado vacío explícito en vez de tabla.
- `app/salon-de-la-fama/page.tsx` pasa a Server Component: hace `await getGames()` + `await getAllTopScores(12)` y renderiza un nuevo subcomponente cliente (p. ej. `components/salon-client.tsx`) que recibe ambos como props y conserva los tabs/podio/tabla actuales, filtrando en memoria por el tab activo. Si el juego activo no tiene filas, muestra el mismo estado vacío explícito.
- `components/auth-provider.tsx`: `saveScore` pasa de escribir en `localStorage` (`av_scores`) a hacer `INSERT` en la tabla `scores` vía `lib/supabase/client.ts` (cliente de browser), volviéndose async; el resto del contexto (`user`, `login`, `logout`, clave `av_user`) no cambia.
- `app/juego/[id]/jugar/page.tsx`: sigue usando `GAMES`/`getGame` para mostrar título/metadata del juego actual (se ajusta el import si cambia de origen) y sigue llamando `saveScore({ game: game.id, score, name })`, ahora persistiendo en Supabase.
- Estado vacío explícito ("Aún no hay puntuaciones — sé el primero") en el leaderboard de `/juego/[id]` y en la tabla/podio de `/salon-de-la-fama` cuando un juego no tiene filas en `scores`.

**No incluye (fuera de alcance):**

- Reemplazar el login/signup simulado ni vincular `scores` a `auth.users` — `name` sigue siendo texto libre, sin relación a sesión real (spec futuro de auth).
- Calcular `best`/`plays` dinámicamente desde `scores` (MAX/COUNT) — siguen siendo columnas fijas en `games`, cargadas por la migración inicial. Un spec futuro podría recalcularlas.
- Sembrar `scores` con puntuaciones de ejemplo — la tabla arranca vacía; el leaderboard muestra el estado vacío hasta que alguien juegue.
- Migrar `av_user`/login a Supabase Auth — sigue siendo `localStorage`, sin cambios.
- Borrado, edición o moderación de puntuaciones (panel admin, límites anti-spam, validación de `score` contra el motor del juego) — cualquiera puede insertar cualquier score, igual que hoy con `localStorage`.
- Tocar la lógica de los motores de juego (`lib/games/asteroides/engine.ts`) o el resto del catálogo — sin cambios de mecánica.
- Paginación del leaderboard más allá del top N actual (10 en detalle, 12 en salón de la fama).

## Modelo de datos

Tablas nuevas en Supabase (migración SQL):

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best integer not null default 0,
  plays text not null default '0'
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games are publicly readable" on games for select using (true);
create policy "scores are publicly readable" on scores for select using (true);
create policy "anyone can insert a score" on scores for insert with check (true);

insert into games (id, title, short, long, cat, cover, color, best, plays) values
  (...); -- una fila por cada uno de los 9 juegos actuales de GAMES en lib/data.ts
```

Tipos TypeScript (nuevo módulo, p. ej. `lib/games.ts` / `lib/scores.ts`), reemplazando el `Game` estático y `seededScores` de `lib/data.ts`:

```ts
// lib/games.ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
};
export async function getGames(): Promise<Game[]>;
export async function getGame(id: string): Promise<Game | null>;

// lib/scores.ts
export type ScoreRow = {
  id: string;
  gameId: string;
  name: string;
  score: number;
  createdAt: string;
};
export async function getTopScores(
  gameId: string,
  limit?: number,
): Promise<ScoreRow[]>;
export async function getAllTopScores(
  limit?: number,
): Promise<Record<string, ScoreRow[]>>; // gameId -> filas
```

`lib/data.ts` conserva `CATS` y `PLAYERS` solo si siguen usándose fuera del leaderboard (`PLAYERS` queda sin uso tras esta migración y se elimina); `GAMES` y `seededScores` se eliminan del archivo.

## Plan de implementación

1. **Migración SQL.** Vía `mcp__supabase__apply_migration`, crear `games` y `scores` con las columnas, constraints, RLS y policies del modelo de datos, incluyendo el `insert` de los 9 juegos actuales (mismos valores que hoy en `GAMES`).
2. **Módulo de datos server-side.** Crear `lib/games.ts` (`getGames`, `getGame`) y `lib/scores.ts` (`getTopScores`, `getAllTopScores`), usando `lib/supabase/server.ts`. Eliminar `GAMES`, `seededScores` y `PLAYERS` de `lib/data.ts`.
3. **Biblioteca.** Convertir `app/page.tsx` en Server Component (`async function`) que hace `await getGames()` y renderiza `components/biblioteca-client.tsx` (nuevo, `"use client"`) con la lista recibida por prop; mover ahí toda la lógica interactiva actual (buscador, filtro por categoría, `useReveal`, tilt).
4. **Detalle de juego.** En `app/juego/[id]/page.tsx`, reemplazar `GAMES.find` + `seededScores` por `getGame(id)` (si es `null`, `notFound()`) y `getTopScores(id, 10)`. Si `getTopScores` devuelve `[]`, renderizar el estado vacío en vez de la tabla.
5. **Salón de la fama.** Convertir `app/salon-de-la-fama/page.tsx` en Server Component que hace `await getGames()` + `await getAllTopScores(12)` y renderiza `components/salon-client.tsx` (nuevo, `"use client"`) con ambos por prop; ahí viven los tabs, el podio y la tabla, filtrando en memoria por el tab activo (`useAuth` para la fila destacada del usuario se sigue consumiendo en el subcomponente cliente). Estado vacío igual que en el paso 4 cuando el tab activo no tiene filas.
6. **Guardado de puntuación.** En `components/auth-provider.tsx`, cambiar `saveScore` para que sea `async` e inserte en `scores` (`{ game_id: entry.game, name: entry.name, score: entry.score }`) vía `lib/supabase/client.ts`, en vez de escribir en `localStorage`. Ajustar `app/juego/[id]/jugar/page.tsx` para `await saveScore(...)` y su import de `GAMES`/metadata del juego según el nuevo origen (`getGame`, si esa pantalla pasa a necesitar los datos vía prop desde un wrapper server, o se resuelve client-side con el browser client — decidir el mínimo cambio necesario para no romper el flujo de teclado/canvas del motor de asteroides).
7. **Revisión final.** En el navegador: `/` carga el grid de 9 juegos desde Supabase (buscador y filtro siguen funcionando); `/juego/asteroides` muestra el detalle y, si aún no hay scores, el estado vacío; jugar una partida y guardar la puntuación desde el modal; confirmar que aparece en `/juego/asteroides` y en `/salon-de-la-fama` (tab Asteroides) con el mismo score y nombre. Repetir para otro juego. Confirmar que un `id` inexistente en `/juego/[id]` sigue devolviendo 404. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] Las tablas `games` y `scores` existen en Supabase con las columnas, constraints y policies RLS descritas arriba.
- [ ] `games` contiene los 9 juegos actuales con los mismos ids, textos, `cat`, `color`, `cover`, `best` y `plays` que hoy en `GAMES`.
- [ ] `/` (biblioteca) muestra el grid de juegos leyendo de Supabase, con buscador y filtro por categoría funcionando igual que antes.
- [ ] `/juego/[id]` muestra el detalle leyendo `getGame`/`getTopScores`; un `id` inexistente sigue devolviendo 404.
- [ ] `/juego/[id]/jugar` → guardar puntuación en el modal inserta una fila real en `scores` (visible después en Supabase) y no en `localStorage`.
- [ ] La puntuación guardada aparece tanto en el leaderboard de `/juego/[id]` como en `/salon-de-la-fama` (mismo juego, mismo score/nombre), ordenada de mayor a menor.
- [ ] Un juego sin puntuaciones en `scores` muestra el estado vacío explícito en vez de una tabla/podio en blanco o con datos falsos, tanto en `/juego/[id]` como en `/salon-de-la-fama`.
- [ ] `lib/data.ts` ya no exporta `GAMES`, `seededScores` ni `PLAYERS`.
- [ ] El login simulado (`av_user`) y el resto de la navegación no cambian de comportamiento.
- [ ] `npm run build` completa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **`games.id` como texto/slug (no UUID nuevo).** Decisión explícita del usuario: mantiene los ids actuales (`asteroides`, `rocas`, ...) usados en rutas y en el motor de Asteroides, sin mapeo slug↔UUID adicional.
- **`scores.name` como texto libre, sin relación a `auth.users`.** Decisión explícita del usuario: no hay auth real todavía (spec 04 lo dejó fuera de alcance); se mantiene el mismo comportamiento visible de hoy.
- **`best`/`plays` siguen fijos en `games`, no se recalculan desde `scores`.** Decisión explícita del usuario: evita agregaciones/vistas adicionales en este spec; puede abordarse después.
- **Migración siembra `games` pero no `scores`.** Decisión explícita del usuario: el catálogo de juegos debe verse igual que hoy desde el primer momento; el leaderboard, en cambio, arranca real y vacío, con un estado vacío explícito en vez de datos falsos.
- **Lectura y escritura públicas vía RLS (sin Route Handler intermedio).** Decisión explícita del usuario: coherente con que hoy cualquiera guarda un score con cualquier nombre sin validación; se simplifica evitando una capa de API adicional.
- **Fetch de `games`/`scores` en Server Components padres, con subcomponentes cliente para la interactividad** (`biblioteca-client.tsx`, `salon-client.tsx`), en vez de `useEffect` + cliente de browser. Decisión explícita del usuario: evita un salto de carga visible que hoy no existe con los datos mock, y es consistente con que `/juego/[id]` ya es Server Component.
- **`lib/games.ts`/`lib/scores.ts` como módulos separados de `lib/data.ts`**, en vez de mantener todo en `lib/data.ts`. Separa claramente los datos que siguen siendo estáticos (si los hubiera) de las funciones que ahora hacen I/O async a Supabase.

## Riesgos identificados

- **`app/salon-de-la-fama/page.tsx` y `components/auth-provider.tsx` dependen hoy de `useAuth()` para la fila destacada del usuario y para `saveScore`.** Al mover el fetch de datos a un Server Component padre, hay que asegurarse de que el subcomponente cliente (`salon-client.tsx`) siga pudiendo usar `useAuth()` sin problemas de hidratación — se mitiga manteniendo `AuthProvider` como está (client context ya montado en `app/layout.tsx`) y solo moviendo el _fetch de datos_, no el estado de sesión.
- **`saveScore` pasa de síncrono a asíncrono.** Cualquier código que lo invocaba sin `await` (`app/juego/[id]/jugar/page.tsx`) debe actualizarse; si se omite, el modal podría cerrarse o mostrar "guardado" antes de que el `INSERT` termine. Mitigado exigiendo explícitamente el `await` en el paso 6 del plan.
- **`plays` es texto libre (`"12.4K"`) en vez de numérico**, heredado del modelo actual — no es agregable directamente si en el futuro se quisiera calcular desde `scores`. Aceptado porque este spec no cambia ese campo, solo lo persiste tal cual.
