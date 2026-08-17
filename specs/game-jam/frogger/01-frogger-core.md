# SPEC — Frogger: integración core del juego

> **Estado:** Approved
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-05-20 (revisado 2026-08-17 para alinear con el contrato de motor/registry/`jugar-client.tsx` vigente)
> **Objetivo:** Integrar Frogger (canvas puro, construido desde cero) como juego jugable en Arcade Vault con ID `frogger`, siguiendo el contrato de motor plano (`lib/games/frogger/engine.ts` + `components/games/frogger-canvas.tsx` + una línea en `GAME_REGISTRY`) que ya usan `asteroides`/`tetris`/`arkanoid`/`snake`, reutilizando la ruta compartida `/juego/[id]/jugar`.

---

## Nota de revisión (2026-08-17)

La versión original de esta spec (escrita por `@game-jam` antes de que specs 06/07/08/09/11/12 fijaran el contrato definitivo) proponía un componente React independiente (`components/games/FroggerGame.tsx`), una ruta propia (`app/games/frogger/play/page.tsx`), tipos `GameRow`/`ScoreRow` inexistentes y `color: 'lime'`. Ninguno de esos puntos es compatible con el estado real del repo:

- `games.color` tiene un `CHECK` en Supabase que solo admite `cyan | magenta | yellow | green` — `'lime'` lo violaría.
- La arquitectura real es motor plano + `forwardRef` canvas + `GAME_REGISTRY`, con una única ruta `/juego/[id]/jugar` servida por `jugar-client.tsx`. No existe patrón de rutas ni componentes por-juego.
- `lib/supabase/types.ts` con `GameRow`/`ScoreRow` no existe; los tipos reales son `Game` (`lib/games.ts`) y `ScoreRow` (`lib/scores.ts`), y el guardado de score ya lo resuelve `saveScore` de `components/auth-provider.tsx`, cableado en `jugar-client.tsx`.
- Ya existe una clase CSS `.cover-rana` (temática rana, cian/verde) en `app/globals.css` — se reutiliza en vez de crear `.cover-frogger`.

