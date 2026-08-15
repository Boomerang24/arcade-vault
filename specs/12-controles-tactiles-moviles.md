# 12 — Controles táctiles para móvil

**Estado:** Approved
**Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
**Fecha:** 2026-08-15

**Objetivo:** Agregar controles táctiles en pantalla (D-pad direccional + hasta 2 botones de acción), escalado responsive del canvas, y una barra de pie minimalista (PAUSA + skin) que reemplaza al `player-hud` completo en dispositivos móviles con pantalla táctil, para que los cuatro juegos del catálogo (`asteroides`, `tetris`, `arkanoid`, `snake`) sean jugables en el celular. Los controles en sí no requieren modificar los motores (usan `KeyboardEvent` sintéticos); la única modificación de motor es agregar HUD en vivo (score/nivel/vidas) al canvas de `arkanoid` y `snake`, que hoy no lo dibujan, para que las estadísticas sigan siendo visibles al ocultar el `player-hud` en móvil.

## Alcance

**Incluye:**

- Un componente compartido `components/games/touch-controls.tsx` que renderiza un D-pad (↑/↓/←/→) y un grupo de hasta 2 botones de acción, montado en `/juego/[id]/jugar` **debajo** del `.crt` (canvas arriba, control abajo — igual disposición que la captura de referencia adjuntada por el usuario).
- El D-pad y los botones de acción **no llaman a métodos nuevos del motor**: en `touchstart`/`mousedown` disparan un `KeyboardEvent("keydown", { code })` real sobre `window`, y en `touchend`/`mouseup`/`touchcancel` disparan `KeyboardEvent("keyup", { code })`, con el mismo `code` (`"ArrowUp"`, `"ArrowDown"`, `"ArrowLeft"`, `"ArrowRight"`, `"Space"`) que ya escuchan los cuatro motores. Para el manejo de input, los cuatro `engine.ts` **no se modifican** — siguen recibiendo eventos de teclado indistinguibles de una pulsación física. (`arkanoid` y `snake` sí reciben un cambio de renderizado ajeno al input, ver más abajo.)
- Mapeo de botones de acción por juego, definido en `lib/games/registry.ts` (nuevo campo opcional `touchActions` por juego registrado, ver Modelo de datos):
  - `asteroides`: 1 botón de acción — "DISPARAR" (`Space`). D-pad: ↑ empuje, ←/→ rotación. ↓ no mapea a ningún `code` (el motor no lo usa).
  - `tetris`: 1 botón de acción — "CAER" (`Space`, hard drop). D-pad: ← mover izquierda, → mover derecha, ↓ soft drop, ↑ rotar.
  - `arkanoid`: 0 botones de acción (la pelota se lanza sola, no hay tecla de disparo). D-pad: solo ←/→ mueven la pala; ↑/↓ no mapean a ningún `code`.
  - `snake`: 0 botones de acción. D-pad: las 4 flechas cambian de dirección.
