# 08 — Juego: Arkanoid

**Estado:** Approved
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-08-13

**Objetivo:** Portar el juego standalone `references/started-games/04-arkanoid/game.js` (canvas HTML5 con sprites y sonido) a un nuevo juego real y jugable "Arkanoid" dentro de `/juego/arkanoid/jugar`, con motor de un solo canvas registrado vía `GAME_REGISTRY` e integrado con el leaderboard real de Supabase.

## Alcance

**Incluye:**

- Nueva entrada `arkanoid` en la tabla `games` de Supabase: `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-bricks"` (clase CSS ya existente en `app/globals.css`, sin uso actualmente — se reutiliza tal cual, sin crear CSS nuevo). `title: "ARKANOID"`. `short`/`long` se redactan durante `/spec-impl`, mismo tono arcade retro que el resto de `GAMES` (igual criterio que specs 05 y 07). `best: 0`, `plays: "0"` — sin inflar con datos mock, juego recién estrenado.
- Puerto a TypeScript de la lógica completa de `game.js`: pala, bola con rebote por ángulo de impacto (`MAX_BOUNCE_ANGLE`), tablero de bloques (`BRICK_COLS`, `BRICK_ROW_COLORS`), colisiones bola-bloque y bola-pala por distancia al punto más cercano (`checkBrickCollisions`/`checkPaddleCollision`), animación de explosión al romper un bloque (`explosions`, `EXPLOSION_DURATION`, `EXPLOSION_FRAMES`), 3 niveles progresivos (`LEVELS`: 5/6/7 filas) con velocidad de bola creciente (`getBallSpeedForLevel`), sistema de vidas (3 iniciales) y puntuación (+10 por bloque).
- Assets originales portados tal cual: `assets/spritesheet-breakout.png` y los sonidos `assets/sounds/ball-bounce.mp3` / `assets/sounds/break-sound.mp3` se copian a `public/games/arkanoid/` y se cargan desde el propio motor (mismo patrón de carga por `Image`/`Audio` que el original, sin librerías nuevas). El motor sigue siendo autocontenido: la carga de sprites/audio ocurre dentro de `ArkanoidEngine`, no en el wrapper React ni en `jugar-client.tsx`.
- Motor de un solo canvas (caso estándar, igual forma que `AsteroidesEngine`): constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`, métodos `pause/resume/reset/forceGameOver/destroy`.
- Controles: solo teclado, `←`/`→` mueven la pala, capturados a nivel `window` con `preventDefault`, mismo patrón que `AsteroidesEngine`. El control de pala por mouse (`canvas.addEventListener('click', ...)` para iniciar/reiniciar, y cualquier seguimiento de `mousemove`) del original **no se porta** — ver nota en Decisiones. La tecla `P` de pausa interna tampoco se porta: la pausa la controla exclusivamente `pause()`/`resume()` del motor, invocados por el botón PAUSA/REANUDAR del `player-hud` externo, igual que Asteroides y Tetris.
- Canvas de 800×600 (en vez de los 640×480 del original) para igualar las dimensiones ya usadas por `AsteroidesCanvas` y mantener consistente el área de juego dentro de `/juego/[id]/jugar` frente al resto del catálogo de un solo canvas. Todas las constantes de layout del original (`BRICK_OFFSET_LEFT`, posiciones de pala/bola) se recalculan proporcionalmente al nuevo tamaño de canvas, sin cambiar la cantidad de columnas/filas ni el balance de velocidad.
- Integración vía el registry ya existente (`lib/games/registry.ts` desde spec 07): se agrega `arkanoid: { Canvas: ArkanoidCanvas }` a `GAME_REGISTRY`. `jugar-client.tsx` no cambia — el guard `registered = getRegisteredGame(game.id)` ya cubre cualquier id presente en el registry.

**No incluye (fuera de alcance):**

- Control de pala por mouse — el original lo menciona en el README y lo implementa parcialmente vía el listener de `click` (solo para iniciar/reiniciar partida, no para mover la pala con `mousemove` — el README es aspiracional en este punto, `game.js` no implementa seguimiento de pala por mouse). No se porta ningún control por mouse; solo teclado, igual que Asteroides y Tetris.
- Pantalla de inicio (`drawStartScreen`), pantalla de victoria (`drawVictoryScreen`) y pantalla de "level up" (`drawLevelUpScreen`) como paso separado de "pulsa una tecla" — el flujo de "empezar partida" ya lo controla `/juego/arkanoid/jugar` como en el resto del catálogo. El motor arranca directamente en `"playing"` al construirse, igual que `AsteroidesEngine`.
- Pausa interna por tecla `P` y su overlay `drawPauseOverlay` propio — se sustituye por el `pause()`/`resume()` real del contrato del motor, igual que Asteroides/Tetris (aunque el overlay visual de "PAUSA" dibujado en el propio canvas sí puede portarse como feedback interno, ver Modelo de datos).
- Tabla de récords o persistencia propia — el original no tiene ninguna (a diferencia de Tetris), así que no hay nada que descartar aquí; el leaderboard real ya existe en Supabase (patrón de spec 06).
- Niveles adicionales más allá de los 3 originales, power-ups, o cualquier mecánica no presente en `game.js`.
- Cambios a `asteroides`, `tetris` o al registry existente más allá de la línea nueva en `GAME_REGISTRY`.
- Controles táctiles / on-screen para móvil.

## Modelo de datos

Se agrega una fila a la tabla `games` de Supabase (esquema sin cambios desde spec 06: `id, title, short, long, cat, cover, color, best, plays`); no se introduce ningún tipo nuevo en `lib/games.ts`.

Se introduce un módulo de motor de juego, ajeno a React, con el **caso estándar** del contrato (un solo canvas, igual forma que `AsteroidesEngine`):

```ts
// lib/games/arkanoid/engine.ts
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

