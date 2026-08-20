# 15 — Juego: SINAPSIS (Modo Clásico)

**Estado:** Draft
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-08-20

**Objetivo:** Crear un juego original y jugable "SINAPSIS" en `/juego/sinapsis/jugar` — un tablero de nodos neuronales apagados donde el jugador conecta pares de glifos idénticos contra reloj, en su **modo clásico** — con motor de grid navegable por teclado en un solo canvas registrado vía `GAME_REGISTRY` e integrado con el leaderboard real de Supabase.

## Alcance

**Incluye:**

- Nueva entrada `sinapsis` en la tabla `games` de Supabase: `title: "SINAPSIS"`, `cat: "PUZZLE"`, `color: "magenta"`, `cover: "cover-invaders"` (clase CSS ya existente en `app/globals.css:735`, sin uso por ningún juego del catálogo — se reutiliza tal cual, **sin crear CSS nuevo**). `short`/`long` se redactan durante `/spec-impl` con el mismo tono arcade retro que el resto de `GAMES` (igual criterio que specs 05, 07, 08 y 09). `best: 0`, `plays: "0"` — juego recién estrenado, sin datos mock inflados.
- Motor de SINAPSIS escrito **desde cero** en TypeScript (`lib/games/sinapsis/engine.ts`). No hay `game.js` de origen en `references/started-games/` ni assets externos: todo se dibuja con primitivas de canvas (rectángulos redondeados, arcos, polígonos, gradientes y `shadowBlur` para el glow neón), mismo criterio de "sin assets binarios para las formas jugables" que Asteroides, Tetris y el cuerpo de Snake.
- **Tema y ficción del juego.** El tablero es una **corteza sináptica**: una rejilla de nodos neuronales apagados. Cada nodo esconde un **glifo de impulso**; al sondear un nodo, el impulso se ilumina durante un instante. Conectar dos nodos con el mismo glifo forma una **sinapsis estable** que queda encendida permanentemente. Conectar dos glifos distintos provoca una **descarga fallida** que quema una de las cinco derivaciones de energía disponibles. Completar todas las sinapsis de la corteza abre la siguiente capa.
- **Tablero.** Canvas 800×600. Franja de HUD interno en los primeros 64px (puntuación, nivel/capa, derivaciones restantes, reloj de la ronda). El resto (800×536) es el área de rejilla. La rejilla es de dimensiones variables por nivel; el tamaño de cada carta se calcula para que la rejilla completa quepa centrada en el área con un gap fijo de 16px y un margen mínimo de 24px:
  - Nivel 1 — 4 columnas × 3 filas = 12 nodos = **6 pares**.
  - Nivel 2 — 4 columnas × 4 filas = 16 nodos = **8 pares**.
  - Nivel 3 — 6 columnas × 3 filas = 18 nodos = **9 pares**.
  - Nivel 4 y superiores — 6 columnas × 4 filas = 24 nodos = **12 pares** (rejilla máxima; a partir de aquí la dificultad sube solo por reloj, ver abajo).
- **Glifos.** 12 glifos distintos dibujados con primitivas de canvas, cada uno con su color propio derivado de la paleta del tema (`--cyan`, `--magenta`, `--yellow`, `--green` y variantes): círculo, anillo, triángulo, cuadrado, rombo, cruz, aspa, hexágono, rayo, media luna, estrella de 4 puntas y barra doble. Cada nivel toma los primeros N glifos necesarios (N = número de pares), duplica cada uno y baraja el conjunto con Fisher-Yates antes de repartirlo en la rejilla. Los glifos deben distinguirse por **forma**, no solo por color (requisito de legibilidad: el color por sí solo no puede ser la única señal).
- **Estados de un nodo.** `hidden` (dorso apagado con patrón de circuito), `revealed` (glifo visible, seleccionado en esta jugada), `matched` (sinapsis estable, glifo visible permanentemente con glow). Un nodo `matched` nunca vuelve a `hidden`.
- **Ciclo de jugada.** El jugador mueve un **cursor de sonda** por la rejilla y sondea un nodo. Con un solo nodo `revealed`, el juego sigue aceptando input normalmente. Al sondear el segundo nodo:
  - **Coinciden** → ambos pasan a `matched` tras una ventana de confirmación de 250ms, suma de puntos, y el contador de sinapsis pendientes baja en 1.
  - **No coinciden** → ambos permanecen `revealed` durante una ventana de castigo de 700ms y luego vuelven a `hidden`; se consume una derivación (`lives -= 1`) y el motor entra en `state: "dead"` durante esa ventana (flash rojo del marco del tablero), volviendo a `"playing"` al terminar.
  - Durante ambas ventanas el input de sondeo se **ignora** (el cursor sí puede seguir moviéndose, para no cortar el ritmo).