Toda la **mecánica de juego** (cuadrícula, carriles, colisiones, salto, rondas, puntuación, vidas, temporizador) de la versión original se conserva sin cambios; lo que cambia es exclusivamente cómo se conecta con la plataforma.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `frogger` a la tabla `games` en Supabase (`cover: 'cover-rana'`, `color: 'green'`).
- Crear `lib/games/frogger/engine.ts` — motor plano en TS, desacoplado de React, siguiendo el mismo patrón que `lib/games/snake/engine.ts`:
  - `export type EngineStats = { score: number; lives: number; level: number; state: "playing" | "dead" | "gameover" }`.
  - `export type EngineCallbacks = { onStats: (stats: EngineStats) => void; onGameOver: (finalScore: number) => void }`.
  - `export class FroggerEngine` con constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)` y métodos públicos `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`.
  - El motor añade su propio listener `keydown` en el `constructor` (sobre `window`, igual que `SnakeEngine`) y lo remueve en `destroy()`. No expone props `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` por separado — todos esos cambios se reportan juntos vía `onStats(stats)` en cada frame del loop, y el fin de partida vía `onGameOver(finalScore)`.
- Canvas interno de 640 × 560 px (16 columnas × 14 filas de 40 × 40 px). El mapa vertical se divide en tres zonas fijas: zona segura inferior (fila 13 — base de inicio), zona de carretera (filas 12–8, 5 carriles de tráfico), zona de río (filas 7–2, 6 carriles fluviales) y zona de metas (fila 1, 5 bocas destino).
- Entidades de carretera: coches y camiones de distintas longitudes (1–3 celdas), velocidades y direcciones por carril; se mueven horizontalmente en loop continuo; colisión con la rana es letal.
- Entidades de río: troncos (longitud 2–4 celdas) y tortugas (grupos de 2–3) por carril; se mueven horizontalmente. La rana sólo sobrevive en el río si está encima de un tronco o tortugas visibles; si cae al agua, muere. Las tortugas pueden sumergirse periódicamente (fase visible → bajo el agua → visible); mientras están bajo el agua no sirven de apoyo.
- Movimiento de la rana: basado en saltos discretos de 1 celda (40 px) en 4 direcciones (↑ ↓ ← →); cada pulsación desplaza la rana exactamente una celda tras completar una animación de salto de 120 ms. La rana no puede moverse fuera de los bordes laterales.
- Condición de meta alcanzada: la rana llega a una de las 5 bocas destino de la fila superior (cada boca ocupa 2 columnas de las 16). Una boca ya ocupada no puede volver a usarse en la misma ronda. Al rellenar las 5 bocas se completa la ronda y comienza la siguiente.
- Condición de muerte: (a) colisión con vehículo, (b) caída al agua, (c) sumergirse la tortuga bajo la rana, (d) salir por los bordes izquierdo/derecho del río, (e) agotar el temporizador de ronda (15 s iniciales reducidos en niveles altos).
- Sistema de vidas: la rana arranca con 3 vidas. Cada muerte resta 1 vida. Si las vidas llegan a 0, el motor entra en `state: "gameover"` y llama `onGameOver(score)`.
- Puntuación: +10 pts por cada celda avanzada hacia arriba por primera vez en la ronda; +50 pts al ocupar una boca destino; +200 pts al completar una ronda; +bonus de tiempo = `tiempo_restante × 10` al ocupar una boca.
- Temporizador de ronda: 15 s por defecto, decrementado en rondas altas. Se dibuja en el HUD interno del canvas, no se reporta como stat aparte (no forma parte de `EngineStats`).
- HUD interno del canvas (score top-left, vidas como iconos de rana top-right, nivel top-center, barra de tiempo en la fila 0) — mismo patrón doble-HUD que `snake`/`arkanoid` (el motor dibuja su propio HUD y además reporta `onStats` para que `jugar-client.tsx` pinte el HUD React).
- `pause()` congela `update()` pero el loop sigue llamando a `draw()` mientras esté en pausa lógica (igual que el resto de motores: en pausa real se cancela el `requestAnimationFrame`, ver `SnakeEngine.pause`).
- Crear `components/games/frogger-canvas.tsx` — wrapper `forwardRef` exponiendo `GameEngineHandle` (`pause/resume/reset/forceGameOver`), calcado de `components/games/snake-canvas.tsx`.
- Registrar `frogger` en `lib/games/registry.ts` (`GAME_REGISTRY`): una entrada `{ Canvas: FroggerCanvas }`, sin `skins` ni `touchActions` en este spec (se añaden después vía `@skin-designer`/`@mobile-porter`, fuera de alcance aquí).
- El guardado de score, el HUD React, pausa/reanudar, reinicio y navegación se resuelven automáticamente al registrar el juego: **no se crea ninguna ruta ni componente de página nueva** — `app/juego/[id]/jugar` + `jugar-client.tsx` ya cubren esto para cualquier juego en `GAME_REGISTRY`.

**Fuera de alcance:**

- Sprites bitmap externos — todos los elementos se dibujan con primitivas canvas (rectángulos, arcos, formas compuestas) con colores temáticos; no se carga ninguna imagen.
- Controles táctiles o mobile (los cablea `@mobile-porter` en una pasada posterior, un juego por corrida, siguiendo la spec 12).
- Skins `neon`/`retro` (las añade `@skin-designer` en una pasada posterior).
- Animaciones de muerte elaboradas (explosiones, partículas) — se cubre en spec secundario.
- Power-ups especiales (mosca en la boca destino, cocodrilo disfrazado de tronco) — se cubre en spec secundario.
- Supabase Auth y RLS — el guardado de score reutiliza `saveScore` de `auth-provider.tsx` tal cual está, sin cambios.
- Realtime en el leaderboard.
- Componente genérico `CanvasGame` (YAGNI).

---

## Data model

### INSERT en tabla `games`

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-rana',
  'green'
);
```

`cover-rana` ya existe en `app/globals.css` (gradiente cian/verde temático de rana) — no se crea CSS nuevo para la cover. `color: 'green'` respeta el `CHECK` de la tabla (`cyan | magenta | yellow | green`).

### Tipos del motor (`lib/games/frogger/engine.ts`)

```ts
export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};
export type EngineCallbacks = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
```

No se introducen nuevas tablas ni tipos TypeScript en `lib/`. El guardado de score reutiliza `Game` (`lib/games.ts`) y `ScoreRow`/`saveScore` (`lib/scores.ts` / `auth-provider.tsx`), exactamente igual que `asteroides`/`tetris`/`arkanoid`/`snake`.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model (vía `mcp__supabase__apply_migration`).
   Verificación: la fila `frogger` aparece en el Table Editor; `/biblioteca` muestra la card con cover `cover-rana` y color `green`.