export class ArkanoidEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, 3 vidas, nivel 1
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop, remueve listeners de teclado, detiene audio
}
```

```tsx
// components/games/arkanoid-canvas.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ArkanoidEngine, type EngineStats } from "@/lib/games/arkanoid/engine";

export type ArkanoidCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export const ArkanoidCanvas = forwardRef<ArkanoidCanvasHandle, Props>(
  function ArkanoidCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ArkanoidEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new ArkanoidEngine(canvasRef.current, {
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

- `score`: puntuación acumulada (+10 por bloque roto), sin desviación respecto al original.
- `lives`: mapeo directo — el original ya tiene 3 vidas iniciales, sin transformación forzada (a diferencia del mapeo forzado de Tetris en spec 07).
- `level`: nivel actual (1 a 3), directo desde `currentLevel`.
- `state`: `"playing"` durante la partida; `"gameover"` cuando `lives` llega a 0 **o** cuando se limpian los bloques del nivel 3 (victoria). No se introduce un cuarto estado `"victory"` — limpiar el último nivel se trata como game over exitoso: se llama `onGameOver(score)` igual que al perder, preservando el contrato fijo de `EngineStats`. El overlay interno del canvas sí puede distinguir visualmente "VICTORIA" de "GAME OVER" antes de notificar, ya que eso es render interno del motor, no parte del contrato compartido.

Se agrega `arkanoid: { Canvas: ArkanoidCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`. No se modifica la forma de `RegisteredGame`, `GameEngineHandle` ni `GameCanvasProps`.

## Plan de implementación

1. **Assets.** Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`, `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` a `public/games/arkanoid/`. Verificación: los archivos existen en `public/games/arkanoid/` y son accesibles vía `/games/arkanoid/<archivo>` con el dev server corriendo.
2. **Motor del juego.** Crear `lib/games/arkanoid/engine.ts`: portar el modelo de pala/bola/bloques, `checkBrickCollisions`/`checkPaddleCollision` con el cálculo de ángulo de rebote, `generateBricks` para los 3 niveles (`LEVELS`), `getBallSpeedForLevel`, el sistema de explosiones (`explosions`, `EXPLOSION_DURATION`, `EXPLOSION_FRAMES`) y la carga de spritesheet (`loadSpritesheet`/`drawSprite`/`drawFrame` adaptados para cargar desde `/games/arkanoid/spritesheet-breakout.png`) y sonidos (`playSound` adaptado a `/games/arkanoid/ball-bounce.mp3` y `/games/arkanoid/break-sound.mp3`) dentro de la clase `ArkanoidEngine`. Recalcular constantes de layout (`BRICK_OFFSET_LEFT`, posición inicial de pala/bola) para el canvas 800×600. Cablear `onStats`/`onGameOver` con el mapeo descrito en Modelo de datos, y `pause()/resume()/reset()/forceGameOver()/destroy()` con el mismo comportamiento que `AsteroidesEngine`. Verificación: partida jugable de forma aislada (test manual en una página temporal o consola) — la bola rebota, los bloques se rompen con sonido y explosión, las vidas bajan al caer la bola.
3. **Canvas wrapper.** Crear `components/games/arkanoid-canvas.tsx` con la forma `forwardRef` exacta de la sección Modelo de datos. Verificación: el componente monta y desmonta sin errores de consola, `destroy()` detiene el loop y el audio al desmontar.
4. **Registry.** Agregar `arkanoid: { Canvas: ArkanoidCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, con su import correspondiente. No-op sobre `jugar-client.tsx`: el refactor a `registered`/`GAME_REGISTRY` ya existe desde spec 07, esta spec solo añade una entrada. Verificación: `getRegisteredGame("arkanoid")` devuelve el `Canvas` correcto.
5. **Fila `games`.** Insertar la fila `arkanoid` en Supabase vía `mcp__supabase__apply_migration` (migración `add_game_arkanoid`) con los valores acordados en el Alcance (`cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-bricks"`, `best: 0`, `plays: "0"`, `title: "ARKANOID"`, `short`/`long` redactados en este paso).
6. **Verificación en navegador.** Recorrer `/` → tarjeta "ARKANOID" → `/juego/arkanoid` (detalle) → "Jugar ahora" → `/juego/arkanoid/jugar`. Verificar: la pala se mueve con flechas, la bola rebota en pala/paredes/bloques con el ángulo esperado, los bloques se rompen con sprite de explosión y sonido, al limpiar un nivel se avanza al siguiente con más filas, al limpiar el nivel 3 termina la partida como game over exitoso, al perder las 3 vidas termina como game over, HUD interno (score/nivel/vidas) y externo (`player-hud`) están sincronizados en cada frame, PAUSA detiene realmente el loop y el audio, FIN y fin de partida muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN llama `saveScore({ game: "arkanoid", score, name })` y aparece en `/juego/arkanoid` y `/salon-de-la-fama`, JUGAR DE NUEVO reinicia el motor, SALIR detiene el loop y remueve listeners sin errores de consola. Confirmar que Asteroides y Tetris siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `arkanoid` aparece en `/` con portada `cover-bricks`, categoría ARCADE y color magenta.
- [ ] `/juego/arkanoid` muestra el detalle del juego con los textos `short`/`long` redactados en `/spec-impl`.
- [ ] `/juego/arkanoid/jugar` renderiza `ArkanoidCanvas` (no el bloque decorativo `.game-arena`).
- [ ] La pala responde a `←`/`→`, la bola rebota con ángulo dependiente del punto de impacto en la pala, los bloques se rompen con sprite de explosión y sonido de rotura, el sonido de rebote suena en paredes/pala.
- [ ] Los 3 niveles (5/6/7 filas) progresan correctamente y la velocidad de la bola aumenta por nivel.
- [ ] El HUD interno del canvas (score/nivel/vidas) y el `player-hud` HTML externo (Puntuación/Vidas/Nivel) muestran siempre valores consistentes.
- [ ] PAUSA/REANUDAR detienen y reanudan realmente el loop del motor (no un mock).
- [ ] Perder las 3 vidas y limpiar el nivel 3 ambos disparan `onGameOver` y el modal de guardar puntuación.
- [ ] Guardar la puntuación inserta en `scores` y aparece en `/juego/arkanoid` y `/salon-de-la-fama`.
- [ ] `GAME_REGISTRY` incluye `arkanoid` y Asteroides/Tetris siguen funcionando sin regresión.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Assets originales (spritesheet + sonidos) sí se portan**, a diferencia del criterio "sin assets externos" seguido por los motores de Asteroides y Tetris. Decisión explícita del usuario: el arte pixel del spritesheet y los sonidos de rebote/rotura son parte reconocible de este juego de referencia y no tienen un equivalente razonable dibujado por primitivas de canvas sin perder fidelidad. Los assets viven en `public/games/arkanoid/` y se cargan solo desde dentro del motor, manteniendo el resto del contrato (`EngineStats`, wrapper `forwardRef`) intacto.
- **Canvas 800×600 en vez de los 640×480 del original.** Decisión explícita del usuario para igualar el tamaño ya usado por `AsteroidesCanvas` y mantener consistencia visual entre los juegos de un solo canvas del catálogo. Todas las constantes de layout del motor se recalculan proporcionalmente; no cambia la cantidad de bloques ni el balance de velocidad/vidas.
- **Sin estado `"victory"` en `EngineStats.state`.** El original distingue `gameover` de `victory` con pantallas separadas. Se colapsan ambos en `"gameover"` para no tocar el contrato fijo compartido con Asteroides/Tetris — mismo criterio que llevó a spec 07 a mapear `lives` de Tetris sin inventar campos nuevos. El motor puede seguir dibujando un overlay interno distinto para "victoria" vs "derrota" antes de notificar `onGameOver`, ya que eso no forma parte del contrato observado por `jugar-client.tsx`.
- **Control de pala por mouse no se porta.** Mismo criterio que Asteroides/Tetris: solo teclado, capturado a nivel `window`. El README de la referencia menciona control por mouse pero `game.js` solo implementa un listener de `click` para iniciar/reiniciar (no arrastre de pala) — se descarta también, ya que el flujo de "iniciar partida" lo controla `/juego/arkanoid/jugar`, no el propio canvas.
- **Pausa por tecla `P` interna no se porta.** Se sustituye enteramente por `pause()`/`resume()` del contrato del motor, disparado por el botón del `player-hud` externo — mismo patrón que Asteroides/Tetris, para no tener dos mecanismos de pausa compitiendo.
- **`cat: "ARCADE"` en vez de `PUZZLE`.** Decisión explícita del usuario: Arkanoid/Breakout es un clásico arcade de acción y reflejos, no un juego de rompecabezas como Tetris.
- **`color: "magenta"`.** Decisión explícita del usuario para diferenciarse de yellow (asteroides) y cyan (tetris), ya en uso.
- **`cover: "cover-bricks"`.** Clase CSS ya definida en `app/globals.css` sin uso actual, con un patrón de franjas de colores que encaja temáticamente con bloques/breakout. Se reutiliza tal cual, sin crear CSS nuevo — mismo criterio que specs 05 y 07.
- **Registry ya existente (spec 07): no hay refactor que hacer aquí.** A diferencia de spec 07, que tuvo que crear `lib/games/registry.ts` desde cero, esta spec solo agrega una línea a `GAME_REGISTRY`. `jugar-client.tsx` no se toca.

## Riesgos identificados

- La carga asíncrona del spritesheet (`Image.onload`) y de los sonidos puede introducir un frame inicial sin render si el motor no maneja bien el estado "cargando" — el original ya cubre esto pintando el canvas en negro antes de `loadSpritesheet`, se debe preservar ese comportamiento para evitar un flash de canvas vacío.
- Los archivos de audio (`Audio.cloneNode().play()`) pueden ser bloqueados por políticas de autoplay del navegador si no hay interacción previa del usuario; dado que el juego arranca tras el click en "Jugar ahora", debería haber suficiente interacción, pero conviene verificarlo explícitamente en Chrome/Safari durante el paso 6.
- Recalcular el layout de bloques para 800×600 en vez de 640×480 cambia el tamaño/espaciado visual de los bloques respecto al original; si el spritesheet se estira de forma no proporcional podría verse pixelado o deformado — verificar visualmente en el paso 6 y ajustar el escalado de `drawSprite` si hace falta mantener la proporción de los sprites originales.
- `public/games/arkanoid/` es la primera vez que el proyecto sirve assets binarios de un juego portado (Asteroides y Tetris son 100% vectoriales); confirmar que Next.js los sirve correctamente como estáticos sin configuración adicional.
