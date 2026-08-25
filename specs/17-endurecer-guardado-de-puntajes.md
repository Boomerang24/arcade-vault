# SPEC 17 — Endurecer el guardado de puntajes

> **Estado:** Implemented
> **Depende de:** SPEC 06, SPEC 15, SPEC 16
> **Fecha:** 2026-08-24
> **Objetivo:** Cerrar SEC-004 (`references/security/security-audit.md`) atando `scores.name` al `display_name` real del usuario autenticado mediante un trigger en la base, agregando `CHECK` de rango en `score` y de longitud en `name`, y un límite de frecuencia de inserts por usuario y juego — para que ningún `POST` directo a la API de Supabase pueda falsificar el leaderboard ni suplantar el nombre de otro jugador.

---

## Por qué esta spec existe

`@security-auditor` detectó SEC-004: la policy de RLS sobre `scores` (spec 16) solo exige `auth.uid() = user_id`, pero no valida nada más. Con una cuenta confirmada, cualquiera puede hacer `POST /rest/v1/scores` directo con la key publicable y su cookie de sesión, e insertar:

- un `score` arbitrario (hasta el máximo de `integer`), falsificando el leaderboard y `/salon-de-la-fama`;
- un `name` arbitrario, sin relación con `auth.users.raw_user_meta_data.display_name` — impersonación del nombre de otro jugador;
- un `name` de longitud sin límite, capaz de romper el render del leaderboard.

El gating del cliente (`components/jugar-client.tsx` solo muestra el flujo de guardado con sesión activa) es cosmético sin una validación equivalente en la base de datos, el mismo patrón de fondo que spec 16 ya resolvió para el caso de INSERT anónimo.

---

## Scope

**Incluye:**

- Función trigger `public.enforce_score_insert()` (`SECURITY DEFINER`, `search_path` fijo) + trigger `BEFORE INSERT ON scores FOR EACH ROW`, que:
  - Sobrescribe `NEW.name` con `auth.users.raw_user_meta_data ->> 'display_name'` del `NEW.user_id` (fallback al prefijo del email si `display_name` no existe), truncado a 30 caracteres. Ignora por completo cualquier `name` enviado por el cliente.
  - Rechaza el insert (`RAISE EXCEPTION`) si ya existe una fila de `scores` con el mismo `user_id` y `game_id` cuyo `created_at` sea de menos de 5 segundos atrás — límite de frecuencia por usuario/juego.
- `CHECK` en `scores.score`: `score >= 0 and score <= 999999999`.
- `CHECK` en `scores.name`: `char_length(name) <= 30` (defensa en profundidad; el trigger ya trunca, pero el constraint protege ante un cambio futuro que quite el trigger por error).
- Índice `scores(user_id, game_id, created_at)` para que la verificación de frecuencia del trigger no haga un scan completo de la tabla.
- `components/auth-provider.tsx`: `saveScore` deja de aceptar `name` en `ScoreEntry` — el tipo pasa a `{ game: string; score: number }`. El insert sigue enviando `name` (cualquier valor, será sobrescrito por el trigger) solo si hace falta para no romper el `NOT NULL` existente; en la práctica se omite del payload y se deja que el trigger lo complete si la columna lo permite, o se envía `user.name` como valor de partida irrelevante (ver Modelo de datos para la decisión exacta).
- `components/jugar-client.tsx`: quitar el `<input>` editable de iniciales/nombre en el modal de fin de juego (líneas ~224-231). En su lugar, mostrar texto estático "Guardando como **{user.name}**" antes del botón "GUARDAR PUNTUACIÓN". Se elimina el estado `name`/`setName` asociado a ese input (el `useState` que lo inicializa con `user.name` ya no es necesario si no se edita).
- Verificación con `mcp__supabase__get_advisors` (security) después de la migración, y prueba manual de que el trigger reescribe un `name` falsificado y rechaza un segundo insert inmediato del mismo usuario/juego.

**Fuera de alcance (para futuras specs):**

- SEC-005 (alinear `restablecer-password` con la regex de contraseña de spec 16) y SEC-001 (Leaked Password Protection) — hallazgos distintos del mismo ledger, van en su propia spec.
- SEC-006 (revocar grants no usados de `anon`/`authenticated`) y SEC-007 (`/api/health/supabase` filtrando `error.message`) — hallazgos de baja severidad, sin relación directa con el guardado de puntajes.
- Encapsular el guardado en una función `SECURITY DEFINER` invocada por RPC (`save_score(...)`) en vez de un `INSERT` directo desde el cliente — el trigger cubre el mismo riesgo con menos cambios en `auth-provider.tsx`; se descarta la alternativa de RPC (ver Decisiones).
- Validar o limitar la longitud del `display_name` en el formulario de registro (`app/iniciar-sesion/page.tsx`) — el trigger ya trunca a 30 caracteres al guardar el score, así que un `display_name` más largo nunca rompe `scores`, aunque sí seguiría mostrándose completo en otros lugares de la UI (nav, menú de cuenta). No es el problema que esta spec cierra.
- Ajustar el límite de frecuencia por partida real (p. ej. exigir que transcurra el tiempo mínimo de una partida jugable) — el límite de 5 segundos solo frena inserts automatizados en ráfaga, no valida que el score provenga de una partida real jugada en el cliente (eso requeriría validación de replay/anti-cheat, fuera de alcance).
- Tocar la policy de `SELECT` pública en `games`/`scores` — no es parte de este hallazgo.