2. **Definir constantes y tipos** dentro de `lib/games/frogger/engine.ts`:

   ```ts
   const W = 640; // CANVAS_W = COLS * CELL
   const H = 560; // CANVAS_H = ROWS * CELL
   const COLS = 16;
   const ROWS = 14;
   const CELL = 40; // px
   // Zonas (índice de fila, 0 = arriba)
   const ROW_GOALS = 0;
   const ROW_RIVER_TOP = 1;
   const ROW_RIVER_BOT = 6;
   const ROW_SAFE_MID = 7;
   const ROW_ROAD_TOP = 8;
   const ROW_ROAD_BOT = 12;
   const ROW_START = 13;
   ```

   Tipos locales (no exportados):

   ```ts
   type Direction = "up" | "down" | "left" | "right";
   interface Lane {
     row: number;
     speed: number;
     dir: 1 | -1;
     entities: Entity[];
   }
   interface Entity {
     col: number;
     width: number;
     type: "car" | "truck" | "log" | "turtle";
     submerged?: boolean;
   }
   interface Frog {
     col: number;
     row: number;
     animating: boolean;
     animT: number;
     targetCol: number;
     targetRow: number;
   }
   ```

3. **Construir el mapa de carriles** — método privado `buildLanes(level: number): Lane[]`:
   - Carriles de carretera (filas 8–12): velocidades entre 1.5 y 4 px/frame (escaladas por nivel); sentidos alternos; entidades precargadas con huecos para que sean atravesables.
   - Carriles de río (filas 1–6): velocidades entre 1 y 3 px/frame; troncos de 2–4 celdas con huecos de al menos 1 celda; grupos de tortugas de 2–3 con ciclo de inmersión de 3 s visible / 1.5 s bajo el agua.
   - Cada nivel incrementa todas las velocidades en un 15 %.
     Verificación: en cada carril hay al menos 2 entidades y los huecos son transitables (comprobable con un `console.log` temporal, removido antes de dar el paso por terminado).

4. **Game loop principal** con `requestAnimationFrame` (patrón `loop = (now) => { update(now); draw(); callbacks.onStats(...); if (!paused) rafId = requestAnimationFrame(loop) }`, igual que `SnakeEngine`):
   - `update(dt)`:
     - Si está en pausa lógica, no se llama (el `rafId` se cancela en `pause()`, igual que el resto de motores).
     - Avanzar posición de cada entidad en su carril (`entity.col += lane.speed * lane.dir * dt / 16`); cuando una entidad sale del borde, se reintroduce por el lado opuesto (`col = -entity.width` o `col = COLS`).
     - Si la rana no está animando: comprobar input (`pendingDir`); si hay dirección pendiente, iniciar animación (`animating = true`, `animT = 0`, calcular `targetCol/targetRow`).
     - Si la rana está animando: avanzar `animT += dt`; si `animT >= 120`, completar salto (`col = targetCol`, `row = targetRow`, `animating = false`), resolver lógica de celda destino (detección de muerte/meta/puntuación).
     - Si la rana está en el río y no animando: aplicar el desplazamiento horizontal de la entidad sobre la que descansa (se verifica con `getSupport(frog, lanes)`).
     - Decrementar temporizador de ronda; si llega a 0, muerte por tiempo.

   - `draw()`:
     - Fondo por zonas: negro para carretera, azul oscuro para río, verde oscuro para filas seguras, verde claro para bocas destino.
     - Dibujar entidades de cada carril: coches (rectángulo rojo/amarillo/azul con ruedas circulares), camiones (rectángulo gris con cabina diferenciada), troncos (rectángulo marrón con textura de líneas), tortugas visibles (círculo verde con patrón de escamas), tortugas sumergidas (contorno semitransparente).
     - Dibujar rana: cuerpo verde brillante (elipse 28×24 px) con ojos blancos/negros (dos círculos), patas extendidas durante animación de salto.
     - Dibujar bocas destino: rectángulo de meta verde oscuro con borde dorado; si ocupada, dibujar silueta de rana dentro.
     - HUD interno: score top-left (fuente blanca 16 px), nivel top-center, iconos de rana top-right (un círculo verde por vida), barra de tiempo (rectángulo en fila 0, anchura proporcional al tiempo restante, color verde → amarillo → rojo).

5. **Detección de colisiones y soporte**:
   - `checkRoadCollision(frog, lanes)`: itera entidades de carriles de carretera; si `frog.col` está dentro del rango `[entity.col, entity.col + entity.width)` y `frog.row === lane.row`, devuelve `true`.
   - `getSupport(frog, lanes)`: itera entidades de carriles de río; devuelve la entidad cuyo rango cubre la columna de la rana en el mismo carril, o `null`. Si la entidad es una tortuga con `submerged === true`, devuelve `null` (sin soporte).
   - `checkGoal(frog, goals)`: si `frog.row === ROW_GOALS`, calcula la boca que corresponde a `frog.col`; si no está ocupada, la marca y suma puntos; si ya estaba ocupada o `frog.col` no es una boca, es muerte.