- Repetición mientras se mantiene presionado: como `touchstart`/`mousedown` dispara un único `keydown` sintético (sin el auto-repeat nativo del sistema operativo que sí ocurre al mantener una tecla física), el componente simula ese auto-repeat con un `setInterval` interno (arranca a los 300ms de mantener presionado, repite cada 80ms) que vuelve a disparar el mismo `keydown` mientras el dedo/botón siga abajo, y se limpia en `touchend`/`mouseup`/`touchcancel`/`pointerleave`. Esto iguala el comportamiento a mantener presionada la tecla física en los cuatro juegos (movimiento continuo en Asteroides/Arkanoid/Snake, repetición de movimiento lateral en Tetris).
- Visibilidad condicional: los controles táctiles solo se muestran cuando el dispositivo lo amerita, vía CSS `@media (pointer: coarse)` (mismo criterio que usan los navegadores para distinguir touch de mouse+teclado) — en desktop con mouse/teclado el bloque permanece oculto (`display: none`) y el teclado físico sigue funcionando igual que hoy en todos los dispositivos, tengan o no el bloque táctil visible.
- Canvas responsive: en los cuatro `*-canvas.tsx` (`AsteroidesCanvas`, `TetrisCanvas` — multi-canvas, ver nota abajo —, `ArkanoidCanvas`, `SnakeCanvas`) y en `.crt-screen`/`canvas` de `app/globals.css`, el `<canvas>` mantiene su resolución lógica interna (`width`/`height` HTML actuales, 800×600 o los que corresponda a Tetris) pero se le agrega `max-width: 100%; height: auto;` vía CSS para que se reescale visualmente dentro de `.crt-screen` (que ya tiene `aspect-ratio: 4/3` en `app/globals.css:625`) sin desbordar el viewport ni requerir zoom/scroll horizontal en pantallas angostas. Tetris usa múltiples canvases superpuestos (tablero + siguiente pieza) — ambos escalan con la misma regla CSS, conservando su posicionamiento relativo actual.
- **`player-hud` se oculta por completo en táctil.** Bajo `@media (pointer: coarse)`, el `player-hud` actual (Jugador/Puntuación/Vidas/Nivel + botones PAUSA/FIN/SALIR + selector de skin) se oculta (`display: none`) y se reemplaza por una barra de pie nueva y minimalista, `components/games/mobile-footer.tsx`, con solo dos elementos: el botón PAUSA/REANUDAR y (cuando el juego tiene skins registrados) el selector de skin. Orden vertical final en móvil: canvas (`.crt`) → `MobileFooter` (PAUSA + skin) → `TouchControls` (D-pad + acciones). En desktop (sin `pointer: coarse`) no cambia nada: se sigue viendo el `player-hud` completo de siempre, arriba del canvas, tal como hoy.
- **FIN y SALIR no tienen botón directo en móvil.** Sin esos botones a la vista, terminar la partida ocurre de forma natural (game over del motor) o mediante pausa: al presionar PAUSA en móvil, el overlay "EN PAUSA" (ya existente en `jugar-client.tsx`) gana un botón `SALIR` (navega a `/juego/[id]`, mismo destino que el SALIR de desktop) — así el jugador nunca queda sin forma de abandonar la partida. El modal de fin de partida (`GUARDAR PUNTUACIÓN` / `JUGAR DE NUEVO` / `VOLVER AL VAULT` / `VER LEADERBOARD`) no cambia, ya es el mismo en cualquier dispositivo y no depende del `player-hud`.
- **Stats (score/vidas/nivel) se ven solo en el HUD interno del propio canvas en móvil.** `AsteroidesEngine` y `TetrisEngine` ya dibujan su HUD en vivo (score/nivel, y vidas en Asteroides) directamente sobre el canvas — no requieren cambios. `ArkanoidEngine` y `SnakeEngine` hoy **no** dibujan HUD en vivo (solo muestran el score final en el overlay de game over) — se les agrega un `drawHUD()` análogo al de `AsteroidesEngine` (score/nivel arriba, vidas como texto `VIDAS: N` en vez de iconos —más descriptivo—, mismo estilo tipográfico `p.hud`/`applySkinGlow`), dibujado en cada frame igual que los otros dos motores. Esto es una adición de renderizado, no un cambio de mecánica ni de `EngineStats` — se dibuja siempre (los 4 motores quedan consistentes entre sí), aunque solo sea indispensable en móvil.

**No incluye (fuera de alcance):**

- Gestos de swipe o joystick virtual arrastrable — el usuario decidió explícitamente D-pad + botones fijos en vez de gestos, según la captura de referencia.
- Vibración háptica (`navigator.vibrate`) al presionar los controles — no se pidió, se puede añadir en una spec futura.
- Detección de orientación (portrait/landscape) o bloqueo de orientación — el escalado responsive del canvas cubre ambas orientaciones sin lógica adicional.
- Cambios a `EngineStats`, a la mecánica de ningún juego, o a `GAME_REGISTRY` más allá del nuevo campo `touchActions` (no se agregan ni quitan juegos).
- Soporte táctil para el selector de skins (`<select>` de spec 11) — los `<select>` nativos ya son utilizables por defecto en móvil, sin cambios.
- Página de inicio, biblioteca, detalle de juego u otras rutas fuera de `/juego/[id]/jugar` — esta spec es exclusiva de la pantalla de juego.

## Modelo de datos

No se introduce ninguna tabla ni fila nueva en Supabase. Se extiende el tipo `RegisteredGame` (u homólogo) de `lib/games/registry.ts` con un campo opcional para declarar los botones de acción táctiles de cada juego, sin tocar `EngineStats`, `GameEngineHandle` ni `GameCanvasProps`:

```ts
// lib/games/registry.ts
export type TouchAction = {
  code: "Space"; // por ahora el único code de acción usado en el catálogo
  label: string; // texto corto del botón, p.ej. "DISPARAR", "CAER"
};

export type RegisteredGame = {
  Canvas: /* tipo existente */;
  skins?: /* tipo existente de spec 11 */;
  touchActions?: TouchAction[]; // 0, 1 o 2 botones de acción; ausente/[] = solo D-pad
};
```

```tsx
// components/games/touch-controls.tsx
"use client";
export type TouchControlsProps = {
  actions: { code: "Space"; label: string }[]; // desde registered.touchActions ?? []
  directions?: {
    up?: boolean;
    down?: boolean;
    left?: boolean;
    right?: boolean;
  }; // qué flechas del D-pad son relevantes para este juego (todas true por defecto); las irrelevantes se deshabilitan visualmente pero no se ocultan, para mantener el D-pad como bloque fijo de 4 flechas
};
export function TouchControls({ actions, directions }: TouchControlsProps) {
  // dispara KeyboardEvent("keydown"/"keyup", { code }) sobre window
  // por cada botón del D-pad y cada acción, con el repeat descrito en Alcance
}
```

`asteroides: { Canvas: AsteroidesCanvas, touchActions: [{ code: "Space", label: "DISPARAR" }] }`, `tetris: { Canvas: TetrisCanvas, touchActions: [{ code: "Space", label: "CAER" }] }`, `arkanoid: { Canvas: ArkanoidCanvas }`, `snake: { Canvas: SnakeCanvas }` en `GAME_REGISTRY`.

```tsx
// components/games/mobile-footer.tsx
"use client";
export type MobileFooterProps = {
  paused: boolean;
  onTogglePause: () => void;
  skins?: { id: string; label: string }[]; // registered.skins, si el juego tiene
  skin?: string;
  onSkinChange?: (id: string) => void;
};
export function MobileFooter(props: MobileFooterProps) {
  // botón PAUSA/REANUDAR + <select> de skin (si skins.length), visible solo bajo pointer: coarse
}
```

No se introduce ningún campo nuevo en `EngineStats`. El overlay "EN PAUSA" existente en `jugar-client.tsx` gana un botón `SALIR` visible solo bajo `pointer: coarse` (reutiliza el mismo `router.push` que el `SALIR` de `player-hud` en desktop).

## Plan de implementación

