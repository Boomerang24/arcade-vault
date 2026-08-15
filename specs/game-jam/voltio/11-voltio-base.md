# 11 — Juego: VOLTIO

**Estado:** Draft
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-08-15

**Objetivo:** Crear un juego original y jugable "VOLTIO" en `/juego/voltio/jugar` — una chispa de energía que cruza una placa de circuito esquivando pulsos de datos y saltando sobre condensadores flotantes en un canal de refrigerante para energizar los cinco nodos de la fila superior — con motor híbrido de grid + obstáculos continuos en un solo canvas registrado vía `GAME_REGISTRY` e integrado con el leaderboard real de Supabase.

## Alcance

**Incluye:**

- Nueva entrada `voltio` en la tabla `games` de Supabase: `title: "VOLTIO"`, `cat: "ARCADE"`, `color: "cyan"`, `cover: "cover-rana"` (clase CSS ya existente en `app/globals.css`, sin uso actual — se reutiliza tal cual, sin crear CSS nuevo). `short`/`long` se redactan durante `/spec-impl`, mismo tono arcade retro que el resto de `GAMES` (igual criterio que specs 05, 07, 08 y 09). `best: 0`, `plays: "0"` — juego recién estrenado, sin datos mock inflados.
- Motor de VOLTIO escrito **desde cero** en TypeScript (`lib/games/voltio/engine.ts`). No hay `game.js` de origen ni assets externos: todo se dibuja con primitivas de canvas (rectángulos, líneas, gradientes, `shadowBlur` para el glow neón), mismo criterio que Asteroides y Tetris.
- **Tema y ficción del juego:** el jugador es una chispa (`VOLTIO`) que sube por una placa de circuito. Los "coches" del género son **pulsos de datos** que recorren buses horizontales; el "río" es un **canal de refrigerante** que apaga la chispa al contacto; los "troncos/tortugas" son **condensadores y disipadores** flotantes sobre los que hay que viajar; la "meta" son **cinco nodos** en la fila superior que hay que energizar.
- **Tablero.** Canvas 800×600, grid lógico de 20 columnas × 15 filas de 40px, mismas dimensiones que `AsteroidesCanvas`/`ArkanoidCanvas`/`SnakeCanvas`. Distribución fija de filas (índice 0 arriba):
  - Fila 0 — franja de HUD interno (puntuación, nivel, nodos energizados). No es zona jugable.
  - Fila 1 — **fila de nodos**: 5 huecos de nodo en columnas fijas (2, 6, 10, 14, 18), separados por muro de placa sólido. Aterrizar en un hueco libre lo energiza; aterrizar en el muro o en un nodo ya energizado es un movimiento inválido (se ignora, la chispa no se mueve).
  - Filas 2–6 — **canal de refrigerante** (5 carriles): agua/refrigerante mortal salvo que la chispa esté sobre una plataforma flotante.
  - Fila 7 — **bus neutro**: franja segura intermedia, sin obstáculos.
  - Filas 8–12 — **buses de datos** (5 carriles): pulsos de datos que matan al contacto.
  - Fila 13 — **zona de arranque**: franja segura donde reaparece la chispa.
  - Fila 14 — franja de HUD inferior (barra de carga y vidas restantes). No es zona jugable.
- **Movimiento híbrido grid + continuo.** La chispa salta de celda en celda (un salto discreto por pulsación, sin auto-repeat mientras la tecla se mantiene presionada), pero pulsos y plataformas se mueven en píxeles por frame. La posición horizontal de la chispa es un float: al viajar sobre una plataforma se desplaza con ella de forma continua, y cada salto la re-alinea al centro de la celda más cercana. La posición vertical siempre es una fila exacta.
- **Obstáculos.** Cada carril tiene dirección (izquierda o derecha, alternando por carril), velocidad propia en px/s y un patrón de espaciado fijo por nivel:
  - Buses de datos (filas 8–12): pulsos rectangulares de 1 a 3 celdas de ancho. Colisión con cualquier pulso = muerte.
  - Canal de refrigerante (filas 2–6): condensadores (2 celdas) y disipadores (4 celdas). Estar en una fila de refrigerante sin solaparse con ninguna plataforma = muerte. Estar sobre una plataforma que se sale por el borde del canvas arrastrando a la chispa fuera del área visible = muerte.
  - Los obstáculos hacen wrap-around por los bordes: al salir por un lado reaparecen por el otro manteniendo el espaciado del carril.