---

## Modelo de datos

Esta spec no crea tablas nuevas. Modifica `scores` (constraints + trigger) y el tipo `ScoreEntry` del cliente.

```sql
-- Función trigger: reescribe name y aplica rate limit
create or replace function public.enforce_score_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create trigger enforce_score_insert_trigger
  before insert on scores
  for each row
  execute function public.enforce_score_insert();

-- Constraints de rango/longitud (defensa en profundidad)
alter table scores
  add constraint scores_score_range check (score >= 0 and score <= 999999999),
  add constraint scores_name_length check (char_length(name) <= 30);

-- Índice de apoyo para la verificación de frecuencia del trigger
create index scores_user_game_created_idx on scores (user_id, game_id, created_at desc);
```

```ts
// components/auth-provider.tsx
export type ScoreEntry = { game: string; score: number };

// saveScore ya no recibe name del llamador; se sigue enviando en el insert
// como placeholder (el trigger lo sobrescribe siempre), usando user.name
// para no dejar la columna NOT NULL sin valor antes del trigger.
const saveScore = async (entry: ScoreEntry) => {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    name: user?.name ?? "JUGADOR",
    score: entry.score,
    user_id: user?.id ?? null,
  });
  if (error) throw error;
};
```

`components/jugar-client.tsx`: el `useState<string>` que hoy guarda `name`/`setName` para el input editable se elimina; el modal usa `user.name` directamente en el texto estático y en la llamada a `saveScore({ game: game.id, score })`.

---

## Plan de implementación

1. **Migración SQL.** Vía `mcp__supabase__apply_migration`: crear la función `enforce_score_insert()`, el trigger, los dos `CHECK` y el índice, en ese orden (arriba). El sistema sigue funcional: la columna `name` sigue existiendo, el trigger solo cambia qué valor queda guardado.
2. **Verificar el trigger con datos reales.** Con `mcp__supabase__execute_sql`, simular (o usar una cuenta de prueba real vía la app) un insert con un `name` distinto al `display_name` de la cuenta — confirmar que la fila guardada tiene el `display_name` real, no el enviado. Insertar una segunda fila para el mismo `user_id`+`game_id` inmediatamente después — confirmar que el segundo insert es rechazado con la excepción del trigger.
3. **Verificar con el linter.** `mcp__supabase__get_advisors(type: security)` no debe listar ningún warning nuevo introducido por esta migración (el trigger es `SECURITY DEFINER` con `search_path` fijo, que es el patrón recomendado para evitar el advisor de `function_search_path_mutable`).
4. **`components/auth-provider.tsx`.** Cambiar el tipo `ScoreEntry` (quitar `name`) y actualizar `saveScore` según el modelo de datos de arriba.
5. **`components/jugar-client.tsx`.** Quitar el `<input>` de iniciales y su `useState` asociado; reemplazar por el texto estático "Guardando como **{user.name}**"; actualizar la llamada a `saveScore({ game: game.id, score })` sin `name`. Verificación manual en navegador: jugar una partida con sesión activa, el modal de fin de juego ya no muestra un campo editable, muestra el nombre de la cuenta, y "GUARDAR PUNTUACIÓN" guarda correctamente.
6. **Revisión final.** `npm run build` y `npm run lint` sin errores. Flujo en navegador de punta a punta: jugar de invitado (sin cambios, sigue sin poder guardar), jugar con sesión y guardar puntaje (aparece en el leaderboard del juego y en `/salon-de-la-fama` con el `display_name` real de la cuenta), intentar guardar dos puntajes seguidos del mismo juego en menos de 5 segundos (el segundo debe fallar de forma controlada, sin romper la UI — definir manejo de error mínimo si `saveScore` lanza por el trigger, ver Riesgos).

---

## Criterios de aceptación

