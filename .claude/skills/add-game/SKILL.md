---
name: add-game
description: Genera una spec para portar o crear un juego jugable con motor real y leaderboard en Supabase, integrado en la plataforma. Usar antes de portar un juego de references/started-games/ o de diseñar uno nuevo desde cero.
disable-model-invocation: true
argument-hint: "<carpeta-de-referencia>|<descripción del juego nuevo>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(find:*), mcp__supabase__list_tables, mcp__supabase__execute_sql
---

# /add-game — Generador de spec para juegos con leaderboard

## Session context

Fecha de hoy (úsala para el header de la spec, nunca la adivines):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Juegos de referencia disponibles para portar:
!`ls references/started-games/ 2>/dev/null || echo "No hay carpeta references/started-games/"`

¿Ya existe el registry de juegos reales en jugar-client.tsx?
!`grep -n "GAME_REGISTRY\|isAsteroides" components/jugar-client.tsx 2>/dev/null || echo "No se encontró components/jugar-client.tsx"`

Motores de juego ya implementados (precedente a imitar):
!`find lib/games -name "engine.ts" 2>/dev/null || echo "No hay motores implementados todavía"`

---

Este skill genera una **spec** (`specs/NN-slug.md`, en `Draft`) para portar o crear un juego jugable con motor real (no simulación visual) y leaderboard en Supabase, integrado en `/juego/[id]/jugar`. **No escribe código.** No llama `apply_migration`. No marca la spec como `Approved`. La implementación real siempre pasa por `/spec-impl` sobre la spec que este skill produce — ese skill no se toca ni se duplica aquí.

## Filosofía

Specs 05 (`specs/05-asteroides.md`) y 06 (`specs/06-tablas-juegos-y-leaderboard.md`) ya documentan, implementadas, el patrón completo: un motor TS desacoplado de React con el contrato `EngineStats`/`EngineCallbacks`, un wrapper `forwardRef` para el canvas, una fila en la tabla `games` de Supabase, y el cableado en `components/jugar-client.tsx`. Este skill existe para que cada nuevo juego siga exactamente ese patrón sin tener que re-derivarlo, y para que `jugar-client.tsx` no acumule más ramas hardcodeadas tipo `isAsteroides` — a partir del segundo juego real, el cableado pasa por un registry (ver Fase 4).

Lee `template.md` (en el mismo directorio que este skill) para el contrato de código exacto (`EngineStats`, `EngineCallbacks`, forma del wrapper `forwardRef`, forma del registry) — no lo reescribas de memoria, cópialo de ahí.

## Flujo

Tus respuestas deben estar en el mismo idioma que el prompt inicial del usuario.

### Fase 1 — Identificar la fuente

Si `$ARGUMENTS` nombra (o hace match aproximado con) una carpeta de `references/started-games/<NN-nombre>` (ver el listado del session context), lee completos: `game.js`, `README.md`, `index.html`, `style.css`, y todo `assets/` si existe. Presta atención a discrepancias entre el README y el código real (spec 05 encontró que el README de asteroides mencionaba power-ups no implementados en `game.js`; el README de arkanoid menciona control por mouse que `game.js` no implementa) — el código es la fuente de verdad, no la documentación aspiracional.

Si `$ARGUMENTS` no nombra ninguna carpeta de referencia, o el usuario dice explícitamente "desde cero", continúa a la Fase 2 sin material de referencia — no inventes una fuente.

### Fase 2 — Preguntas (bloques de `AskUserQuestion`)

Pregunta en bloques de 3 a 5 a la vez, específicas del dominio de "portar un juego", no genéricas:

**Identidad del juego:**

- `id` (slug en minúsculas). Verifica que no colisione con una fila existente: `mcp__supabase__execute_sql` con `select id from games;`.
- `title`, `short`, `long` — tono coherente con `asteroides` (mayúsculas para title, tono arcade retro).
- `cat`: una de `ARCADE` / `PUZZLE` / `SHOOTER` / `VERSUS`.
- `color`: una de `cyan` / `magenta` / `yellow` / `green`.

**Portada:**