- **Barra de carga (giro propio, sustituye al temporizador clásico).** La chispa arranca cada intento con `carga = 100` y se drena de forma continua mientras `state === "playing"` (ritmo base ~7 unidades/s en nivel 1, escalado por nivel). Llegar a `carga = 0` cuesta una vida igual que una colisión. La carga se restaura al 100 al energizar un nodo y al reaparecer tras perder una vida. Se dibuja como barra horizontal en la franja de HUD inferior del canvas.
- **Vidas y respawn reales.** 3 vidas. Al morir, `state` pasa a `"dead"` durante una pausa breve (~1s) con animación de cortocircuito, y luego la chispa reaparece en la zona de arranque con la carga llena; los nodos ya energizados **se conservan**. Con 0 vidas restantes, `state` pasa a `"gameover"` y se invoca `onGameOver(score)` una sola vez.
- **Puntuación.** +10 por cada fila nueva récord alcanzada en el intento actual (marcador de fila más alta por intento, para que retroceder y volver a avanzar no farmee puntos), +50 al energizar un nodo, +2 por cada unidad de carga restante en el momento de energizarlo, y +500 al energizar el quinto nodo (placa completa).
- **Progresión de nivel.** `level` empieza en 1 y sube 1 cada vez que se energizan los cinco nodos: la placa se reinicia con los nodos vacíos, la chispa vuelve a la zona de arranque, y sube la dificultad (velocidad de todos los carriles ×1.15, drenaje de carga ×1.1, plataformas del canal un poco más separadas). Las vidas restantes **no** se reponen al subir de nivel.
- **Controles.** Solo teclado: `←`/`→`/`↑`/`↓` = un salto de una celda en esa dirección. Capturados a nivel `window` con `preventDefault`, mismo patrón que `AsteroidesEngine`/`ArkanoidEngine`/`SnakeEngine`. Saltos que llevarían fuera del área jugable (columna <0, columna >19, fila <1, fila >13) se ignoran sin penalización.
- **HUD interno en canvas.** Franja superior: puntuación, nivel y contador de nodos energizados (5 iconos que se encienden). Franja inferior: barra de carga y vidas restantes. Overlays internos de PAUSA y GAME OVER, mismo criterio que el resto de motores del catálogo.
- **Motor de un solo canvas (caso estándar):** constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`, métodos `pause/resume/reset/forceGameOver/destroy`.
- **Integración vía el registry ya existente** (`lib/games/registry.ts`, desde spec 07): se agrega `voltio: { Canvas: VoltioCanvas }` a `GAME_REGISTRY`. **`components/jugar-client.tsx` no se toca** — el guard `registered = getRegisteredGame(game.id)` ya cubre cualquier id presente en el registry.
- Integración con el leaderboard real ya existente (patrón spec 06): guardar puntuación inserta en `scores` con `game_id: "voltio"` y aparece en `/juego/voltio` y `/salon-de-la-fama` sin código nuevo.

**No incluye (fuera de alcance):**

- Power-ups, hazards especiales, plataformas que parpadean o se hunden, audio y efectos de partículas — todo eso vive en la spec 12 (mecánicas). Esta spec entrega el juego completo y jugable de punta a punta sin ellos.
- Cambios a `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` o a la forma de `RegisteredGame`.
- Ramas específicas de `voltio` en `components/jugar-client.tsx` o en cualquier componente compartido.
- CSS nuevo: `cover-rana` ya existe y se reutiliza sin modificarla.
- Assets binarios (`public/games/voltio/` no se crea): todo el arte es procedural en canvas.
- Controles WASD, táctiles/on-screen, o mouse.
- Modo de dos jugadores, tiempos por nodo tipo Frogger original, o insectos/bonus recogibles.
- Cambios a `asteroides`, `tetris`, `arkanoid` o `snake`.

## Modelo de datos

Se agrega una fila a la tabla `games` de Supabase (esquema sin cambios desde spec 06: `id, title, short, long, cat, cover, color, best, plays`); no se introduce ningún tipo nuevo en `lib/games.ts`.

| Campo   | Valor                                                            |
| ------- | ---------------------------------------------------------------- |
| `id`    | `voltio`                                                         |
| `title` | `VOLTIO`                                                         |
| `short` | Redactado en `/spec-impl`, tono arcade retro, una línea          |
| `long`  | Redactado en `/spec-impl`, 2–3 frases con la ficción de la placa |
| `cat`   | `ARCADE`                                                         |
| `cover` | `cover-rana`                                                     |
| `color` | `cyan`                                                           |
| `best`  | `0`                                                              |
| `plays` | `"0"`                                                            |

Se introduce un módulo de motor de juego, ajeno a React, con el **caso estándar** del contrato (un solo canvas, loop por frame que gobierna internamente el movimiento continuo de obstáculos y el salto discreto del jugador — igual forma externa que `AsteroidesEngine`/`ArkanoidEngine`/`SnakeEngine`):

```ts
// lib/games/voltio/engine.ts
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