- **Reloj de ronda.** Cada nivel arranca con un presupuesto de tiempo: `max(30, 65 - 5 * level)` segundos (nivel 1 = 60s, nivel 2 = 55s, … nivel 7+ = 30s). El reloj corre solo en `state: "playing"` y en `"dead"`; se congela con `pause()`. Si llega a 0, la partida termina (`gameover`) sin importar cuántas derivaciones queden.
- **Puntuación.**
  - +100 por sinapsis estable (par acertado).
  - **Bonus de cadena**: +50 adicionales por cada acierto consecutivo sin fallo intermedio, acumulativo y con tope en +250 (acierto 1 = 100, 2 = 150, 3 = 200, 4 = 250, 5+ = 350 por acierto). Un fallo reinicia la cadena a 0.
  - **Bonus de capa** al completar un nivel: `segundos restantes × 10 × level`, redondeado a entero.
  - Un fallo no resta puntos (ya cuesta una derivación); la penalización es de recurso, no de marcador.
- **Progresión.** Al resolver todas las sinapsis de la corteza, `level` sube en 1, se genera una rejilla nueva (dimensiones de la tabla de arriba, glifos rebarajados), el reloj se recarga con el presupuesto del nuevo nivel y las **derivaciones no se recargan** — se arrastran de un nivel a otro durante toda la partida.
- **Fin de partida.** `gameover` cuando las derivaciones llegan a 0 tras un fallo, o cuando el reloj de la ronda llega a 0. No hay victoria final: la partida es infinita mientras se sobreviva, y el marcador es la puntuación acumulada.
- **Controles.** Solo teclado, capturado a nivel `window` con `preventDefault`, mismo patrón que `AsteroidesEngine`/`ArkanoidEngine`/`SnakeEngine`:
  - `←` `→` `↑` `↓` — mover el cursor de sonda una celda. El cursor **no** hace wrap-around: en el borde, la tecla no tiene efecto (evita saltos desorientadores en una rejilla que se lee posicionalmente).
  - `Space` — sondear el nodo bajo el cursor.
  - Sondear un nodo ya `matched` o ya `revealed` en esta misma jugada es un no-op silencioso (no consume derivación, no cuenta como jugada).