- Antes de preguntar, revisa `app/globals.css` con `grep -n "^\.cover-" app/globals.css` para listar las clases `cover-*` que existen pero no están en uso (el catálogo mock original tenía más juegos que covers de los que ahora se siembran en Supabase — hoy solo `cover-rocas` está en uso por `asteroides`). Recomienda reutilizar una existente por defecto, igual que hizo spec 05. Solo se crea una clase CSS nueva si el usuario la pide explícitamente y justifica por qué ninguna existente encaja.

**Stats de lanzamiento:**

- Recomienda `best: 0`, `plays: "0"` para un juego recién lanzado, sin inflar con datos mock — a diferencia de los valores heredados que tiene `asteroides` (`38700` / `"11.3K"`), que son anteriores a la migración a Supabase y no deben copiarse como plantilla.

**Encaje del motor** (solo si hay material de referencia con complejidad no trivial):

- Si el juego de referencia usa múltiples canvases (p. ej. tablero + hold + next, como Tetris), tiene su propio `localStorage` de highscores/skins/tema, usa audio, o es por turnos en vez de loop por frame — señálalo explícitamente al usuario y pregunta cómo se adapta. La política por defecto (ver Fase 3) es **no** extender el contrato `EngineStats`; solo se adapta el primer argumento del constructor del motor.

**Controles y canvas:**

- Teclas usadas y si requieren `preventDefault` a nivel `window` (igual que asteroides). Dimensiones del canvas.

**Criterio para dejar de preguntar** (igual que `/spec`): puedes responder sin asumir nada a estas cuatro preguntas:

1. ¿Qué archivos aparecen o cambian?
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo se verifica que está terminado?
4. ¿El contrato `EngineStats` necesita alguna desviación? Si la hay, ¿está escrita como decisión explícita?

Si no puedes responder alguna sin asumir, sigue preguntando.

### Fase 3 — Contrato del motor y del canvas (diseño, no preguntas)

**Regla fija, no negociable dentro de este skill:** el motor siempre expone el contrato `EngineStats`/`EngineCallbacks` tal cual está en `template.md`, incluso si el mapeo es forzado (p. ej. en un juego por turnos, "lives" puede representar intentos restantes). **Nunca** propongas extender `EngineStats` con campos nuevos ni agregar lógica condicional extra a `jugar-client.tsx` fuera del registry — eso volvería a acoplar juegos individuales al componente compartido, que es exactamente lo que este patrón evita. Si el mapeo es forzado, documéntalo como una decisión explícita en la sección "Decisiones tomadas y descartadas" de la spec, no lo escondas.