export class VoltioEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, 3 vidas, nivel 1, nodos vacíos, carga 100
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

```tsx
// components/games/voltio-canvas.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { VoltioEngine, type EngineStats } from "@/lib/games/voltio/engine";

export type VoltioCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export const VoltioCanvas = forwardRef<VoltioCanvasHandle, Props>(
  function VoltioCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<VoltioEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new VoltioEngine(canvasRef.current, {
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

- `score`: puntuación acumulada (fila récord +10, nodo +50, carga restante ×2, placa completa +500). Sin desviación del contrato.
- `lives`: vidas restantes reales, de 3 a 0. **Sin mapeo forzado** — a diferencia de Tetris (spec 07) y Snake (spec 09), VOLTIO sí tiene vidas múltiples con respawn, así que el campo se usa con su semántica natural. Al llegar a 0 se dispara el game over.
- `level`: placa actual, empieza en 1 y sube 1 al energizar los cinco nodos; gobierna velocidad de carriles, drenaje de carga y separación de plataformas — mismo criterio que Tetris mapea nivel a velocidad de caída y Snake a intervalo de tick.
- `state`: `"playing"` durante la partida; `"dead"` durante la pausa de ~1s tras perder una vida quedando vidas (**primer uso pleno de este estado intermedio en el catálogo junto a Asteroides**, y la razón por la que el contrato lo define); `"gameover"` al agotar la tercera vida o al pulsar FIN.

La **barra de carga no viaja en `EngineStats`**: es estado interno del motor, se dibuja únicamente en el HUD del canvas y su efecto sobre el jugador se expresa a través de `lives`. Ver Decisiones.

Se agrega `voltio: { Canvas: VoltioCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, con el reexport de `VoltioCanvasHandle` junto a los existentes. No se modifica la forma de `RegisteredGame`, `GameEngineHandle` ni `GameCanvasProps`.

## Plan de implementación

1. **Esqueleto del motor y render del tablero estático.** Crear `lib/games/voltio/engine.ts` con el loop de `requestAnimationFrame` basado en delta-time (no en conteo de frames), la constante de grid (20×15 celdas de 40px), el mapa de filas (HUD, nodos, refrigerante, bus neutro, buses de datos, arranque, HUD inferior) y el dibujo estático de la placa: pistas de circuito de fondo, franja de refrigerante en cian oscuro, muro de la fila de nodos con sus 5 huecos, franjas seguras. Verificación: montando el motor sobre un canvas suelto se ve la placa completa dibujada y estable, sin errores de consola.
2. **Chispa y saltos discretos.** Añadir el estado del jugador (`col: number` como float, `row: number` entero), el dibujo de la chispa (rombo/estrella neón con `shadowBlur`) y el listener de teclado a nivel `window` con `preventDefault`: cada `keydown` de flecha produce exactamente un salto de una celda, sin auto-repeat mientras la tecla siga presionada (flag de tecla ya procesada, liberado en `keyup`). Saltos fuera del área jugable se ignoran. Verificación: la chispa se mueve celda a celda en las cuatro direcciones, no se sale del tablero, y mantener una flecha presionada no la hace deslizarse.
3. **Carriles de pulsos de datos y colisión mortal.** Generar los 5 carriles de las filas 8–12: dirección alternada por carril, velocidad px/s propia, pulsos de 1–3 celdas con espaciado regular y wrap-around por los bordes. Detección de colisión AABB entre la chispa y cualquier pulso de su fila. Al colisionar, restar una vida, entrar en `"dead"` ~1s con animación de cortocircuito y reaparecer en la fila 13 con la carga llena; con 0 vidas, `"gameover"` + `onGameOver(score)` una sola vez. Verificación: cruzar los buses es jugable y justo, chocar cuesta exactamente una vida, y el respawn devuelve la chispa al arranque.
4. **Canal de refrigerante y plataformas flotantes.** Generar los 5 carriles de las filas 2–6 con condensadores (2 celdas) y disipadores (4 celdas), dirección y velocidad propias por carril, wrap-around. Reglas: si la chispa está en una fila de refrigerante y no se solapa con ninguna plataforma, muere; si sí, su `col` se desplaza cada frame con la velocidad de esa plataforma (movimiento continuo sub-celda); si la plataforma la arrastra fuera del área visible, muere. El siguiente salto re-alinea `col` al centro de la celda más cercana. Verificación: se puede cruzar el canal saltando de plataforma en plataforma, la chispa viaja visiblemente con ellas, y caer al refrigerante o salirse por el borde cuesta una vida.
5. **Nodos, puntuación y progresión de nivel.** Implementar la fila de nodos: aterrizar en un hueco libre lo energiza (+50, +2 por unidad de carga restante), restaura la carga y devuelve la chispa a la zona de arranque; aterrizar en el muro o en un nodo ya energizado es movimiento inválido y se ignora. Marcador de fila récord por intento para el +10 por fila nueva. Al energizar el quinto nodo: +500, `level++`, nodos a vacío, velocidades ×1.15, drenaje de carga ×1.1, plataformas un poco más separadas, vidas intactas. Verificación: energizar los cinco nodos suma el bonus, sube el nivel y la placa se reinicia visiblemente más rápida.
6. **Barra de carga.** Añadir el drenaje continuo de carga (base ~7 u/s en nivel 1, escalado por nivel), su reinicio al energizar un nodo y al reaparecer, y su dibujo en la franja de HUD inferior con cambio de color al entrar en zona crítica. Llegar a 0 cuesta una vida por la misma ruta que una colisión. Verificación: quedarse quieto en la zona de arranque agota la carga y cuesta una vida; energizar un nodo la rellena por completo.
7. **HUD interno, pausa y control externo.** Dibujar la franja superior (puntuación, nivel, 5 iconos de nodo) y la inferior (carga, vidas), más los overlays internos de PAUSA y GAME OVER. Cablear `onStats` en cada frame con el mapeo de la sección Modelo de datos y los métodos `pause()/resume()/reset()/forceGameOver()/destroy()` con el mismo comportamiento que `AsteroidesEngine`. Verificación: `pause()` congela pulsos, plataformas y drenaje de carga (no solo el render); `reset()` deja score 0, 3 vidas, nivel 1, nodos vacíos; `destroy()` cancela el loop y remueve los listeners.
8. **Canvas wrapper.** Crear `components/games/voltio-canvas.tsx` con la forma `forwardRef` exacta de la sección Modelo de datos. Verificación: el componente monta y desmonta sin errores de consola y sin loops huérfanos tras desmontar.
9. **Registry.** Agregar el import de `VoltioCanvas` y la línea `voltio: { Canvas: VoltioCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, más el reexport de `VoltioCanvasHandle`. `jugar-client.tsx` no se toca. Verificación: `getRegisteredGame("voltio")` devuelve el `Canvas` correcto y los otros cuatro juegos siguen resolviendo.
10. **Fila `games`.** Insertar la fila `voltio` en Supabase vía `mcp__supabase__apply_migration` (migración `add_game_voltio`) con los valores de la tabla de Modelo de datos; `short`/`long` se redactan en este paso. Verificación: `select * from games where id = 'voltio';` devuelve la fila y la tarjeta aparece en `/` y `/biblioteca`.
11. **Verificación en navegador y build.** Recorrer `/` → tarjeta "VOLTIO" → `/juego/voltio` (detalle) → "Jugar ahora" → `/juego/voltio/jugar`. Verificar: la chispa salta celda a celda con las flechas, los pulsos matan al contacto, el canal mata si no hay plataforma bajo la chispa, viajar sobre condensadores la desplaza y salirse por el borde mata, energizar los cinco nodos sube el nivel y acelera la placa, la carga se drena y llegar a 0 cuesta una vida, el HUD interno y el `player-hud` externo (Puntuación/Vidas/Nivel) están sincronizados en cada frame, PAUSA congela el juego de verdad, FIN y game over muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN llama `saveScore({ game: "voltio", score, name })` y la entrada aparece en `/juego/voltio` y `/salon-de-la-fama`, JUGAR DE NUEVO reinicia el motor, SALIR detiene el loop y remueve listeners sin errores de consola. Confirmar que Asteroides, Tetris, Arkanoid y Snake siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `voltio` aparece en `/` y `/biblioteca` con portada `cover-rana`, categoría ARCADE y color cyan.
- [ ] `/juego/voltio` muestra el detalle con los textos `short`/`long` redactados en `/spec-impl`.
- [ ] `/juego/voltio/jugar` renderiza `VoltioCanvas` (no el bloque decorativo `.game-arena`).
- [ ] Cada pulsación de flecha produce exactamente un salto de una celda; mantener la tecla presionada no encadena saltos.
- [ ] Un salto que saldría del área jugable (columnas 0–19, filas 1–13) se ignora sin coste.
- [ ] Tocar un pulso de datos en las filas 8–12 resta exactamente una vida y provoca respawn en la fila 13 con la carga al 100.
- [ ] Estar en una fila de refrigerante (2–6) sin plataforma debajo resta una vida; estar sobre una plataforma desplaza la chispa continuamente con ella.
- [ ] Ser arrastrado por una plataforma fuera del área visible del canvas resta una vida.
- [ ] Aterrizar en un hueco de nodo libre lo energiza, suma +50 más carga restante ×2, rellena la carga y devuelve la chispa a la zona de arranque.
- [ ] Aterrizar sobre el muro de la fila de nodos o sobre un nodo ya energizado es un movimiento inválido: la chispa no se mueve y no pierde vida.
- [ ] Avanzar a una fila nueva récord del intento actual suma +10; retroceder y volver a avanzar no vuelve a sumar.
- [ ] Energizar los cinco nodos suma +500, incrementa `level`, vacía los nodos y acelera visiblemente todos los carriles, conservando las vidas restantes.
- [ ] La barra de carga se drena de forma continua y llegar a 0 cuesta una vida por la misma vía que una colisión.
- [ ] `lives` refleja vidas reales (3 → 0) y `state` pasa por `"dead"` entre muertes intermedias antes de volver a `"playing"`.
- [ ] `onGameOver` se invoca exactamente una vez por partida, con la puntuación final.
- [ ] El HUD interno del canvas y el `player-hud` HTML externo muestran siempre valores consistentes.
- [ ] PAUSA/REANUDAR congelan y reanudan realmente pulsos, plataformas y drenaje de carga (no solo el render).
- [ ] Guardar la puntuación inserta en `scores` y aparece en `/juego/voltio` y `/salon-de-la-fama`.
- [ ] `GAME_REGISTRY` incluye `voltio` y Asteroides/Tetris/Arkanoid/Snake siguen funcionando sin regresión.
- [ ] `components/jugar-client.tsx` no tiene ni una línea nueva específica de `voltio`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Juego original inspirado en el género "cruzar carriles", no un port de Frogger.** El tema recibido era "cruzar carriles de tráfico y el río". Se descartó reproducir ranas, coches y troncos literales: la reinterpretación como chispa de energía cruzando una placa de circuito encaja mucho mejor con el sistema visual neón del sitio (`--cyan`/`--green`/`--magenta`, glow, rejilla de perspectiva) y permite reutilizar `cover-rana` — cuyas franjas cian horizontales leen exactamente como carriles de bus y su círculo verde como la chispa.
- **`id: "voltio"` / `title: "VOLTIO"`.** Slug corto, libre frente a `lib/games/registry.ts` y frente a `select id from games`, y coherente con el tono de una sola palabra en mayúsculas de `TETRIS`/`SNAKE`/`ARKANOID`. Se descartaron `rana`, `frogger` y `cruce` por ser demasiado literales del género de origen.
- **`cover: "cover-rana"`.** Clase ya definida en `app/globals.css` y sin uso en ninguna fila de `games`. Su composición (bandas horizontales repetidas cada 40px + círculo central brillante) coincide de forma casi literal con el tablero de carriles de este juego, así que se reutiliza tal cual. No se crea CSS nuevo, mismo criterio que specs 05, 07, 08 y 09. Se descartó `cover-duelo` (evoca un versus de dos naves) y `cover-glot`/`cover-invaders` (reservadas por nombre a otros géneros).
- **`cat: "ARCADE"` pese a que `VERSUS` es la categoría sin representar.** El criterio de diversidad de categoría cede aquí porque este juego es estrictamente de un jugador contra el reloj y el tablero: etiquetarlo `VERSUS` mentiría al usuario en la biblioteca. `PUZZLE` tampoco aplica (no hay resolución, hay reflejos) ni `SHOOTER` (no se dispara). Queda `ARCADE`, que ya comparte con `arkanoid` y `snake`.
- **`color: "cyan"` aunque los cuatro colores del sistema ya están en uso.** Con `asteroides` (yellow), `tetris` (cyan), `arkanoid` (magenta) y `snake` (green) no queda ninguno libre, así que la elección es de coherencia visual: la placa de circuito y el refrigerante son cian en el propio `cover-rana`. Se descartó `green` precisamente por ser el de `snake`, que además es el otro juego de rejilla del catálogo — repetir color entre dos juegos de grid los haría confundibles en la cuadrícula de la biblioteca.
- **Grid híbrido: jugador discreto, obstáculos continuos.** Se descartó el grid puro por tick (estilo Snake, spec 09) porque haría que los pulsos "teletransportaran" y eliminaría la tensión de timing propia del género; y se descartó el movimiento continuo puro (estilo Arkanoid) porque hace imposible la lectura de "estoy a salvo en esta fila". El híbrido — fila entera, columna float — es lo que hace legible el juego y es la decisión de diseño central de esta spec.
- **Barra de carga en vez de temporizador por nodo.** El género original usa una cuenta atrás por intento. Se sustituye por una barra de carga que se drena y que además **premia la velocidad con puntos** (carga restante ×2 al energizar), convirtiendo un castigo en un incentivo. Es el giro propio que separa a VOLTIO de un clon.
- **La carga no entra en `EngineStats`.** Sería el candidato natural a un campo nuevo, y se descarta explícitamente: el contrato del catálogo es cerrado por diseño (`AGENTS.md`/`CLAUDE.md`: "Never extend `EngineStats`"). La carga vive en el HUD dibujado dentro del canvas — mismo lugar donde Tetris muestra su información propia — y su consecuencia sí llega al HUD externo a través de `lives`. Añadir un campo obligaría a tocar `jugar-client.tsx` y rompería el "una línea en `GAME_REGISTRY`" para el juego N+1.
- **`lives` con semántica real (3 vidas + respawn), sin mapeo forzado.** A diferencia de Tetris y Snake, que tuvieron que fijar `lives` en 1/0, este juego tiene vidas múltiples de forma natural. Se aprovecha para que el catálogo tenga por fin un motor de grid con `lives` genuino y con uso real del estado `"dead"` como pausa de respawn.
- **Los nodos energizados se conservan al morir, pero se vacían al subir de nivel.** Perder toda la placa por una muerte haría el juego frustrante con solo 3 vidas y una barra de carga corriendo; vaciar los nodos al subir de nivel es lo que da estructura de "placa nueva" a la progresión.
- **Puntuación por fila récord del intento, no por cada avance.** Sin el marcador de récord, saltar arriba-abajo en la zona segura sería una máquina infinita de puntos y arruinaría el leaderboard compartido de `/salon-de-la-fama`.
- **Sin assets externos.** No se crea `public/games/voltio/`: pulsos, condensadores, chispa y placa son rectángulos con gradiente y `shadowBlur`, en la línea de Asteroides (vectorial) y Tetris (primitivas). Evita descargar binarios y mantiene el peso del bundle intacto.
- **Todo lo "jugoso" (power-ups, audio, partículas) se difiere a la spec 12.** Esta spec entrega un juego completo y guardable de punta a punta; la siguiente lo enriquece sin tocar el contrato. Así la primera puede implementarse, verificarse y mergearse sola.

## Riesgos identificados

- **Re-alineación de columna al saltar desde una plataforma.** La chispa lleva una `col` fraccionaria mientras viaja sobre un condensador; si el salto redondea al centro de celda de forma inconsistente (p. ej. `Math.round` con la posición ya desplazada por el delta del frame), el jugador percibirá saltos que "se comen" media celda o que lo dejan pegado al borde de un pulso. Fijar una única función de re-alineación y usarla tanto en el salto como en la detección de colisión.
- **Colisión sub-celda entre chispa y plataforma.** Estar "sobre" una plataforma no puede evaluarse por celda entera: si se exige solapamiento total, saltar al extremo de un condensador de 2 celdas fallará injustamente; si se exige solapamiento mínimo, se podrá flotar con un píxel apoyado. Definir un umbral explícito (p. ej. ≥50% del ancho de la chispa dentro de la plataforma) y verificarlo a mano en el paso 4.
- **Muerte por arrastre fuera del canvas vs. wrap-around de las plataformas.** Las plataformas hacen wrap por los bordes, pero el jugador que viaja sobre ellas **no** debe hacerlo: hay que separar claramente la posición de la plataforma (wrapea) de la del jugador (muere al salir), o el jugador reaparecerá mágicamente por el otro lado.
- **Delta-time y pausa.** El drenaje de carga y el avance de los carriles dependen del delta entre frames; si `pause()` no congela también el reloj de referencia, al reanudar se aplicará de golpe todo el tiempo transcurrido en pausa (carga vaciada, pulsos teletransportados y muerte instantánea). Guardar y descontar el tiempo de pausa explícitamente.
- **Generación de carriles injugables.** Con velocidades y espaciados aleatorios por nivel, es posible producir combinaciones sin hueco viable (dos carriles adyacentes cuya fase deja siempre un pulso encima). Usar patrones deterministas por nivel derivados de una tabla, no aleatoriedad pura, y comprobar en el paso 5 que los niveles 1–4 son cruzables.
- **Escalado de dificultad compuesto.** Velocidad ×1.15 y drenaje ×1.1 por nivel son multiplicativos: hacia el nivel 8 la placa es varias veces más rápida. Confirmar en la verificación si conviene una cota superior de velocidad, y dejarlo anotado si la spec 12 debe ajustarlo.
- **Cinco carriles de refrigerante son muchos para 3 vidas.** El balance entre longitud del canal y vidas solo se puede juzgar jugando; si el paso 4 revela que es brutal, la corrección permitida dentro del alcance es ajustar el ancho/frecuencia de las plataformas del nivel 1, no reducir la altura del tablero (rompería el mapa de filas fijado en el Alcance).