1. **Tipo y registro.** Agregar `TouchAction`/`touchActions?` a `RegisteredGame` en `lib/games/registry.ts` y poblar `touchActions` en las cuatro entradas de `GAME_REGISTRY` según el mapeo del Alcance. Verificación: `npm run build` sin errores de tipos, `getRegisteredGame("asteroides").touchActions` devuelve el array esperado.
2. **Componente `TouchControls`.** Crear `components/games/touch-controls.tsx`: D-pad de 4 flechas + hasta 2 botones de acción, cada botón dispara `keydown`/`keyup` sintéticos sobre `window` con el `code` correspondiente en `touchstart`/`mousedown` y `touchend`/`mouseup`/`touchcancel`/`pointerleave`, con el repeat de 300ms/80ms descrito en Alcance. Usa clases `.btn`/tokens CSS existentes (`--cyan`, `--pixel`, etc.), sin introducir una paleta nueva. Verificación aislada: en una página de prueba temporal o mediante Playwright, simular `touchstart` en el botón ↑ y confirmar que `window` recibe un evento `keydown` con `code: "ArrowUp"`.
3. **HUD en vivo para Arkanoid y Snake.** Agregar `drawHUD()` a `lib/games/arkanoid/engine.ts` y `lib/games/snake/engine.ts` (score/nivel en texto, vidas como texto `VIDAS: N` —se prefirió texto sobre iconos por ser más descriptivo y preciso que contar íconos—), llamado en cada frame igual que `AsteroidesEngine.drawHUD()` (`lib/games/asteroides/engine.ts:507`). Mismo estilo tipográfico y de glow que el resto (`p.hud`, `applySkinGlow`). Verificación: partida jugable de Arkanoid y Snake muestra score/nivel/vidas actualizándose en vivo sobre el canvas, sin regresión en el resto del render.
4. **`MobileFooter` y overlay de pausa.** Crear `components/games/mobile-footer.tsx` con la forma de Modelo de datos. En `jugar-client.tsx`: ocultar `player-hud` bajo `@media (pointer: coarse)`, renderizar `MobileFooter` (visible solo bajo esa misma media query) entre `.crt` y `TouchControls`, y agregar el botón `SALIR` al overlay "EN PAUSA" (visible solo bajo `pointer: coarse`, ya que en desktop SALIR sigue estando en `player-hud`). Verificación: en desktop no cambia nada visualmente; en simulación táctil, `player-hud` desaparece, aparece la barra PAUSA+skin, y pausar muestra el botón SALIR en el overlay.
5. **`TouchControls`.** Crear `components/games/touch-controls.tsx`: D-pad de 4 flechas + hasta 2 botones de acción, cada botón dispara `keydown`/`keyup` sintéticos sobre `window` con el `code` correspondiente en `touchstart`/`mousedown` y `touchend`/`mouseup`/`touchcancel`/`pointerleave`, con el repeat de 300ms/80ms descrito en Alcance. Usa clases `.btn`/tokens CSS existentes (`--cyan`, `--pixel`, etc.), sin introducir una paleta nueva. Verificación aislada: en una página de prueba temporal o mediante Playwright, simular `touchstart` en el botón ↑ y confirmar que `window` recibe un evento `keydown` con `code: "ArrowUp"`.
6. **Integración final en `jugar-client.tsx`.** Renderizar `<TouchControls actions={registered?.touchActions ?? []} />` debajo de `MobileFooter`, visible solo bajo `@media (pointer: coarse)` (p.ej. `.touch-controls { display: none; } @media (pointer: coarse) { .touch-controls { display: flex; } }`). Solo se renderiza cuando `registered` existe; el bloque decorativo sin motor no lo necesita. Orden final en móvil: `.crt` → `MobileFooter` → `TouchControls`. Verificación: en desktop (mouse) ni `MobileFooter` ni `TouchControls` aparecen (se ve el `player-hud` de siempre); en simulación táctil aparecen ambos, en ese orden, debajo del canvas.
7. **Canvas responsive.** Agregar `max-width: 100%; height: auto;` al selector `canvas` dentro de `.crt-screen` en `app/globals.css`. Verificación: en un viewport de 375px de ancho (iPhone SE en DevTools), el canvas de cada uno de los 4 juegos se ve completo sin scroll horizontal ni recorte, y el `aspect-ratio: 4/3` ya existente en `.crt-screen` se respeta.
8. **Verificación en navegador (los 4 juegos).** Con DevTools en modo touch-simulation (o dispositivo real) en un viewport móvil (375×667 aprox.): para cada uno de `asteroides`, `tetris`, `arkanoid`, `snake` — el D-pad mueve/rota/gira igual que las flechas de teclado, el botón de acción (cuando aplica) dispara la misma acción que `Space`, mantener presionado repite la acción, `player-hud` está oculto y `MobileFooter` (PAUSA + skin) funciona, PAUSA muestra el overlay con SALIR operativo, el HUD interno del canvas muestra score/vidas/nivel en los 4 juegos, GUARDAR PUNTUACIÓN sigue funcionando en el modal de fin de partida, y en desktop (sin touch) todo se ve exactamente igual que antes de esta spec (`player-hud` completo, sin `MobileFooter`/`TouchControls`, sin SALIR extra en pausa). Confirmar `npm run build` sin errores.

## Criterios de aceptación

