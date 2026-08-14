# 09 — Juego: Snake

**Estado:** Approved
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-08-13

**Objetivo:** Crear un nuevo juego real y jugable "Snake" dentro de `/juego/snake/jugar`, con motor de grid/tick de un solo canvas registrado vía `GAME_REGISTRY`, usando los assets reales de `references/source-assets/snake-assets/` (`fruits.png` + `sprites.js`) para las frutas, e integrado con el leaderboard real de Supabase.

## Alcance

**Incluye:**

- Nueva entrada `snake` en la tabla `games` de Supabase: `cat: "ARCADE"`, `color: "green"`, `cover: "cover-snake"` (clase CSS ya existente en `app/globals.css`, sin uso actualmente — se reutiliza tal cual, sin crear CSS nuevo). `title: "SNAKE"`. `short`/`long` se redactan durante `/spec-impl`, mismo tono arcade retro que el resto de `GAMES` (igual criterio que specs 05, 07 y 08). `best: 0`, `plays: "0"` — sin inflar con datos mock, juego recién estrenado.
- Motor de Snake escrito desde cero en TypeScript (no hay `game.js` de referencia para este juego — solo assets sueltos en `references/source-assets/snake-assets/`): tablero de grid 40×30 celdas de 20px sobre canvas 800×600, serpiente que avanza por tick (no por frame continuo), cambio de dirección por teclado sin permitir giro de 180° instantáneo sobre el propio cuerpo, fruta única en el tablero en todo momento que se reubica en una celda vacía al azar tras ser comida, crecimiento de la serpiente en un segmento por fruta comida, y fin de partida al chocar contra una pared del tablero o contra el propio cuerpo.
- Assets originales portados tal cual: `fruits.png` y el atlas de coordenadas `sprites.js` (`window.SPRITE_ATLAS.fruits`, 22 variedades de fruta) se copian a `public/games/snake/` y se cargan desde el propio motor (mismo patrón de carga por `Image` que usa el spritesheet de Arkanoid). El motor sigue siendo autocontenido: la carga de sprites ocurre dentro de `SnakeEngine`, no en el wrapper React ni en `jugar-client.tsx`. El cuerpo/cabeza de la serpiente **no** usa sprites (el atlas solo trae frutas) — se dibuja con primitivas de canvas (rectángulos redondeados en verde, tema del juego), mismo criterio de "sin assets externos para las formas jugables" que siguieron Asteroides y Tetris.
- Fruta seleccionada al azar en cada aparición entre las 22 variedades de `SPRITE_ATLAS.fruits` (banana, orange, grape, garlic, eggplant, strawberry, cherry, carrot, mushroom, broccoli, watermelon, pepper, kiwi, lemon, peach, peanut, apple, tomato, berries, grapes2, pineapple, melon) — todas valen los mismos puntos, la variedad es solo visual.
- Puntuación: +10 puntos por fruta comida, sin distinción de tipo.
- Progresión de nivel: `level` empieza en 1 y sube 1 cada 5 frutas comidas, reduciendo el intervalo del tick de movimiento (la serpiente se mueve más rápido en niveles altos) — mapeo de "nivel" a dificultad creciente, mismo criterio que Tetris (spec 07) mapea nivel a velocidad de caída.
- Motor de un solo canvas (caso estándar, igual forma que `AsteroidesEngine`/`ArkanoidEngine`): constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`, métodos `pause/resume/reset/forceGameOver/destroy`.
- Controles: solo teclado, `←`/`→`/`↑`/`↓` cambian la dirección de movimiento, capturados a nivel `window` con `preventDefault`, mismo patrón que `AsteroidesEngine`/`ArkanoidEngine`. Un giro que invierte la dirección actual en 180° sobre el propio cuerpo (p. ej. presionar `↓` mientras se mueve hacia arriba) se ignora en vez de causar colisión inmediata contra el segundo segmento.
- Canvas de 800×600 (grid de 40×30 celdas de 20px) para igualar las dimensiones ya usadas por `AsteroidesCanvas`/`ArkanoidCanvas` y mantener consistente el área de juego dentro de `/juego/[id]/jugar` frente al resto del catálogo de un solo canvas.
- Integración vía el registry ya existente (`lib/games/registry.ts` desde spec 07): se agrega `snake: { Canvas: SnakeCanvas }` a `GAME_REGISTRY`. `jugar-client.tsx` no cambia — el guard `registered = getRegisteredGame(game.id)` ya cubre cualquier id presente en el registry.

**No incluye (fuera de alcance):**

- Wrap-around en los bordes del tablero — chocar contra cualquier pared termina la partida, igual que chocar contra el propio cuerpo. No hay modo "sin paredes".
- Obstáculos, power-ups, múltiples frutas simultáneas en el tablero, o cualquier mecánica no acordada en esta spec.
- Vidas múltiples con respawn — ver mapeo forzado de `lives` en Decisiones.
- Controles WASD o táctiles/on-screen para móvil — solo flechas de teclado.
- Cambios a `asteroides`, `tetris`, `arkanoid` o al registry existente más allá de la línea nueva en `GAME_REGISTRY`.

## Modelo de datos

Se agrega una fila a la tabla `games` de Supabase (esquema sin cambios desde spec 06: `id, title, short, long, cat, cover, color, best, plays`); no se introduce ningún tipo nuevo en `lib/games.ts`.

Se introduce un módulo de motor de juego, ajeno a React, con el **caso estándar** del contrato (un solo canvas, loop por frame que internamente gobierna un tick discreto de movimiento — igual forma externa que `AsteroidesEngine`/`ArkanoidEngine`):

```ts
// lib/games/snake/engine.ts
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