- [ ] `select proname, prosecdef from pg_proc where proname = 'enforce_score_insert'` muestra la función con `prosecdef = true` (SECURITY DEFINER).
- [ ] Insertar una fila de `scores` (con sesión de una cuenta real) enviando un `name` distinto al `display_name` de esa cuenta guarda el `display_name` real, no el valor enviado.
- [ ] Insertar dos filas seguidas del mismo `user_id` + `game_id` en menos de 5 segundos: la segunda es rechazada por el trigger.
- [ ] Insertar dos filas del mismo `user_id` + `game_id` con más de 5 segundos de diferencia: ambas se guardan sin error.
- [ ] Un intento de insert con `score` negativo o mayor a `999999999` es rechazado por el `CHECK`.
- [ ] `mcp__supabase__get_advisors(type: security)` no lista ningún warning nuevo (en particular, ninguno relacionado con `search_path` mutable en `enforce_score_insert`).
- [ ] El modal de fin de juego (`components/jugar-client.tsx`) ya no muestra un input editable de nombre/iniciales; muestra el `display_name` de la cuenta como texto estático.
- [ ] Jugar con sesión activa y guardar un puntaje sigue funcionando de punta a punta: aparece en el leaderboard del juego y en `/salon-de-la-fama` con el nombre real de la cuenta.
- [ ] El modo invitado (sin sesión) sigue sin poder guardar puntaje, sin cambios respecto a spec 15.
- [ ] `npm run build` y `npm run lint` completan sin errores.

---

## Decisiones

- **Sí:** trigger `BEFORE INSERT` en vez de un `CHECK`/`WITH CHECK` que compare contra `auth.jwt()`. Razón: el JWT puede estar desactualizado si el usuario cambió su `display_name` sin refrescar sesión, lo que rompería inserts legítimos con una comparación estricta; el trigger consulta `auth.users` directamente en el momento del insert, siempre con el valor vigente, y es robusto ante cualquier `POST` directo sin depender del contenido del JWT.
- **No:** encapsular el guardado en una función `SECURITY DEFINER` invocada por RPC (`save_score(...)`) en vez de un `INSERT` directo. Razón: el trigger resuelve el mismo riesgo (el cliente no controla `name`) sin cambiar la forma en que `auth-provider.tsx` llama a Supabase — menos superficie de cambio para el mismo cierre de hallazgo.
- **Sí:** truncar `name` a 30 caracteres en el trigger (no rechazar el insert si el `display_name` es más largo). Razón: un `display_name` largo es un problema de UX en otras partes de la app (nav, menú de cuenta), no una razón para bloquear el guardado del puntaje; truncar es la opción que no rompe el flujo del jugador.
- **Sí:** límite de frecuencia de 5 segundos por `user_id`+`game_id`, no un tope de filas guardadas. Razón: el objetivo es frenar spam automatizado de `POST`s en ráfaga, no limitar cuántas partidas reales puede guardar un jugador — un jugador legítimo puede jugar y guardar tantas veces como quiera, solo no más rápido de lo que toma reiniciar una partida.
- **Sí:** quitar el input editable de nombre/iniciales del modal en vez de dejarlo y solo ignorar su valor en el servidor. Razón: dejarlo editable sin efecto real es una UX engañosa — el jugador vería lo que escribió en el modal y después algo distinto en el leaderboard, sin ninguna explicación.
- **No:** validar la longitud de `display_name` en el formulario de registro. Razón: el trigger ya garantiza que `scores.name` nunca excede 30 caracteres pase lo que pase en el registro; ampliar la validación de registro es un cambio de UX separado, no necesario para cerrar SEC-004.
- **No:** incluir SEC-005/001/006/007 en esta spec. Razón: son hallazgos independientes del mismo ledger, cada uno con su propia remediación y sin dependencia técnica entre sí — agruparlos diluye el criterio de aceptación de cada uno.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Si el trigger lanza excepción por el límite de frecuencia, `saveScore` hace `throw error` sin manejo hoy en `jugar-client.tsx` — un doble clic accidental en "GUARDAR PUNTUACIÓN" podría mostrar un error sin controlar en vez de simplemente ignorar el segundo clic. | Deshabilitar el botón "GUARDAR PUNTUACIÓN" (o marcar `saved = true`) inmediatamente al primer clic, antes de que la respuesta de `saveScore` vuelva — evita que el propio botón dispare el rechazo del trigger en el flujo normal; queda como parte del paso 5 del plan. |
| Un usuario con `display_name` vacío o `null` (cuenta antigua, OAuth sin nombre) podría guardar con el fallback `'JUGADOR'` genérico si tampoco tiene `email` accesible.                                                                                                | Caso extremo: todo `auth.users` tiene `email` no nulo en este proyecto (spec 15 no soporta signup sin email), así que el fallback a `split_part(email, '@', 1)` siempre tiene un valor antes de llegar a `'JUGADOR'`.                                                    |

---

## Qué **no** está en esta spec

- SEC-005, SEC-001, SEC-006, SEC-007 del ledger de seguridad.
- Función RPC `SECURITY DEFINER` como alternativa al trigger.
- Validación de longitud de `display_name` en el registro.
- Límite de frecuencia basado en tiempo real de partida jugada (anti-cheat/replay).
- Tope de cantidad de filas guardadas por usuario/juego.

Cada uno de estos, si se necesita, va en su propia spec.