- **Caso estándar** (un solo canvas, loop por frame — como asteroides): `lib/games/<id>/engine.ts` exporta la misma forma exacta que `AsteroidesEngine` (constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`, métodos `pause/resume/reset/forceGameOver/destroy`). `components/games/<id>-canvas.tsx` es un wrapper `forwardRef` con la misma forma que `asteroides-canvas.tsx`.
- **Caso multi-canvas** (p. ej. Tetris con tablero+hold+next): el contrato externo (`pause/resume/reset/forceGameOver/destroy`, `onStats`/`onGameOver`) no cambia. Lo único que varía es el primer argumento del constructor del motor, que en vez de un único `HTMLCanvasElement` puede aceptar un objeto de refs de canvas (p. ej. `{ board, hold, next }`). El wrapper `*-canvas.tsx` es quien renderiza los canvases necesarios y se los pasa al motor.

Escribe esta decisión de forma explícita en la sección "Modelo de datos" de la spec generada, con la firma real de la clase del motor para este juego específico (copiando y adaptando el bloque de `template.md`).

### Fase 4 — Refactor del registry en `jugar-client.tsx` (solo si aún no existe)

Usa el resultado del grep del session context (`GAME_REGISTRY` vs `isAsteroides`):

- **Si ya existe `GAME_REGISTRY`**: este paso del plan de implementación es un no-op salvo agregar una línea nueva a `lib/games/registry.ts`. Dilo así de simple en la spec.
- **Si todavía existe `isAsteroides` hardcodeado y esta es la spec del segundo juego real**: el plan de implementación de la spec **debe incluir** el refactor completo como uno de sus pasos — no se pospone a una spec separada, es el disparador natural para hacerlo. Usa la forma exacta descrita en `template.md` (`lib/games/registry.ts` con `GAME_REGISTRY`/`getRegisteredGame`, y el listado mecánico de los sitios de `jugar-client.tsx` que cambian de `isAsteroides` a `registered`).

### Fase 5 — Fila en Supabase

Antes de escribir el paso de migración en la spec, corre `mcp__supabase__list_tables` (verbose) para confirmar que el esquema de `games` no cambió desde spec 06 (columnas: `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`). El plan de implementación de la spec incluye un paso que usa `mcp__supabase__apply_migration` (nombre descriptivo, p. ej. `add_game_<id>`) para insertar una fila en `games` con los valores acordados en la Fase 2. **Este skill nunca ejecuta la migración** — solo la describe como paso a ejecutar durante `/spec-impl`.

### Fase 6 — Escribir la spec

Antes de escribir nada, **lee el skill `/spec` completo** — `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` — y tómalo como referencia directa de formato: estructura de secciones, encabezados exactos, tono, y el nivel de detalle esperado en cada una. No reinventes el formato de la spec; usa el mismo que `/spec` produce, solo con el contenido específico de "portar/crear un juego" que ya definiste en las Fases 1-5. Si `template.md` de `/spec` cambia en el futuro, esta lectura asegura que las specs de `/add-game` no se desincronicen del formato estándar del repo.

Mismo mecanismo que `/spec` Fase 4:

1. Siguiente número secuencial en base al listado de `specs/` del session context.
2. Slug kebab-case derivado del `id`/objetivo del juego.
3. Fecha del session context (nunca inventada).
4. Escribe el archivo directamente en `specs/NN-slug.md`, estado `Draft`, sin pedir permiso ni confirmar el nombre.
5. Secciones, mismo orden que specs 05/06: Header (`Estado`/`Depende de`/`Fecha`/`Objetivo`) → `## Alcance` (Incluye/No incluye) → `## Modelo de datos` (contrato del motor de la Fase 3, columnas Supabase) → `## Plan de implementación` (numerado, cada paso deja el sistema funcional) → `## Criterios de aceptación` (checklist verificable) → `## Decisiones tomadas y descartadas` (incluye cualquier desviación del contrato `EngineStats` señalada en Fase 3) → `## Riesgos identificados`.
6. El plan de implementación sigue este esqueleto, ajustado a lo decidido en las Fases 3-5:
   1. Motor (`lib/games/<id>/engine.ts`).
   2. Canvas wrapper (`components/games/<id>-canvas.tsx`).
   3. Registry (`lib/games/registry.ts` + `jugar-client.tsx`) — refactor completo o una línea, según la Fase 4.
   4. Fila `games` vía `apply_migration`.
   5. Verificación en navegador (tarjeta en `/` → detalle `/juego/<id>` → "Jugar ahora" → HUD interno y externo sincronizados → pausa real → fin de partida → guardar puntuación → aparece en `/juego/<id>` y `/salon-de-la-fama`) + `npm run build` sin errores.
7. Si el header lista una dependencia (`**Depende de:** SPEC 05`), verifica que esa spec realmente exista en `specs/`.
8. Confirma al usuario: ruta del archivo creado, recordatorio de que está en `Draft`, y que el siguiente paso es `/spec-impl NN-slug` una vez aprobada. **Detente ahí.** No propongas implementar, no escribas código, no llames `apply_migration`.

## Reglas duras

- **Nunca escribas código durante este skill.** Solo el archivo `.md` de la spec al final.
- **Nunca llames `mcp__supabase__apply_migration`** — ese paso pertenece a `/spec-impl`, no a este skill.
- **Nunca marques la spec como `Approved`.**
- **Nunca extiendas el contrato `EngineStats`/`EngineCallbacks`** ni agregues ramas nuevas a `jugar-client.tsx` fuera del registry — cualquier caso que parezca necesitarlo se documenta como decisión y se resuelve reutilizando el contrato existente (ver Fase 3).
- **No asumas decisiones que el usuario no confirmó.** Si falta información, pregunta en la Fase 2.

## Argumentos

`$ARGUMENTS` puede ser el nombre de una carpeta de `references/started-games/` (p. ej. `04-arkanoid`) o una descripción de un juego nuevo sin referencia. Si viene vacío, pregunta primero si el juego parte de una referencia existente o se diseña desde cero.