- Motor de un solo canvas (caso estándar del contrato): constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`, métodos `pause/resume/reset/forceGameOver/destroy`.
- Integración vía el registry ya existente (`lib/games/registry.ts` desde spec 07): se agrega `sinapsis: { Canvas: SinapsisCanvas }` a `GAME_REGISTRY`. **`components/jugar-client.tsx` no se toca** — el guard `registered = getRegisteredGame(game.id)` ya cubre cualquier id presente en el registry.
- HUD dibujado dentro del canvas (`drawHUD()`), con puntuación, capa, derivaciones y reloj, además del `player-hud` HTML externo que ya alimenta `onStats`.

**No incluye (fuera de alcance):**

- El **MODO SOBRECARGA** y todas sus mecánicas (barajado en caliente, glifos virus, power-up de escaneo, selector de modo) — eso es la SPEC 16, que se apoya sobre este motor.
- Audio (Web Audio o cualquier otro) — se añade en la SPEC 16.
- Skins (`SKIN_PALETTES`, `setSkin`) — un juego nuevo nace sin skins; eso es tarea posterior de `@skin-designer`.
- Controles táctiles / `touchActions` en el registry — tarea posterior de `@mobile-porter`.
- Mouse: la rejilla **no** es clicable. Solo teclado, igual que el resto del catálogo.
- Sprites, spritesheets o cualquier asset binario en `public/games/sinapsis/`.
- Cambios a `EngineStats`, `EngineCallbacks`, `GameCanvasProps` o `GameEngineHandle`, ni ramas específicas de este juego en `jugar-client.tsx`.
- Cambios a `asteroides`, `tetris`, `arkanoid`, `snake` o `frogger` más allá de la línea nueva en `GAME_REGISTRY`.
- Clases CSS `cover-*` nuevas: se reutiliza `cover-invaders`, ya existente.

## Modelo de datos

Se agrega una fila a la tabla `games` de Supabase (esquema sin cambios desde spec 06: `id, title, short, long, cat, cover, color, best, plays`); no se introduce ningún tipo nuevo en `lib/games.ts`.

| campo   | valor                                                                                  |
| ------- | -------------------------------------------------------------------------------------- |
| `id`    | `sinapsis`                                                                             |
| `title` | `SINAPSIS`                                                                             |
| `short` | redactado en `/spec-impl` (una línea, tono arcade retro, en el estilo de las actuales) |
| `long`  | redactado en `/spec-impl`                                                              |
| `cat`   | `PUZZLE`                                                                               |
| `cover` | `cover-invaders`                                                                       |
| `color` | `magenta`                                                                              |
| `best`  | `0`                                                                                    |
| `plays` | `"0"`                                                                                  |

Se introduce un módulo de motor de juego, ajeno a React, con el **caso estándar** del contrato (un solo canvas, loop por frame que internamente gobierna temporizadores acumulados por delta-time — igual forma externa que `AsteroidesEngine`/`ArkanoidEngine`/`SnakeEngine`):

```ts
// lib/games/sinapsis/engine.ts
export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};

export type EngineCallbacks = {
  onStats: (stats: EngineStats) => void; // se invoca en cada frame
  onGameOver: (finalScore: number) => void; // se invoca una sola vez al entrar en "gameover"
};

export class SinapsisEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, 5 derivaciones, nivel 1, rejilla 4x3 rebarajada
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

Estado interno del motor (no expuesto, referencia para la implementación):

```ts
type NodeState = "hidden" | "revealed" | "matched";
type Node = { glyph: number; state: NodeState; col: number; row: number };
// tablero: Node[] de cols*rows, indexado row-major
// cursor: { col: number; row: number }
// firstPick: number | null  — índice del primer nodo sondeado de la jugada
// resolveTimer: number      — ms restantes de la ventana de confirmación/castigo (0 = sin ventana activa)
// resolveKind: "match" | "miss" | null
// chain: number             — aciertos consecutivos sin fallo
// roundMs: number           — milisegundos restantes del reloj de la ronda
```

```tsx
// components/games/sinapsis-canvas.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { SinapsisEngine, type EngineStats } from "@/lib/games/sinapsis/engine";

export type SinapsisCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export const SinapsisCanvas = forwardRef<SinapsisCanvasHandle, Props>(
  function SinapsisCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SinapsisEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new SinapsisEngine(canvasRef.current, {
        onStats: (s) => onStatsRef.current(s),
        onGameOver: (s) => onGameOverRef.current(s),
      });
      engineRef.current = engine;
      return () => engine.destroy();
    }, []);

    useImperativeHandle(ref, () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
    }));

    return <canvas ref={canvasRef} width={800} height={600} />;
  },
);
```

**Mapeo de `EngineStats`:**

- `score`: puntuación acumulada (pares + bonus de cadena + bonus de capa), sin desviación respecto a lo que se guarda en `scores`.
- `lives`: **derivaciones de energía restantes**, empieza en 5 y baja 1 por cada jugada fallida. Es un uso semántico real de `lives` (recurso finito que al agotarse termina la partida), no un mapeo forzado a 1/0 como en Tetris o Snake. **No se recargan** al subir de nivel: son el presupuesto de error de toda la partida.
- `level`: capa de corteza actual, empieza en 1 y sube 1 al resolver todas las sinapsis de la rejilla. Controla el tamaño de la rejilla (hasta el tope de 6×4) y el presupuesto de reloj de la ronda.
- `state`: `"playing"` durante la jugada normal; `"dead"` **solo durante la ventana de castigo de 700ms** posterior a una jugada fallida (feedback visual de descarga, sin respawn ni pérdida de progreso del tablero); `"gameover"` al agotarse las derivaciones o el reloj de la ronda. La ventana de confirmación de 250ms de un acierto **no** cambia `state` (sigue en `"playing"`).

