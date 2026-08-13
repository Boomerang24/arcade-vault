# 07 — Juego: Tetris

**Estado:** Approved
**Depende de:** SPEC 05, SPEC 06
**Fecha:** 2026-08-13

**Objetivo:** Portar el juego standalone `references/started-games/03-tetris/game.js` (canvas HTML5 puro, tablero + hold + next) a un nuevo juego real y jugable "Tetris" dentro de `/juego/tetris/jugar`, con motor multi-canvas, power-ups, audio y skins visuales del original, integrado con el leaderboard real de Supabase y el registry de motores introducido en esta misma spec.

## Alcance

**Incluye:**

- Nueva entrada `tetris` en la tabla `games` de Supabase: `cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetro"` (clase CSS ya existente en `app/globals.css`, sin uso actualmente — se reutiliza tal cual, sin crear CSS nuevo). `title: "TETRIS"`. `short`/`long` redactados por Claude durante `/spec-impl`, mismo tono arcade retro que el resto de `GAMES` (igual criterio que spec 05 con Asteroides). `best: 0`, `plays: "0"` — sin inflar con datos mock, juego recién estrenado.
- Puerto a TypeScript de la lógica completa de `game.js`: tablero 10×20, las 7 piezas estándar + pieza extra "N" (tuerca, índice 8) tal como está en `PIECES` del original, rotación con wall kicks (`tryRotate`), soft drop y hard drop, ghost piece, hold (tecla C/Shift), preview de siguiente pieza, sistema de puntuación clásico (`LINE_SCORES` × nivel × combo, bonus de perfect clear), niveles que suben cada 10 líneas con velocidad de caída creciente, y las 3 mecánicas de power-up (`tint`, `bomb`, `lightning`) con su lógica de aparición cada 8–15 líneas.
- Motor multi-canvas: a diferencia de Asteroides (un solo canvas), Tetris usa 3 — tablero, hold y next — igual que el original. El constructor del motor recibe un objeto de referencias a los 3 canvases en vez de un `HTMLCanvasElement` único (ver "Modelo de datos"); el contrato externo (`pause/resume/reset/forceGameOver/destroy`, `onStats`/`onGameOver`) no cambia respecto al de Asteroides.
- Audio: los efectos de sonido con Web Audio API del original (`playTone`, sonidos de línea, combo, tetris, perfect clear) se portan tal cual, generados internamente por el motor sin depender de assets externos.
- Skins visuales: los 4 skins del original (`retro`, `neon`, `pastel`, `pixelart`) se portan con su selector. El selector vive **dentro** del área del canvas/overlay que dibuja el propio motor — no se agrega ningún control nuevo a `jugar-client.tsx` ni al `player-hud` externo, para no romper el contrato compartido `EngineStats`/`EngineCallbacks`/`GameCanvasProps`.
- **Refactor del registry de motores** (`jugar-client.tsx` todavía tiene `isAsteroides` hardcodeado — Tetris es el segundo juego real, así que este refactor es parte obligatoria del plan de esta spec, no se pospone):
  - Se crea `lib/games/registry.ts` con `GAME_REGISTRY`/`getRegisteredGame` según la forma exacta descrita en `template.md` del skill `add-game`.
  - `jugar-client.tsx` reemplaza `isAsteroides` por `registered = getRegisteredGame(game.id)` en todos los sitios donde hoy rama sobre `isAsteroides` (guard del `setInterval` mock, `togglePause`, `endGame`, `restart`, JSX del canvas), sin cambiar la estructura de esas ramas.
  - `AsteroidesCanvas`/`AsteroidesCanvasHandle`/`EngineStats` dejan de importarse directo en `jugar-client.tsx`; pasan a vivir solo dentro de `lib/games/registry.ts`, que además registra `tetris: { Canvas: TetrisCanvas }`.
- Integración en `app/juego/[id]/jugar/page.tsx` / `components/jugar-client.tsx`, ahora vía el registry: cuando `game.id === "tetris"`, se renderiza `<TetrisCanvas>` en vez del bloque decorativo `.game-arena`, con el mismo flujo de HUD externo, pausa real, fin de partida, modal de guardar puntuación y `saveScore` que ya usa Asteroides.
- Controles: `←`/`→` mover, `↑` o `X` rotar, `↓` soft drop, `Espacio` hard drop, `C`/`Shift` hold, `P`/`Escape` pausa — capturados a nivel `window` con `preventDefault`, igual patrón que `AsteroidesEngine`.

**No incluye (fuera de alcance):**