- [ ] En un viewport táctil (`pointer: coarse`), `/juego/asteroides/jugar`, `/juego/tetris/jugar`, `/juego/arkanoid/jugar` y `/juego/snake/jugar` muestran el D-pad debajo del canvas, con los botones de acción que correspondan a cada juego según el mapeo del Alcance.
- [ ] En desktop con mouse (sin `pointer: coarse`), el bloque de controles táctiles no se renderiza visualmente y el teclado físico controla los 4 juegos exactamente igual que antes de esta spec.
- [ ] Presionar cada flecha del D-pad produce el mismo efecto en el motor que presionar la tecla de flecha física correspondiente, para los 4 juegos.
- [ ] Presionar el botón de acción de Asteroides dispara un disparo; el de Tetris ejecuta un hard drop; Arkanoid y Snake no muestran botón de acción (no lo necesitan).
- [ ] Mantener presionado un botón del D-pad repite la acción mientras se mantiene, sin necesidad de soltar y volver a tocar.
- [ ] El canvas de los 4 juegos se reescala para caber sin scroll horizontal ni recorte en un viewport de 375px de ancho, manteniendo proporción 4:3 (o la de Tetris si aplica).
- [ ] Los 4 motores siguen recibiendo únicamente `KeyboardEvent` para el input (sin nuevos métodos públicos en `GameEngineHandle`); `arkanoid` y `snake` ganan un `drawHUD()` de solo renderizado, sin cambios de mecánica ni de `EngineStats`.
- [ ] En viewport táctil, `player-hud` está completamente oculto y en su lugar se ve `MobileFooter` (botón PAUSA/REANUDAR + selector de skin si el juego tiene) debajo del canvas.
- [ ] En viewport táctil, el HUD interno del canvas (score/vidas/nivel) es visible y se actualiza en vivo en los 4 juegos, incluidos Arkanoid y Snake.
- [ ] En viewport táctil, pausar muestra el overlay "EN PAUSA" con un botón SALIR que navega a `/juego/[id]`.
- [ ] En desktop (sin `pointer: coarse`), `player-hud` completo (Jugador/Puntuación/Vidas/Nivel/PAUSA/FIN/SALIR/skin) se ve exactamente igual que antes de esta spec, sin `MobileFooter` ni botón SALIR adicional en el overlay de pausa.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Controles sintéticos vía `KeyboardEvent` sobre `window`, en vez de nuevos métodos en cada motor.** Decisión de diseño para cumplir la regla del proyecto de "no agregar branches por juego a componentes compartidos" (CLAUDE.md) y evitar tocar los 4 `engine.ts`: como los motores ya escuchan `keydown`/`keyup` a nivel `window`, un evento sintético con el mismo `code` es indistinguible de una tecla física para el motor. Se descartó exponer `pressDirection()`/`pressAction()` en `GameEngineHandle` porque hubiera requerido modificar los 4 motores y el contrato compartido, para un beneficio equivalente.
- **D-pad + hasta 2 botones fijos, sin gestos de swipe ni joystick virtual.** Decisión explícita del usuario en base a una captura de referencia: controles on-screen simulando un control físico, no gestos. Swipe se descartó por requerir detección de gesto por juego (más compleja y menos predecible que botones fijos) y porque el usuario ya indicó la preferencia con la imagen.
- **Máximo 2 botones de acción por juego, reutilizando `Space` como único `code` de acción del catálogo actual.** Ninguno de los 4 juegos usa más de una tecla de acción no-direccional (`Space` en Asteroides y Tetris; ninguna en Arkanoid/Snake), así que el tipo `TouchAction` se deja abierto a 2 sin necesidad de resolver hoy qué sería un segundo botón — evita over-engineering para un caso que no existe todavía en el catálogo.
- **Visibilidad condicionada por CSS `@media (pointer: coarse)`, no por JS `navigator.maxTouchPoints` ni por detección de user-agent.** Es el criterio estándar del navegador para distinguir "dispositivo cuyo input principal es táctil" de mouse/trackpad, evita falsos positivos en laptops táctiles con mouse conectado, y no requiere JS ni hidratación condicional (se resuelve en CSS puro, sin riesgo de desajuste servidor/cliente).
- **Canvas reescalado por CSS (`max-width: 100%; height: auto`), sin cambiar la resolución lógica interna del `<canvas>`.** Decisión explícita del usuario (opción recomendada): mantiene los `width`/`height` HTML de cada motor intactos (por lo tanto ninguna coordenada de juego, hitbox o física cambia), y solo afecta cómo se pinta visualmente — el mismo patrón que ya usa `.crt-screen` con `aspect-ratio: 4/3`.
- **Repeat simulado con `setInterval` (300ms delay, 80ms repeat) en vez de depender del repeat nativo del navegador.** Los eventos sintéticos no disparan el auto-repeat de teclado del sistema operativo (que solo aplica a eventos de hardware reales), así que sin este mecanismo mantener presionado el D-pad solo movería un paso. Los valores (300/80ms) se alinean a los defaults típicos de repeat de teclado de macOS/Windows para que la sensación sea equivalente a mantener presionada una tecla física.
- **`arkanoid` y `snake` sin botones de acción.** Ninguno de los dos tiene una tecla de acción además de las flechas (la pelota de Arkanoid se lanza sola; Snake solo cambia de dirección) — agregar un botón sin función sería ruido visual, no una mejora de control.
- **`player-hud` oculto por completo en táctil, reemplazado por `MobileFooter` (solo PAUSA + skin).** Decisión explícita del usuario: en móvil "lo único relevante" es pausar y, si el juego tiene skins, cambiarlas — el resto del `player-hud` (nombre de jugador, Puntuación/Vidas/Nivel en HTML, FIN, SALIR) se retira de la pantalla de juego en táctil para maximizar el espacio del canvas y los controles. Limitado a `pointer: coarse` para no alterar la experiencia de escritorio, que ya funciona bien.
- **`MobileFooter` va arriba del `TouchControls` (entre el canvas y el D-pad), no debajo de todo.** Decisión explícita del usuario, eligiendo la opción recomendada; se descartó explícitamente la alternativa de ponerlo debajo del D-pad (menos accesible con el pulgar mientras se sostiene el teléfono con las dos manos sobre los controles).
- **FIN y SALIR se ocultan también, no solo las estadísticas.** Decisión explícita del usuario. Para no dejar al jugador sin forma de abandonar la partida, se agrega SALIR al overlay de pausa (que sí sigue accesible vía el botón PAUSA de `MobileFooter`) en vez de restaurar un botón dedicado en la barra de pie — mantiene la barra mínima que pidió el usuario.
- **`arkanoid` y `snake` muestran las vidas como texto (`VIDAS: N`) en vez de iconos en su `drawHUD()`.** Decisión explícita del usuario durante la implementación: el texto es más descriptivo y preciso que contar íconos a simple vista, sobre todo en pantallas pequeñas. `AsteroidesEngine` (fuera de alcance de esta spec) sigue mostrando iconos, ya los tenía antes de esta spec.
- **`arkanoid` y `snake` ganan `drawHUD()` en el canvas, incondicionalmente (no solo en móvil).** Al ocultar `player-hud` en táctil, esos dos juegos se quedarían sin forma de ver score/vidas/nivel durante la partida (hoy solo lo muestran al terminar). Se dibuja siempre, igual que ya hacen Asteroides y Tetris, en vez de condicionar el render del motor a `pointer: coarse` — evita que el motor conozca detalles de layout/CSS de la capa de presentación y deja el catálogo consistente entre los 4 juegos.