Se agrega `sinapsis: { Canvas: SinapsisCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, con su import y el reexport del tipo `SinapsisCanvasHandle` (mismo patrón que `FroggerCanvasHandle`). No se modifica la forma de `RegisteredGame`, `GameEngineHandle` ni `GameCanvasProps`.

## Plan de implementación

1. **Esqueleto del motor y layout de rejilla.** Crear `lib/games/sinapsis/engine.ts` con la clase `SinapsisEngine`, el loop de `requestAnimationFrame` con delta-time acumulado, y el cálculo de layout: dado `(cols, rows)`, derivar el tamaño de carta que hace caber la rejilla centrada en el área 800×536 (bajo la franja de HUD de 64px) con gap de 16px y margen mínimo de 24px, y precalcular el rectángulo de cada celda. Dibujar por ahora solo los dorsos y el cursor. Verificación: montando el motor en el navegador se ve la rejilla 4×3 centrada, sin desbordes, y el cursor se mueve con las flechas sin salirse de los límites.
2. **Barajado y glifos.** Implementar la tabla de 12 glifos como funciones de dibujo puras `(ctx, cx, cy, size, color) => void` (círculo, anillo, triángulo, cuadrado, rombo, cruz, aspa, hexágono, rayo, media luna, estrella de 4 puntas, barra doble) y el generador de tablero: tomar los primeros N glifos, duplicarlos, barajar con Fisher-Yates y repartirlos row-major. Verificación: forzando temporalmente todos los nodos a `revealed`, cada glifo aparece exactamente dos veces por tablero y las 12 formas son visualmente distinguibles entre sí en blanco y negro (prueba de legibilidad sin depender del color).
3. **Ciclo de sondeo con ventanas por delta-time.** Implementar `firstPick`, la resolución de pareja, y las ventanas de confirmación (250ms, acierto) y castigo (700ms, fallo) mediante un contador `resolveTimer` decrementado por el delta del loop — **nunca con `setTimeout`**, para que `pause()` las congele correctamente. Durante una ventana activa el sondeo se ignora y el movimiento del cursor no. Aplicar `lives -= 1` y `state = "dead"` en la ventana de castigo, volviendo a `"playing"` al cerrarse. Verificación: sondear dos glifos iguales los deja encendidos permanentemente; sondear dos distintos los oculta tras la ventana y baja una derivación; pulsar PAUSA en mitad de una ventana la congela y REANUDAR la retoma donde estaba.
4. **Puntuación, cadena y reloj de ronda.** Sumar +100 por par con bonus de cadena acumulativo (+50 por acierto consecutivo, tope +250 extra) reiniciado por cada fallo. Implementar el reloj de la ronda (`max(30, 65 - 5 * level)` segundos) decrementado por delta-time solo en `"playing"`/`"dead"`, y el `gameover` por reloj a 0. Verificación: una racha de 5 aciertos suma 100+150+200+250+350; un fallo intermedio devuelve el siguiente acierto a 100; dejar correr el reloj sin jugar termina la partida.
5. **Progresión de capa.** Al llegar a 0 sinapsis pendientes: subir `level`, regenerar la rejilla con las dimensiones del nuevo nivel, rebarajar glifos, recargar el reloj y sumar el bonus de capa (`segundos restantes × 10 × level`). Las derivaciones no se tocan. Verificación: completar el nivel 1 lleva a una rejilla 4×4 con reloj de 55s, la puntuación salta por el bonus, y las derivaciones consumidas siguen consumidas.
6. **Render final y HUD interno.** Dibujar el dorso de nodo (rectángulo redondeado con patrón de circuito), el estado `revealed` (glifo a color con `shadowBlur`), el estado `matched` (glifo con glow permanente y marco encendido), el cursor de sonda (marco parpadeante sobre la celda activa), el flash rojo del marco del tablero durante `"dead"`, y `drawHUD()` en la franja superior con puntuación, capa, derivaciones (5 iconos que se apagan) y reloj. Agrupar `save()`/`shadowBlur`/`restore()` por lote de nodos en vez de por nodo, y cachear el fondo estático de la rejilla (marco + dorsos vacíos) en un canvas offscreen que se regenera solo al cambiar de nivel — patrón ya generalizado por la spec 14. Verificación: 60fps estables con la rejilla máxima 6×4 y el HUD legible sobre el fondo neón.
7. **Canvas wrapper.** Crear `components/games/sinapsis-canvas.tsx` con la forma `forwardRef` exacta de la sección Modelo de datos. Verificación: el componente monta y desmonta sin errores de consola, y `destroy()` cancela el `requestAnimationFrame` y remueve el listener de teclado al desmontar (comprobable navegando fuera de `/jugar` y verificando que las flechas ya no capturan el scroll).
8. **Registry.** Agregar `sinapsis: { Canvas: SinapsisCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, con su import y el reexport de `SinapsisCanvasHandle`. No-op sobre `jugar-client.tsx`. Verificación: `getRegisteredGame("sinapsis")` devuelve el `Canvas` correcto y los otros cinco juegos siguen resolviendo.
9. **Fila `games`.** Insertar la fila `sinapsis` en Supabase vía `mcp__supabase__apply_migration` (migración `add_game_sinapsis`) con los valores de la tabla de Modelo de datos, redactando `short`/`long` en este paso. Verificación: `select * from games where id = 'sinapsis'` devuelve la fila y la tarjeta aparece en `/` y `/biblioteca` con la portada `cover-invaders`.
10. **Verificación en navegador.** Recorrer `/` → tarjeta "SINAPSIS" → `/juego/sinapsis` (detalle) → "Jugar ahora" → `/juego/sinapsis/jugar`. Verificar: el cursor se mueve con las flechas sin wrap-around, `Space` sondea, los pares correctos quedan encendidos y los incorrectos se ocultan quemando una derivación, la puntuación y la cadena suben como se especifica, el reloj corre y termina la partida al agotarse, completar una capa sube de nivel y agranda la rejilla, el HUD interno del canvas y el `player-hud` externo muestran siempre los mismos valores, PAUSA congela reloj y ventanas de resolución, FIN y el fin de partida muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN llama `saveScore({ game: "sinapsis", score, name })` y la entrada aparece en `/juego/sinapsis` y `/salon-de-la-fama`, JUGAR DE NUEVO reinicia el motor a nivel 1 con 5 derivaciones, y SALIR detiene el loop sin errores de consola. Confirmar que Asteroides, Tetris, Arkanoid, Snake y Frogger siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `sinapsis` aparece en `/` y `/biblioteca` con portada `cover-invaders`, categoría PUZZLE y color magenta.
- [ ] `/juego/sinapsis` muestra el detalle con los textos `short`/`long` redactados en `/spec-impl`.
- [ ] `/juego/sinapsis/jugar` renderiza `SinapsisCanvas` (no el bloque decorativo `.game-arena`).
- [ ] El cursor de sonda se mueve con `←`/`→`/`↑`/`↓` y no sale de los límites de la rejilla (sin wrap-around).
- [ ] `Space` sondea el nodo bajo el cursor; sondear un nodo `matched` o el nodo ya `revealed` de la jugada actual es un no-op que no consume derivación.
- [ ] Dos glifos iguales quedan encendidos permanentemente tras ~250ms y no vuelven a ocultarse en toda la partida.
- [ ] Dos glifos distintos vuelven a ocultarse tras ~700ms, consumen exactamente una derivación y ponen `state` en `"dead"` solo durante esa ventana.
- [ ] La puntuación sigue la fórmula especificada: +100 por par, bonus de cadena acumulativo con tope de +250, reinicio de cadena tras un fallo, y bonus de capa `segundos restantes × 10 × level` al completar un nivel.
- [ ] El reloj de la ronda arranca en `max(30, 65 - 5 * level)` segundos, corre solo en juego, se congela con PAUSA, y llegar a 0 dispara `onGameOver`.
- [ ] Completar todas las sinapsis sube `level`, regenera y agranda la rejilla según la tabla (4×3 → 4×4 → 6×3 → 6×4), y **no** recarga las derivaciones.
- [ ] Agotar las 5 derivaciones dispara `onGameOver` con la puntuación acumulada.
- [ ] Los 12 glifos se distinguen entre sí por forma, no solo por color.
- [ ] El HUD interno del canvas (puntuación / capa / derivaciones / reloj) y el `player-hud` HTML externo muestran siempre valores consistentes.
- [ ] PAUSA/REANUDAR congelan y retoman realmente el reloj y las ventanas de resolución (no se resuelven "por detrás" mientras está pausado).
- [ ] Guardar la puntuación inserta en `scores` y aparece en `/juego/sinapsis` y `/salon-de-la-fama`.
- [ ] `GAME_REGISTRY` incluye `sinapsis` y los otros cinco juegos siguen funcionando sin regresión.
- [ ] `jugar-client.tsx` no contiene ninguna rama específica de `sinapsis`.
- [ ] No se añadió ninguna clase `cover-*` nueva a `app/globals.css`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Tema elegido a partir de "MEMORIA" (Concentración / voltear pares), tomado al azar de los pendientes de `@game-planner`.** El género se reinterpreta como una corteza sináptica en vez de una baraja de cartas: el catálogo es de estética neón/circuito y un mazo de naipes desentonaría con `cover-invaders`, `cover-tetro` y compañía. La mecánica es la de Concentración; la ficción es original.
- **`id: "sinapsis"` / `title: "SINAPSIS"` en vez de `memoria`.** `memoria` como id es genérico y ambiguo con conceptos técnicos del propio repo; `SINAPSIS` es una palabra sola, mayúsculas, del mismo registro que `ASTEROIDES`/`TETRIS`/`ARKANOID`/`SNAKE`/`FROGGER`.
- **`cat: "PUZZLE"`.** El catálogo actual es ARCADE×3 (arkanoid, snake, frogger), SHOOTER×1 (asteroides), PUZZLE×1 (tetris), VERSUS×0. VERSUS es el hueco total, pero un juego de memoria de un jugador no encaja ahí sin desnaturalizarlo; PUZZLE es la categoría honesta y además la segunda menos poblada. Se descartó forzar un modo a dos jugadores solo para llenar VERSUS: eso es trabajo de las propuestas DUELO/TRON, no de este tema.
- **`color: "magenta"`.** Los cuatro colores están en uso, pero green está duplicado (snake, frogger) y magenta solo aparece en arkanoid. Se elige magenta para no crear un tercer green y porque contrasta con el cyan de tetris, el otro PUZZLE del catálogo.
- **`cover: "cover-invaders"`.** De las tres clases `cover-*` libres (`cover-glot`, `cover-invaders`, `cover-duelo`), es la única que dibuja una **rejilla regular de nodos de colores en filas** — lectura visual casi literal de un tablero de memoria. `cover-glot` es inequívocamente un comecocos y `cover-duelo` es un Pong; ambas quedan reservadas para sus propuestas. No se crea CSS nuevo, regla dura del proyecto.
- **`lives` = derivaciones de energía (5), sin recarga entre niveles.** A diferencia de Tetris y Snake, que tuvieron que forzar `lives` a 1/0, aquí el campo tiene un significado real: un recurso finito que se consume por error y cuyo agotamiento termina la partida. Se decidió **no** recargarlo al subir de nivel para que exista una curva de tensión real en partidas largas; con recarga, un jugador paciente jugaría indefinidamente sin riesgo y el reloj sería la única presión.
- **`state: "dead"` usado solo como ventana de castigo de 700ms.** Es la interpretación menos forzada disponible: hay un evento discreto de "descarga fallida" con feedback visual y pérdida de recurso, que es exactamente el nicho que `"dead"` ocupa en Arkanoid (perder una bola). Se descartó dejar `"dead"` sin usar (como hace Snake) porque aquí sí existe el evento intermedio y ocultarlo empobrecería el HUD externo.
- **Reloj por ronda en vez de reloj global.** Un reloj global haría que el bonus por terminar rápido se acumulara de forma exponencial y que las capas altas fueran inalcanzables por razones aritméticas, no de habilidad. Con reloj por ronda, cada capa es un reto acotado y el presupuesto decreciente (`65 - 5·level`, piso 30s) es la única palanca de dificultad que hace falta una vez la rejilla llega al tope de 6×4.
- **Rejilla tope de 6×4 = 12 pares.** Está limitada por los 12 glifos distinguibles por forma que se pueden dibujar con primitivas sin que empiecen a confundirse entre sí a tamaño de celda pequeño. Se descartó ampliar a 8×4 reciclando glifos con colores distintos: convertiría el color en la señal principal y rompería la legibilidad.
- **Ventanas de resolución por delta-time acumulado, nunca con `setTimeout`.** `pause()` debe congelar el juego de verdad; con `setTimeout` las parejas se resolverían durante la pausa y el jugador podría abusar de PAUSA para memorizar el tablero con las cartas destapadas.
- **Cursor sin wrap-around.** En una rejilla de memoria la posición se memoriza espacialmente; que el cursor salte del borde derecho al izquierdo desorienta y hace perder la referencia mental que el juego pide construir.
- **Solo teclado, sin mouse.** El género pide mouse en su encarnación web habitual, pero todo el catálogo de Arcade Vault es de teclado y `jugar-client.tsx` no tiene ninguna infraestructura de punteo. Añadir mouse solo para este juego rompería la consistencia y abriría una rama específica en el contrato. Documentado aquí como la desviación consciente respecto al género original.
- **Sin assets binarios: los 12 glifos se dibujan con primitivas.** Mismo criterio que Asteroides y Tetris. Evita descargar o generar imágenes y hace trivial el trabajo posterior de `@skin-designer` (los colores salen de una tabla, no de un PNG).
- **Modo clásico y modo con twist se separan en dos specs.** Esta spec entrega un juego completo, jugable y guardable de punta a punta; la SPEC 16 añade el MODO SOBRECARGA encima sin tocar el contrato. Así cada spec deja el sistema funcional por sí sola y la implementación puede pararse tras la 15 si hace falta.
- **`best: 0` / `plays: "0"`.** Juego recién estrenado; no se inflan métricas con datos mock.

## Riesgos identificados

- **El reloj de ronda pausable es el punto frágil de todo el motor.** Reloj, ventana de confirmación y ventana de castigo deben salir todos del mismo delta acumulado del loop. Si alguno se implementa con `Date.now()` absoluto o con `setTimeout`, PAUSA se convierte en un exploit: el jugador pausa con dos glifos destapados, los memoriza sin coste, y además el reloj sigue (o no sigue) de forma inconsistente con el resto.
- **Un jugador puede sondear el mismo nodo dos veces seguidas** (moverse a un nodo, `Space`, y volver a pulsar `Space` sin moverse). Debe tratarse como no-op explícito y no como "pareja de un nodo consigo mismo", que daría un acierto gratuito infinito. Es el bug clásico del género y hay que cubrirlo con un caso de prueba propio en el paso 3.
- **El tamaño de carta es variable por nivel y el glifo se dibuja con primitivas escaladas.** Los glifos con detalle fino (rayo, media luna, estrella de 4 puntas) pueden volverse ilegibles cuando la rejilla pasa de 4×3 a 6×4 y la celda se encoge. Verificar la legibilidad a tamaño mínimo en el paso 2, antes de que el resto del motor dependa de esa tabla de glifos.
- **El bonus de capa depende del reloj restante y puede desbalancear el leaderboard.** `segundos restantes × 10 × level` crece rápido: en capas altas, un jugador con buena memoria puede sacar más puntos del bonus que de los pares en sí. Conviene revisar los números reales tras la primera partida completa del paso 10 y ajustar el multiplicador en el mismo commit si la curva resulta absurda.
- **`cover-invaders` está reservada informalmente por la propuesta INVADERS en `references/game-suggestions-todo.md`.** Al consumirla aquí, esa propuesta se queda sin cover libre y necesitará CSS nuevo si algún día se implementa. Es una decisión aceptada, no un descuido: dejarla sin usar mientras SINAPSIS inventa una clase nueva contradiría la regla de no crear `cover-*` nuevas.
- **El fondo cacheado en canvas offscreen debe invalidarse al cambiar de nivel**, porque la rejilla cambia de dimensiones. Un caché no invalidado dibujaría el marco de la rejilla anterior bajo las cartas nuevas — falla visual sutil que puede pasar desapercibida en una prueba corta que no llegue al nivel 2.