export class SnakeEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, serpiente inicial, nivel 1
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

```tsx
// components/games/snake-canvas.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { SnakeEngine, type EngineStats } from "@/lib/games/snake/engine";

export type SnakeCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export const SnakeCanvas = forwardRef<SnakeCanvasHandle, Props>(
  function SnakeCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SnakeEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new SnakeEngine(canvasRef.current, {
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

- `score`: puntuación acumulada (+10 por fruta comida), sin desviación.
- `lives`: **mapeo forzado** — Snake no tiene vidas en el original (una sola colisión termina la partida). `lives` vale `1` durante toda la partida y pasa a `0` en el mismo instante en que `state` pasa a `"gameover"`. Ver Decisiones.
- `level`: nivel actual, empieza en 1 y sube 1 cada 5 frutas comidas; controla el intervalo del tick de movimiento (más alto = más rápido).
- `state`: `"playing"` durante la partida; `"gameover"` al chocar contra una pared del tablero o contra el propio cuerpo. No se usa `"dead"` como estado intermedio (no hay respawn ni vidas restantes que consumir).

Se agrega `snake: { Canvas: SnakeCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`. No se modifica la forma de `RegisteredGame`, `GameEngineHandle` ni `GameCanvasProps`.

## Plan de implementación

1. **Assets.** Copiar `references/source-assets/snake-assets/fruits.png` y `references/source-assets/snake-assets/sprites.js` (o el atlas de coordenadas ya portado a un módulo TS equivalente) a `public/games/snake/`. Verificación: el archivo `fruits.png` existe en `public/games/snake/` y es accesible vía `/games/snake/fruits.png` con el dev server corriendo.
2. **Motor del juego.** Crear `lib/games/snake/engine.ts`: grid 40×30 celdas de 20px, estado de serpiente (array de segmentos `{x, y}`), dirección actual y dirección en cola (para evitar giros de 180° instantáneos), tick de movimiento gobernado por un intervalo dependiente de `level` (más frutas → más nivel → tick más corto), colocación de fruta en celda vacía aleatoria con tipo aleatorio del atlas `SPRITE_ATLAS.fruits`, detección de colisión contra pared y contra el propio cuerpo, crecimiento de un segmento al comer, dibujo del cuerpo con primitivas de canvas y de la fruta con `drawImage` recortando del spritesheet cargado desde `/games/snake/fruits.png`. Cablear `onStats`/`onGameOver` con el mapeo descrito en Modelo de datos, y `pause()/resume()/reset()/forceGameOver()/destroy()` con el mismo comportamiento que `AsteroidesEngine`/`ArkanoidEngine`. Verificación: partida jugable de forma aislada (test manual en una página temporal o consola) — la serpiente se mueve, cambia de dirección con las flechas, crece al comer, y termina al chocar.
3. **Canvas wrapper.** Crear `components/games/snake-canvas.tsx` con la forma `forwardRef` exacta de la sección Modelo de datos. Verificación: el componente monta y desmonta sin errores de consola, `destroy()` detiene el loop al desmontar.
4. **Registry.** Agregar `snake: { Canvas: SnakeCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, con su import correspondiente. No-op sobre `jugar-client.tsx`: el refactor a `registered`/`GAME_REGISTRY` ya existe desde spec 07, esta spec solo añade una entrada. Verificación: `getRegisteredGame("snake")` devuelve el `Canvas` correcto.
5. **Fila `games`.** Insertar la fila `snake` en Supabase vía `mcp__supabase__apply_migration` (migración `add_game_snake`) con los valores acordados en el Alcance (`cat: "ARCADE"`, `color: "green"`, `cover: "cover-snake"`, `best: 0`, `plays: "0"`, `title: "SNAKE"`, `short`/`long` redactados en este paso).
6. **Verificación en navegador.** Recorrer `/` → tarjeta "SNAKE" → `/juego/snake` (detalle) → "Jugar ahora" → `/juego/snake/jugar`. Verificar: la serpiente se mueve continuamente y cambia de dirección con las flechas sin permitir giro de 180° instantáneo, come frutas de sprites distintos que aparecen en posiciones aleatorias, crece y suma +10 puntos por fruta, el nivel sube cada 5 frutas y el tick se acelera visiblemente, chocar contra una pared o contra el propio cuerpo termina la partida, HUD interno (score/nivel/vidas) y externo (`player-hud`) están sincronizados en cada frame, PAUSA detiene realmente el tick de movimiento, FIN y fin de partida muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN llama `saveScore({ game: "snake", score, name })` y aparece en `/juego/snake` y `/salon-de-la-fama`, JUGAR DE NUEVO reinicia el motor, SALIR detiene el loop y remueve listeners sin errores de consola. Confirmar que Asteroides, Tetris y Arkanoid siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `snake` aparece en `/` con portada `cover-snake`, categoría ARCADE y color green.
- [ ] `/juego/snake` muestra el detalle del juego con los textos `short`/`long` redactados en `/spec-impl`.
- [ ] `/juego/snake/jugar` renderiza `SnakeCanvas` (no el bloque decorativo `.game-arena`).
- [ ] La serpiente responde a `←`/`→`/`↑`/`↓`, ignora un giro de 180° instantáneo sobre su propio cuerpo, y avanza a intervalos regulares (no en tiempo continuo).
- [ ] Comer una fruta suma exactamente +10 puntos, hace crecer la serpiente en un segmento, y coloca una nueva fruta de tipo aleatorio en una celda vacía.
- [ ] El nivel sube cada 5 frutas comidas y el tick de movimiento se acelera de forma perceptible en niveles altos.
- [ ] Chocar contra cualquier pared del tablero o contra el propio cuerpo dispara `onGameOver` inmediatamente.
- [ ] El HUD interno del canvas (score/nivel/vidas) y el `player-hud` HTML externo (Puntuación/Vidas/Nivel) muestran siempre valores consistentes, con `lives` fijo en 1 hasta el game over.
- [ ] PAUSA/REANUDAR detienen y reanudan realmente el tick del motor (no un mock).
- [ ] Guardar la puntuación inserta en `scores` y aparece en `/juego/snake` y `/salon-de-la-fama`.
- [ ] `GAME_REGISTRY` incluye `snake` y Asteroides/Tetris/Arkanoid siguen funcionando sin regresión.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **`lives` fijo en 1 hasta el game over, sin sistema de vidas múltiples.** Decisión explícita del usuario: el Snake original no tiene vidas, una sola colisión termina la partida. En vez de introducir un campo nuevo al contrato `EngineStats`, se reutiliza `lives` con un mapeo forzado (`1` mientras `state === "playing"`, `0` al entrar en `"gameover"`) — mismo criterio que llevó a spec 07 (Tetris) a mapear `lives` sin inventar campos nuevos.
- **Sin respawn con 3 vidas.** Se consideró y se descartó explícitamente por el usuario: cambiaría la mecánica reconocible de Snake (una colisión = fin) y complicaría el motor sin necesidad real, dado que el contrato ya se satisface con el mapeo forzado anterior.
- **Choque contra pared = game over, sin wrap-around.** Decisión explícita del usuario para mantener el Snake clásico de arcade (colisión con borde termina la partida), en vez de un modo "sin paredes" que cambiaría la dificultad y el balance del juego.
- **`level` mapeado a velocidad del tick, subiendo cada 5 frutas.** Decisión explícita del usuario: aunque Snake no tiene "niveles" en el sentido de Arkanoid (tableros distintos) o Tetris (rejilla que se llena), se reutiliza `level` para representar dificultad creciente vía tick más corto — mismo patrón que Tetris mapea nivel a velocidad de caída (spec 07).
- **Frutas: rotación aleatoria entre las 22 variedades del atlas, todas valen los mismos puntos.** Decisión explícita del usuario para aprovechar la variedad visual completa de `fruits.png` sin complicar el sistema de puntuación con valores distintos por fruta.
- **Cuerpo de la serpiente dibujado con primitivas de canvas, no con sprites.** El atlas `SPRITE_ATLAS` solo define coordenadas de frutas (`fruits.png`), no de cabeza/cuerpo/cola de serpiente. Se dibuja con formas sólidas en verde, mismo criterio "sin assets externos para las formas jugables" que Asteroides y Tetris (los assets reales sí se usan, pero solo para lo que efectivamente cubren: las frutas).
- **`cat: "ARCADE"` en vez de `PUZZLE`.** Decisión explícita del usuario: Snake es un clásico arcade de reflejos y planificación en tiempo real, no un rompecabezas estático como Tetris.
- **`color: "green"`.** Decisión explícita del usuario para diferenciarse de yellow (asteroides), cyan (tetris) y magenta (arkanoid), ya en uso — completa los 4 colores base disponibles en el catálogo.
- **`cover: "cover-snake"`.** Clase CSS ya definida en `app/globals.css` sin uso actual, nombrada explícitamente para este juego. Se reutiliza tal cual, sin crear CSS nuevo — mismo criterio que specs 05, 07 y 08.
- **Registry ya existente (spec 07): no hay refactor que hacer aquí.** A diferencia de spec 07, que tuvo que crear `lib/games/registry.ts` desde cero, esta spec solo agrega una línea a `GAME_REGISTRY`. `jugar-client.tsx` no se toca.
- **No hay `game.js` de referencia para portar.** A diferencia de Asteroides/Tetris/Arkanoid (specs 05/07/08), que portaron un motor standalone ya funcional desde `references/started-games/`, Snake se construye desde cero en `lib/games/snake/engine.ts` porque `references/source-assets/snake-assets/` solo contiene assets sueltos (`fruits.png`, `sprites.js`), no una implementación de juego. La lógica de grid/tick/colisiones se diseña siguiendo las reglas clásicas de Snake, no un port literal de código existente.

## Riesgos identificados

- El loop de `requestAnimationFrame` debe desacoplar el render (cada frame) del tick de movimiento (cada N ms, dependiente de `level`) — si se acopla el movimiento directamente al framerate del navegador, la velocidad de la serpiente variaría con el refresh rate de la pantalla en vez de ser consistente entre dispositivos.
- Colocar la fruta en una celda vacía aleatoria requiere excluir todas las celdas ocupadas por el cuerpo de la serpiente; en tableros casi llenos (serpiente muy larga) la búsqueda de celda libre debe tener una cota de intentos o un fallback determinista para no bloquear el loop.
- `fruits.png` es una hoja de sprites grande (3790×442px según el comentario de `sprites.js`); confirmar que el recorte con `drawImage` desde las coordenadas del atlas escala correctamente al tamaño de celda de 20px sin distorsión perceptible.
- Al ser el primer motor de grid/tick del catálogo (Asteroides/Arkanoid son de física continua, Tetris ya maneja timing propio pero con piezas, no un cuerpo que crece), verificar en el paso 6 que la sensación de "instantáneo" al presionar una flecha se sienta responsiva pese a que el movimiento real solo ocurre en el siguiente tick.