6. **Gestión de ronda completada** — método privado `completeRound()`:
   - Resetea la posición de la rana a `ROW_START`, columna central.
   - Vacía las bocas ocupadas.
   - Incrementa `level`.
   - Reconstruye los carriles con `buildLanes(level)`.
   - Resetea el temporizador.

7. **Gestión de muerte** — método privado `killFrog()`:
   - Decrementa `lives`.
   - Si `lives === 0`: entra en `state = "gameover"`, llama `callbacks.onGameOver(score)`, detiene el loop (mismo patrón `triggerGameOver`/`gameOverNotified` que `SnakeEngine`, para evitar doble notificación).
   - Si `lives > 0`: resetea la posición de la rana a `ROW_START`, columna central; resetea temporizador.

8. **Implementar `pause/resume/reset/forceGameOver/destroy`** en `FroggerEngine`, calcados 1:1 del patrón de `SnakeEngine` (cancelar/retomar `rafId`, `initState()` para `reset()`, `triggerGameOver` reentrante para `forceGameOver()`, remover el listener `keydown` en `destroy()`).

9. **Crear `components/games/frogger-canvas.tsx`** — copia del patrón de `snake-canvas.tsx`: `forwardRef<GameEngineHandle, GameCanvasProps>`, instancia `FroggerEngine` en un `useEffect` con cleanup `engine.destroy()`, expone `pause/resume/reset/forceGameOver` vía `useImperativeHandle` (sin `setSkin`, ya que este spec no añade skins). Canvas con `width={640} height={560}`, mismo estilo `position: absolute; inset: 0; width: 100%; height: 100%` que los demás.

10. **Registrar en `lib/games/registry.ts`**: añadir el import de `FroggerCanvas`/`FroggerCanvasHandle` y la entrada `frogger: { Canvas: FroggerCanvas }` en `GAME_REGISTRY`, y reexportar `FroggerCanvasHandle` junto a los demás handles.
    Verificación: `/juego/frogger/jugar` renderiza el canvas de Frogger a través de `jugar-client.tsx` sin tocar ese archivo; el HUD React refleja score, vidas y nivel en tiempo real; pausa/reanudar/reinicio/guardado de score funcionan igual que en cualquier otro juego del catálogo.

11. **Verificación final** — `npm run build` termina sin errores de TypeScript. Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `frogger` existe en la tabla `games` de Supabase con los valores del data model (`cover: 'cover-rana'`, `color: 'green'`).
- [ ] La card de Frogger aparece en `/biblioteca` con cover `cover-rana` y color `green`.
- [ ] La ruta `/juego/frogger/jugar` carga sin errores de SSR ni de TypeScript, usando la `JugarClient` compartida (no se crea ninguna página nueva).
- [ ] El canvas (640 × 560) se renderiza con las tres zonas visualmente diferenciadas (carretera, río, zonas seguras, bocas destino).
- [ ] La rana aparece centrada en la fila de inicio al cargar la partida.
- [ ] La rana salta exactamente una celda (40 px) por pulsación de tecla de dirección con animación de 120 ms.
- [ ] La rana no puede salir por los bordes laterales.
- [ ] Los coches y camiones se mueven horizontalmente en loop por sus carriles; se reintroducen por el lado opuesto al salir.
- [ ] Los troncos y tortugas se mueven horizontalmente en loop por sus carriles.
- [ ] Las tortugas alternan entre visible y sumergida con el ciclo definido.
- [ ] La rana muere al ser alcanzada por un vehículo de carretera.
- [ ] La rana muere al caer al agua (no estar sobre tronco ni tortugas visibles).
- [ ] La rana muere cuando la tortuga que la soporta se sumerge.
- [ ] La rana muere al agotar el temporizador de ronda.
- [ ] Al morir, las vidas bajan en 1 (reflejado en `onStats`) y la rana vuelve a la fila de inicio.
- [ ] Al llegar a una boca libre, la boca queda marcada y se suma el bonus de puntuación.
- [ ] Al llegar a una boca ya ocupada, la rana muere.
- [ ] Al completar las 5 bocas, la ronda termina y comienza la siguiente con `level` incrementado.
- [ ] La velocidad de entidades aumenta con cada nivel.
- [ ] El temporizador de ronda disminuye con cada nivel.
- [ ] `onStats(stats)` se dispara en cada frame reflejando score/vidas/nivel/estado actuales.
- [ ] El HUD interno del canvas (score, nivel, vidas-iconos, barra de tiempo) se dibuja correctamente.
- [ ] El HUD React de la plataforma (`jugar-client.tsx`, sin modificar) refleja en tiempo real score, vidas y nivel.
- [ ] El botón "PAUSA" de la plataforma congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al llegar a `lives = 0`, el motor entra en `state: "gameover"` y llama `onGameOver(score)`; aparece el modal de guardado de score ya existente en `jugar-client.tsx`.
- [ ] El guardado de score usa el flujo ya existente (`saveScore` de `auth-provider.tsx`) sin código nuevo de persistencia.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero llamando `reset()` del motor.
- [ ] El score guardado aparece en `/juego/frogger` y en `/salon-de-la-fama` al recargar.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Primitivas canvas sin sprites bitmap** — coches, camiones, troncos, tortugas y rana se dibujan con formas geométricas canvas y colores temáticos. Razón: no existen assets de Frogger en el repositorio; dibujar por código elimina dependencias de carga de imágenes y permite ajustar visual sin archivos externos.

