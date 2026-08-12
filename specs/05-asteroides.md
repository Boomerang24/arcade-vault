# 05 — Juego: Asteroides

**Estado:** Approved
**Depende de:** SPEC 01
**Fecha:** 2026-08-12

**Objetivo:** Portar el juego standalone `references/started-games/02-asteroids/game.js` (canvas HTML5 puro) a un nuevo juego real y jugable "Asteroides" dentro de `/juego/asteroides/jugar`, integrado con el HUD, la pausa y el flujo de fin de partida ya existentes en la plataforma.

## Alcance

**Incluye:**

- Nueva entrada `asteroides` en `lib/data.ts` (`GAMES`), independiente de la entrada existente `rocas` (que no se toca): `cat: "SHOOTER"`, `color: "yellow"`, `cover: "cover-rocas"` (se reutiliza el mismo estilo de portada, sin crear una clase CSS nueva). Título y textos (`title`, `short`, `long`) y valores mock de `best`/`plays` propuestos por Claude en la implementación, siguiendo el tono del resto de `GAMES`.
- Puerto a TypeScript de la lógica completa de `game.js` (nave, asteroides, balas, partículas, wrap toroidal, colisiones, niveles, 3 vidas con invencibilidad al reaparecer) en un módulo de motor de juego independiente del framework, sin cambios de balance/físicas respecto al original.
- Visual idéntico al original: trazos blancos sobre fondo negro, sin restyle a la paleta neón de Arcade Vault.
- Sin power-ups ni asteroides especiales tipo "estrella fugaz": el `README.md` del juego original los menciona pero **no están implementados en `game.js`**; este spec solo porta lo que el código realmente hace.
- Integración con `app/juego/[id]/jugar/page.tsx` **solo quando `game.id === "asteroides"`**:
  - Se reemplaza la escena decorativa (`.game-arena` con naves/enemigos CSS) por el canvas real de 800×600, escalado dentro del `.crt-screen` existente (mismo aspect-ratio 4/3).
  - El motor conserva su propio HUD dibujado dentro del canvas (score/nivel/vidas en monospace blanco, igual que el original) **y además** notifica a React en cada frame para mantener sincronizado el `player-hud` HTML externo (Jugador/Puntuación/Vidas/Nivel) que ya existe en la página. Ambos HUD conviven mostrando siempre los mismos valores.
  - El botón **PAUSA/REANUDAR** del `player-hud` controla la pausa real del motor (detiene/reanuda su loop de actualización e input), no solo un overlay visual.
  - El botón **FIN** termina la partida inmediatamente (equivalente a perder la última vida).
  - Al llegar a 0 vidas (por juego normal o por FIN), el motor entra en su estado interno `gameover` (overlay "GAME OVER" dentro del canvas, igual que el original) **y simultáneamente** se abre el modal externo existente (nombre + GUARDAR PUNTUACIÓN + JUGAR DE NUEVO), con la misma puntuación final en ambos.
  - **GUARDAR PUNTUACIÓN** llama a `saveScore({ game: "asteroides", score, name })`, igual que los demás juegos.
  - **JUGAR DE NUEVO** reinicia el motor real (nueva partida desde cero) y cierra el modal.
  - **SALIR** navega a `/juego/asteroides` y detiene el loop del juego (cancela el `requestAnimationFrame` y remueve los listeners de teclado).
  - Captura de teclado (`ArrowLeft/Right/Up`, `Space`) a nivel `window` mientras la página `/jugar` esté montada, igual que el original (con `preventDefault` para evitar scroll), sin requerir foco en el canvas.
- Los demás juegos del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `rana`, `duelo-pixel`) **no cambian**: siguen usando la simulación visual de puntuación existente en `/jugar`.

**No incluye (fuera de alcance):**

- Power-ups y asteroides especiales ("estrella fugaz") — no existen en `game.js` fuente.
- Restyle visual del juego a la paleta neón (cyan/magenta/yellow) de Arcade Vault — se mantiene blanco/negro original.
- Controles táctiles / on-screen para móvil — el original solo soporta teclado; no se agrega nada nuevo.
- Cambios a la entrada `rocas` existente o a cualquier otro juego del catálogo.
- Persistencia de replays, historial de partidas más allá de `saveScore`, o cambios al modelo `ScoreEntry`/`localStorage` (`av_scores`) definido en spec 01.
- Ajustes de dificultad, balance o niveles adicionales respecto al `game.js` original.

## Modelo de datos

No se introducen tipos nuevos en `lib/data.ts` (se reutiliza el tipo `Game` existente); solo se agrega un elemento al arreglo `GAMES`.