- Tabla de récords en `localStorage` propia del original (`tetris-highscores`, `tetris-stats`), su pantalla de inicio con récords locales y su formulario de nombre interno al canvas. Se descarta por completo: el leaderboard real ya existe en Supabase (patrón de Asteroides/spec 06) y duplicarlo generaría dos fuentes de verdad. `qualifiesForHighScore`, `insertHighScore`, `renderHighScoreList`, `renderStats` y las claves `HIGHSCORES_KEY`/`STATS_KEY` del original no se portan.
- Toggle de tema claro/oscuro (`theme-toggle`, `body.light-theme`) del original. No encaja con la identidad visual neon retro única que ya tiene toda la plataforma Arcade Vault.
- Pantalla de inicio propia del juego (`start-overlay` con botón "JUGAR" y récords) — el flujo de "empezar partida" ya lo controla `/juego/tetris/jugar` como en el resto del catálogo.
- Menú de pausa expandido del original (submenú "Ver controles", selector de "Nivel inicial" antes de arrancar). La pausa se limita al mismo contrato que Asteroides: `pause()`/`resume()` reales sobre el loop del motor, controlados por el botón PAUSA/REANUDAR ya existente en el `player-hud`.
- Controles táctiles / on-screen para móvil — el original solo soporta teclado; no se agrega nada nuevo (mismo criterio que spec 05).
- Cambios a `asteroides` o a cualquier otro juego del catálogo existente, salvo el refactor mecánico de `jugar-client.tsx` descrito arriba (que no altera su comportamiento observable).
- Ajustes de dificultad, balance o niveles adicionales respecto al `game.js` original.

## Modelo de datos

Se agrega una fila a la tabla `games` de Supabase (esquema sin cambios desde spec 06: `id, title, short, long, cat, cover, color, best, plays`); no se introduce ningún tipo nuevo en `lib/games.ts`.

Se introduce un módulo de motor de juego, ajeno a React, con el **caso multi-canvas** del contrato (ver `template.md` del skill `add-game`):