- **Sí: Cuadrícula discreta de 40 px con animación de salto de 120 ms** — el movimiento de la rana es celda a celda, no continuo. Razón: mecánica canónica de Frogger; el movimiento discreto simplifica enormemente la detección de colisiones y el soporte en el río al comparar filas/columnas enteras.

- **Sí: Doble HUD** — el canvas conserva su HUD interno y React muestra los mismos valores en el HUD de la plataforma vía `onStats`. Razón: coherencia con el patrón establecido en todos los juegos de la plataforma (`snake`, `arkanoid`).

- **Sí: 3 vidas** — Frogger original arranca con 3 vidas, reportadas vía `EngineStats.lives`. Razón: fiel a la mecánica clásica; coherente con Arkanoid y Snake.

- **Sí: Tortugas con ciclo de inmersión** — alternan entre soporte y peligro con temporizador independiente por grupo. Razón: mecánica diferenciadora de Frogger respecto a un río de sólo troncos; añade gestión de riesgo sin complejidad de implementación excesiva.

- **Sí: Temporizador de ronda** — 15 s iniciales, decrementados en niveles altos. La muerte por tiempo añade urgencia. Razón: mecánica original de Frogger; impide que el jugador espere indefinidamente en la zona segura.

- **Sí: 5 bocas destino** — requieren llenarse todas para completar la ronda. Razón: mecánica original que da estructura de objetivo claro por ronda sin ser un nivel único lineal.

- **Sí: Canvas 640 × 560 px (16 × 14 celdas de 40 px)** — relación de aspecto vertical cercana a la original. Razón: el mapa de Frogger es vertical (el jugador avanza hacia arriba); un canvas más ancho que alto no representaría bien el recorrido.

- **Sí (revisado 2026-08-17): Motor plano `lib/games/frogger/engine.ts` + `forwardRef` canvas + `GAME_REGISTRY`, reutilizando `/juego/[id]/jugar`** — en vez del componente/ruta independientes de la versión original de esta spec. Razón: es el contrato obligatorio de la plataforma (CLAUDE.md: "Every game follows the same contract; do not add per-game branches to shared components"); una ruta o componente propios duplicarían HUD, pausa, guardado de score y navegación que `jugar-client.tsx` ya resuelve para todo el catálogo.

- **Sí (revisado 2026-08-17): `color: 'green'`, `cover: 'cover-rana'`** — en vez de `color: 'lime'` (inválido, viola el `CHECK` de Supabase) y `cover-frogger` (no existe). Razón: `cover-rana` ya está definida en `app/globals.css` con estética de rana; `green` es el valor permitido más afín a esa paleta.

- **No: Movimiento continuo (interpolado)** — la rana no se desliza; salta de celda en celda. Razón: la interpolación continua requeriría colisiones AABB en espacio continuo para el río y la carretera, aumentando la complejidad sin añadir diversión.

- **No: Cocodrilo disfrazado de tronco ni mosca bonus en bocas** — se cubren en el spec secundario de power-ups y eventos. Razón: son capas de dificultad y recompensa independientes de la mecánica base.

- **No: Componente genérico `CanvasGame`** — cada juego tiene su motor propio. Razón: YAGNI.

- **No: RLS en este spec** — las tablas quedan abiertas (INSERT y SELECT públicos). Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — los scores se ven al recargar. Razón: la complejidad de subscriptions no aporta valor mientras haya pocos jugadores activos.

- **No: skins ni soporte táctil en este spec** — se delegan a `@skin-designer`/`@mobile-porter` como pasadas posteriores dedicadas, siguiendo el flujo estándar del proyecto para juegos nuevos.