Se introduce un módulo de motor de juego, ajeno a React, con esta forma conceptual:

```ts
// lib/games/asteroides/engine.ts
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

export class AsteroidesEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, 3 vidas, nivel 1
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

`components/games/asteroides-canvas.tsx` envuelve este motor en un componente cliente con `forwardRef`, exponiendo `{ pause, resume, reset, forceGameOver }` vía `useImperativeHandle` para que `app/juego/[id]/jugar/page.tsx` los invoque desde los botones del `player-hud`.

## Plan de implementación

1. **Dato del juego.** Agregar la entrada `asteroides` a `GAMES` en `lib/data.ts` (`cat: "SHOOTER"`, `color: "yellow"`, `cover: "cover-rocas"`, textos y `best`/`plays` mock coherentes con el resto del catálogo).
2. **Motor del juego.** Crear `lib/games/asteroides/engine.ts`: portar `Bullet`, `Asteroid` (incluidas las formas fijas de asteroide grande), `Ship`, `Particle` y el estado (`score`, `lives`, `level`, `state`, `deadTimer`) de `game.js` a TypeScript dentro de la clase `AsteroidesEngine`, preservando constantes de física (velocidades, `THRUST`, `DRAG`, `ROT`, cooldowns, radios, puntos por tamaño) y el wrap toroidal 800×600. Agregar el canal de notificación: tras cada `update(dt)` se invoca `onStats`; al transicionar a `state === "gameover"` se invoca `onGameOver` una única vez. Agregar `pause()/resume()` (detienen/reanudan el `requestAnimationFrame` e ignoran input mientras están en pausa), `reset()` (reinvoca la inicialización interna del juego) y `forceGameOver()` (fuerza `lives = 0` y dispara el mismo camino que perder la última vida).
3. **Componente canvas.** Crear `components/games/asteroides-canvas.tsx` (cliente, `forwardRef`): monta un `<canvas width={800} height={600}>` posicionado a pantalla completa dentro de su contenedor (igual que `.game-arena` actual), instancia `AsteroidesEngine` en un `useEffect` al montar, expone `pause/resume/reset/forceGameOver` vía `useImperativeHandle`, y llama `engine.destroy()` en el cleanup del efecto.
4. **Integración en `/jugar`.** Modificar `app/juego/[id]/jugar/page.tsx`: si `game.id === "asteroides"`, renderizar `<AsteroidesCanvas ref={engineRef} onStats={...} onGameOver={...} />` en vez del bloque `.game-arena` decorativo, y:
   - sincronizar `score`, `lives`, `level` del `player-hud` desde `onStats`;
   - `onGameOver(finalScore)` fija `over = true` con esa puntuación y **pausa el motor** (para que teclas como Espacio al escribir las iniciales en el input del modal no reinicien la partida detrás del modal);
   - el botón PAUSA/REANUDAR llama `engineRef.pause()` / `engineRef.resume()`;
   - el botón FIN llama `engineRef.forceGameOver()`;
   - JUGAR DE NUEVO llama `engineRef.reset()` además de limpiar `over`/`saved` locales;
   - para cualquier otro `game.id`, el comportamiento existente (simulación por `setInterval`) no cambia.
5. **Revisión final.** En el navegador: recorrer `/` → tarjeta "Asteroides" → `/juego/asteroides` (detalle) → "Jugar ahora" → `/juego/asteroides/jugar`. Verificar: nave rota/propulsa/dispara con teclado, asteroides se parten por tamaño, HUD interno y externo coinciden en todo momento, PAUSA detiene realmente el juego, FIN y perder las 3 vidas muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN persiste en `av_scores`, JUGAR DE NUEVO arranca una partida nueva, SALIR detiene el loop sin errores de consola. Confirmar que `rocas` y el resto del catálogo siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `lib/data.ts` tiene una entrada `asteroides` (`cat: "SHOOTER"`, `color: "yellow"`, `cover: "cover-rocas"`) sin modificar la entrada `rocas`.
- [ ] `/juego/asteroides` muestra el detalle del juego igual que cualquier otro (cover, stats, leaderboard, botón "Jugar ahora").
- [ ] `/juego/asteroides/jugar` renderiza el canvas real de 800×600 dentro del `.crt-screen`, controlable con `←`/`→`/`↑`/`Espacio`.
- [ ] El HUD interno del canvas (score/nivel/vidas) y el `player-hud` HTML externo muestran siempre los mismos valores, sincronizados en tiempo real.
- [ ] PAUSA/REANUDAR detiene y reanuda el loop real del juego (la nave y los asteroides dejan de moverse, no solo se oculta con un overlay).
- [ ] El botón FIN termina la partida de inmediato y dispara tanto el overlay interno "GAME OVER" como el modal externo, con la misma puntuación final.
- [ ] Perder las 3 vidas jugando normalmente produce el mismo resultado que el botón FIN (overlay interno + modal externo con puntuación final coincidente).
- [ ] GUARDAR PUNTUACIÓN llama a `saveScore({ game: "asteroides", score, name })` y la puntuación aparece luego en `/salon-de-la-fama` para ese juego.
- [ ] JUGAR DE NUEVO reinicia el motor (score 0, 3 vidas, nivel 1) y cierra el modal externo.
- [ ] SALIR navega a `/juego/asteroides` sin dejar el loop de `requestAnimationFrame` corriendo en segundo plano ni listeners de teclado huérfanos.
- [ ] Los demás juegos del catálogo (incluido `rocas`) siguen usando la simulación visual existente sin cambios de comportamiento.
- [ ] `npm run build` completa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Nueva entrada `asteroides` independiente de `rocas`**, aunque ambas comparten temática. Decisión explícita del usuario: `rocas` sigue siendo la tarjeta simulada existente; `asteroides` es el juego nuevo y real. No se fusionan ni se elimina `rocas`.
- **Ambos HUD conviven** (el interno del canvas y el `player-hud` externo), en vez de ocultar uno de los dos. Decisión explícita del usuario: el motor mantiene su propio canvas, controles y HUD tal como en el original, y adicionalmente notifica a React.
- **Visual blanco/negro original sin restyle neón.** Decisión explícita del usuario: se prioriza portar el juego tal cual, no reinterpretarlo visualmente.
- **Ambos flujos de fin de partida conviven** (overlay interno "GAME OVER" + modal externo), en vez de eliminar el comportamiento interno. Decisión explícita del usuario.
- **El motor se pausa automáticamente al abrirse el modal de fin de partida.** Decisión técnica para evitar un conflicto real: el listener de teclado del motor original captura `Space` a nivel `window` sin revisar el elemento con foco: si el usuario escribe sus iniciales en el input del modal y usa la barra espaciadora, sin esta pausa el motor reiniciaría la partida detrás del modal (`state` original vuelve a `"playing"` con `Space` estando en `"gameover"`). Pausar el motor al mostrar el modal evita ese reinicio accidental sin cambiar el comportamiento visible que el usuario pidió mantener.
- **Motor como módulo TypeScript independiente de React** (`lib/games/asteroides/engine.ts`) en vez de lógica inline en el componente. Permite portar `game.js` casi 1:1 (misma estructura de clases y loop) y probarlo/ajustarlo sin acoplarlo a React; el componente `AsteroidesCanvas` es solo un puente delgado (ref imperativo + callbacks).
- **`cover: "cover-rocas"` reutilizada** en vez de una clase CSS nueva (`cover-asteroides`). Ambos juegos comparten la misma temática visual (asteroides/nave), evita duplicar CSS casi idéntico.
- **Sin power-ups ni "estrella fugaz".** El `README.md` original los menciona pero no están implementados en `game.js`; se porta el código real, no la documentación aspiracional.
- **Captura de teclado global (`window`) mientras `/jugar` está montado**, igual que el original, en vez de requerir foco en el canvas. Mantiene la sensación exacta del juego original; el listener se remueve al desmontar (`SALIR`, navegación, cierre de pestaña vía cleanup del efecto).

## Riesgos identificados

- **Captura global de teclado (`preventDefault` en flechas/espacio) puede interferir con otros elementos interactivos de la página** si quedan montados simultáneamente (p. ej. el input de iniciales del modal). Mitigado por la pausa automática del motor al abrir el modal (ver decisión arriba) y porque los listeners solo existen mientras el componente del canvas está montado.
- **Loop de `requestAnimationFrame` corriendo en pestañas en segundo plano o tras navegación rápida** podría seguir consumiendo CPU si el cleanup no cancela correctamente el frame. Mitigado exigiendo explícitamente en el plan (paso 3) que `destroy()` cancele el `requestAnimationFrame` y remueva los listeners en el cleanup del `useEffect`.
- **Physics/timing dependientes de `dt` variable** (igual que el original, que ya clampa `dt` a 0.05s máx.) podrían comportarse distinto bajo carga; se acepta el mismo comportamiento que el juego original, sin cambios de balance.