```ts
// lib/games/tetris/engine.ts
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

export class TetrisEngine {
  constructor(
    canvases: {
      board: HTMLCanvasElement;
      hold: HTMLCanvasElement;
      next: HTMLCanvasElement;
    },
    callbacks: EngineCallbacks,
  );
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, nivel 1, tablero vacío
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

`components/games/tetris-canvas.tsx` envuelve este motor en un componente cliente `forwardRef`, renderizando los 3 `<canvas>` (board/hold/next) y pasando sus referencias al constructor; expone `{ pause, resume, reset, forceGameOver }` vía `useImperativeHandle`, idéntico en forma a `AsteroidesCanvas` salvo por los 3 canvases.

Se introduce además `lib/games/registry.ts` con la forma exacta descrita en `template.md` (`GAME_REGISTRY`, `getRegisteredGame`, tipos `GameEngineHandle`/`GameCanvasProps` reexportando `EngineStats`), registrando ambos juegos reales: `asteroides` y `tetris`.

**Mapeo forzado de `EngineStats.lives`:** Tetris no tiene vidas — es una partida única hasta que el tablero se llena. Se reporta `lives: 1` mientras `state === "playing"` y `lives: 0` al entrar en `"gameover"`. El HUD externo (`♥`) muestra así un solo corazón durante la partida y ninguno al terminar, sin inventar un concepto de vidas que el juego no tiene. `EngineStats.level` sí tiene encaje directo: es el nivel real del motor (sube cada 10 líneas, igual que el original).

## Plan de implementación

1. **Motor del juego.** Crear `lib/games/tetris/engine.ts`: portar el modelo del tablero, las 8 piezas (`PIECES`, incluida la "N"/tuerca), `collide`, `rotateCW`/`tryRotate` con wall kicks, `merge`, `clearLines` con combo y perfect clear, `ghostY`, `hardDrop`/`softDrop`, `lockPiece`, `spawn`, `holdPiece`, el sistema de power-ups (`applyPowerUp`, `pieceBounds`, `collapseColumns`, `clearFullRow`), los 4 skins (`SKIN_PALETTES`, `drawBlock` con sus variantes `neon`/`pastel`/`pixelart`/`retro`) y los sonidos (`playTone` y sus variantes de línea/combo/tetris/perfect-clear) dentro de la clase `TetrisEngine`, preservando constantes (`COLS`, `ROWS`, `BLOCK`, `LINE_SCORES`, `PERFECT_CLEAR_BONUS`, velocidad de caída `max(100, 1000 - (level-1)*90)`). Agregar el canal `onStats`/`onGameOver` con el mapeo de `lives` descrito arriba, y `pause()/resume()/reset()/forceGameOver()/destroy()` con el mismo comportamiento que `AsteroidesEngine`.
2. **Componente canvas multi-vista.** Crear `components/games/tetris-canvas.tsx` (cliente, `forwardRef`): monta los 3 `<canvas>` (board 300×600, hold y next 120×120, igual que `index.html` original) dentro de un layout que encaje en `.crt-screen`, además de un control de skin (`<select>` o botones) dibujado dentro del propio wrapper — no en `jugar-client.tsx`. Instancia `TetrisEngine` en un `useEffect` al montar pasando las 3 refs, expone `pause/resume/reset/forceGameOver` vía `useImperativeHandle`, llama `engine.destroy()` en el cleanup.
3. **Registry de motores (refactor completo, primera vez que se necesita).** Crear `lib/games/registry.ts` con `GAME_REGISTRY`/`getRegisteredGame` según `template.md`, registrando `asteroides` y `tetris`. Modificar `jugar-client.tsx`: reemplazar `isAsteroides` por `registered = getRegisteredGame(game.id)` en el guard del `setInterval` mock, `togglePause`, `endGame`, `restart` y el JSX del canvas; mover los imports de `AsteroidesCanvas`/`AsteroidesCanvasHandle`/`EngineStats` a vivir solo dentro de `registry.ts`; `jugar-client.tsx` pasa a importar `getRegisteredGame`/`GameEngineHandle`/`EngineStats` desde ahí. Verificar manualmente que Asteroides sigue funcionando igual tras el refactor.
4. **Fila `games`.** Insertar la fila `tetris` en Supabase vía `mcp__supabase__apply_migration` (migración `add_game_tetris`) con los valores acordados en el Alcance (`cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetro"`, `best: 0`, `plays: "0"`, `title: "TETRIS"`, `short`/`long` redactados en este paso).
5. **Verificación en navegador.** Recorrer `/` → tarjeta "TETRIS" → `/juego/tetris` (detalle) → "Jugar ahora" → `/juego/tetris/jugar`. Verificar: las piezas caen, rotan con wall kicks, hold funciona, ghost piece se dibuja, líneas se limpian con combo/tetris/perfect-clear reflejados en sonido, power-ups aparecen y aplican su efecto, selector de skin cambia el render sin recargar, HUD interno (score/lines/level) y externo (`player-hud`) están sincronizados en cada frame con el mapeo de `lives` acordado, PAUSA detiene realmente el loop, FIN y llenar el tablero muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN llama `saveScore({ game: "tetris", score, name })` y aparece en `/juego/tetris` y `/salon-de-la-fama`, JUGAR DE NUEVO reinicia el motor, SALIR detiene el loop y remueve listeners sin errores de consola. Confirmar que Asteroides y el resto del catálogo siguen intactos tras el refactor del registry. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `games` en Supabase tiene una fila `tetris` (`cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetro"`, `best: 0`, `plays: "0"`) sin modificar la fila `asteroides`.
- [ ] `/juego/tetris` muestra el detalle del juego igual que cualquier otro (cover, stats, leaderboard, botón "Jugar ahora").
- [ ] `/juego/tetris/jugar` renderiza los 3 canvases (board/hold/next) dentro del `.crt-screen`, controlable con `←`/`→`/`↑`/`X`/`↓`/`Espacio`/`C`/`Shift`/`P`/`Escape`.
- [ ] Rotación con wall kicks, hold, ghost piece, soft/hard drop y limpieza de líneas (incluido combo y perfect clear) funcionan igual que en `game.js`.
- [ ] Los 3 power-ups (`tint`, `bomb`, `lightning`) aparecen periódicamente y aplican su efecto sobre el tablero al fijar la pieza.
- [ ] El selector de skin (retro/neon/pastel/pixel-art), dibujado dentro del propio canvas del juego, cambia el render sin recargar la página.
- [ ] Los efectos de sonido (línea, combo, tetris, perfect clear) suenan en los momentos correspondientes.
- [ ] El HUD interno del canvas (score/lines/level) y el `player-hud` HTML externo (Puntuación/Vidas/Nivel) muestran siempre valores consistentes, con `lives` en `1` mientras se juega y `0` en game over.
- [ ] PAUSA/REANUDAR detiene y reanuda el loop real del motor (las piezas dejan de caer, no solo se oculta con un overlay).
- [ ] El botón FIN termina la partida de inmediato y dispara overlay interno + modal externo con la misma puntuación final.
- [ ] Llenar el tablero jugando normalmente produce el mismo resultado que el botón FIN.
- [ ] GUARDAR PUNTUACIÓN llama a `saveScore({ game: "tetris", score, name })` y la puntuación aparece luego en `/salon-de-la-fama` para ese juego.
- [ ] JUGAR DE NUEVO reinicia el motor (score 0, nivel 1, tablero vacío) y cierra el modal externo.
- [ ] SALIR navega a `/juego/tetris` sin dejar el loop de `requestAnimationFrame` corriendo en segundo plano ni listeners de teclado huérfanos.
- [ ] `lib/games/registry.ts` existe con `GAME_REGISTRY` registrando `asteroides` y `tetris`; `jugar-client.tsx` ya no tiene la constante `isAsteroides`.
- [ ] Asteroides sigue funcionando exactamente igual que antes del refactor del registry (mismo comportamiento de HUD, pausa, fin de partida y guardado de puntuación).
- [ ] Los demás juegos del catálogo (no registrados) siguen usando la simulación visual existente sin cambios de comportamiento.
- [ ] `npm run build` completa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Motor multi-canvas** (`{ board, hold, next }` en vez de un solo `HTMLCanvasElement`), siguiendo el caso "multi-canvas" ya previsto en `template.md` del skill `add-game`. Decisión explícita del usuario: el contrato externo (`pause/resume/reset/forceGameOver/destroy`, `onStats`/`onGameOver`) no cambia, solo el primer argumento del constructor.
- **`EngineStats.lives` mapeado a `1`/`0` (jugando/game over)**, en vez de reutilizar ese campo para el combo. Decisión explícita del usuario: mantiene el label "Vidas" del HUD externo semánticamente honesto (un corazón mientras la partida sigue viva) en vez de forzar un significado distinto sobre un campo que el contrato fijo no permite renombrar ni extender.
- **`EngineStats.level` sin mapeo forzado**: se reporta el nivel real del motor de Tetris, que encaja 1:1 con lo que el contrato espera.
- **Power-ups, audio y skins visuales SÍ se portan** en esta primera versión, en vez de recortarlos a un Tetris base. Decisión explícita del usuario: se prioriza portar la experiencia completa del original.
- **Sin tabla de récords en `localStorage`**: se descarta por completo a favor del leaderboard real de Supabase ya existente (mismo patrón que Asteroides). Decisión explícita del usuario — evita mantener dos fuentes de verdad de puntuaciones para el mismo juego.
- **Sin toggle de tema claro/oscuro**: no encaja con la identidad visual única de Arcade Vault. Decisión explícita del usuario.
- **Selector de skin dentro del propio canvas/overlay del motor**, no como control nuevo en `jugar-client.tsx`. Decisión explícita del usuario: preserva el contrato `EngineStats`/`EngineCallbacks`/`GameCanvasProps` sin extenderlo ni agregar ramas específicas de Tetris al componente compartido.
- **Refactor del registry (`lib/games/registry.ts`) incluido como paso 3 de esta spec**, en vez de posponerlo a una spec separada. Tal como anticipa el skill `add-game`: Tetris es el segundo juego real y este es el disparador natural para eliminar el `isAsteroides` hardcodeado de `jugar-client.tsx` antes de que se acumulen más ramas condicionales.
- **`cover: "cover-tetro"` reutilizada** en vez de una clase CSS nueva. Ya existe en `app/globals.css`, nombrada literalmente para tetris y sin uso actual — cero CSS nuevo.
- **`title`/`short`/`long` no se fijan textualmente en la spec** (salvo `title: "TETRIS"`, confirmado por el usuario): `short`/`long` se redactan durante `/spec-impl` siguiendo el tono del resto de `GAMES`, mismo criterio que spec 05 con Asteroides.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                               | Mitigación                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor multi-canvas es sustancialmente más complejo que el de Asteroides (power-ups, wall kicks, hold, 4 skins, audio) — mayor superficie para bugs de porting.                                                    | El plan de implementación (paso 1) enumera explícitamente cada subsistema a portar desde `game.js`; la verificación (paso 5) incluye cada mecánica por separado en vez de un smoke test genérico. |
| El refactor del registry toca `jugar-client.tsx`, que ya tiene lógica de HUD/pausa/fin de partida en producción para Asteroides — un error ahí rompe un juego que ya funciona.                                       | El paso 3 exige verificar manualmente que Asteroides sigue funcionando igual después del refactor, antes de dar la spec por completa.                                                             |
| Captura global de teclado (`preventDefault` en flechas/espacio/C/Shift) puede interferir con el input de nombre del modal externo de fin de partida, igual que el riesgo ya identificado en spec 05 para Asteroides. | Mismo patrón de mitigación que spec 05: el motor se pausa (o ya está en `"gameover"`, donde el loop no consume input de juego) mientras el modal externo está abierto.                            |
| `requestAnimationFrame` corriendo en segundo plano si `destroy()` no cancela correctamente el loop, ahora con 3 canvases en vez de uno.                                                                              | Mismo requisito explícito que spec 05: `destroy()` debe cancelar el frame y remover todos los listeners en el cleanup del `useEffect`, verificado en el paso 5.                                   |