## Riesgos identificados

- Los eventos táctiles (`touchstart`/`touchend`) deben llamar `preventDefault()` para evitar que el navegador dispare además un `mousedown`/`click` sintético (double-fire) o el zoom por doble-tap/scroll de la página al interactuar con los botones — verificar en el paso 6 que no hay disparos duplicados ni scroll accidental de la página al usar el D-pad.
- Si el usuario mantiene presionados dos botones de dirección opuestos simultáneamente (p. ej. ← y → en Tetris) el comportamiento debe coincidir con el que ya tienen los motores al recibir ambas teclas físicas a la vez (no es un caso nuevo introducido por esta spec, pero conviene confirmarlo en el paso 6 porque en táctil es más fácil de provocar sin querer con dos dedos).
- El `@media (pointer: coarse)` no cubre el 100% de los casos límite (algunos híbridos táctil+mouse reportan `pointer: fine`); se acepta como límite conocido de la heurística, sin lógica de fallback adicional en esta spec.
- Tetris usa múltiples canvases superpuestos (tablero + pieza siguiente); confirmar en el paso 7 que el reescalado por CSS no desalinea el canvas de "siguiente pieza" respecto al tablero principal en viewports angostos.
- El `drawHUD()` nuevo de Snake debe reflejar el mapeo forzado de `lives` de spec 09 (fijo en 1 hasta game over) y el de Tetris/Arkanoid ya usa `lives` real de 3 — confirmar en el paso 3 que el ícono de vidas de cada motor usa el valor de `lives` que ya calcula internamente, sin duplicar lógica de conteo.
- Si en el futuro se agrega un quinto juego al catálogo sin `drawHUD()` propio, quedaría sin estadísticas visibles en móvil (con `player-hud` oculto) — no se resuelve en esta spec con un chequeo automático; queda como criterio a recordar en `/add-game`.
