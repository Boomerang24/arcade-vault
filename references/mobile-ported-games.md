# Juegos con soporte táctil móvil

Memoria de `@mobile-porter`. Solo ese agente escribe aquí.
Patrón de referencia: `specs/12-controles-tactiles-moviles.md` (gamepad `TouchControls` + `MobileFooter` + HUD en canvas).
El agente trabaja **un juego por corrida** — nunca recorre el catálogo completo.

## Estado del catálogo

| Juego      | D-pad   | Acciones         | HUD en canvas | Actualizado |
| ---------- | ------- | ---------------- | ------------- | ----------- |
| asteroides | ↑ ← →   | DISPARAR (Space) | ✅            | 2026-08-15  |
| tetris     | ↑ ↓ ← → | CAER (Space)     | ✅            | 2026-08-15  |
| arkanoid   | ← →     | —                | ✅            | 2026-08-15  |
| snake      | ↑ ↓ ← → | —                | ✅            | 2026-08-15  |
| frogger    | ↑ ↓ ← → | —                | ✅            | 2026-08-17  |
| sinapsis   | ↑ ↓ ← → | SONDEAR (Space)  | ✅            | 2026-08-28  |
| sifon      | ↑ ↓ ← → | DISPARAR (Space) | ✅            | 2026-08-31  |

## asteroides

**Mapeo:** ↑ empuje, ←/→ rotación, DISPARAR (Space). ↓ no mapea a ningún `code`.
**Notas:** ya dibujaba HUD (score/nivel/vidas con iconos) antes de la spec 12.

## tetris

**Mapeo:** ← mover izquierda, → mover derecha, ↓ soft drop, ↑ rotar, CAER (Space, hard drop).
**Notas:** multi-canvas (tablero + "NEXT"); "NEXT" se reduce a 64px bajo `pointer: coarse` (`.tetris-next-canvas`) para dejar más espacio al tablero. Borde cyan en el tablero (`.tetris-board-canvas`).

## arkanoid

**Mapeo:** solo ←/→ mueven la pala. ↑/↓ no mapean a ningún `code`. Sin botones de acción (la pelota se lanza sola).
**Notas:** ganó `drawHUD()` en spec 12 (no lo tenía antes). Borde cyan en el tablero (`.arkanoid-board-canvas`).

## snake

**Mapeo:** las 4 flechas cambian de dirección. Sin botones de acción.
**Notas:** ganó `drawHUD()` en spec 12 (no lo tenía antes). Vidas fijas en 1 hasta game over (mapeo forzado de spec 09), mostradas como texto.

## frogger

**Mapeo:** las 4 flechas hacen un salto discreto de la rana a la casilla contigua (arriba/abajo/izquierda/derecha). Sin botones de acción — el motor solo mapea `ArrowUp/Down/Left/Right` en `KEY_TO_DIRECTION` (`lib/games/frogger/engine.ts:200-203`), no escucha `Space`, así que `touchActions` se omite del registro (mismo caso que `arkanoid`/`snake`).
**Notas:** único cambio de esta corrida fue la fila en `TOUCH_DIRECTIONS` de `jugar-client.tsx`; no requirió `drawHUD()` ni CSS propio.

- **HUD ya existía** desde su implementación original (`drawHUD()` en `engine.ts:652`, invocado por frame desde `draw()`): SCORE a la izquierda, NIVEL centrado, vidas a la derecha y barra de tiempo de ronda arriba. Verificado, no asumido.
- **Vidas como corazones (`♥`), no como texto `VIDAS: N`.** Excepción consciente al patrón de `arkanoid`/`snake`: ese formato de texto fue una decisión de la spec 12 para dos motores que _no_ tenían HUD; frogger ya traía el suyo con iconos, igual que `asteroides`. No se reescribió para no tocar renderizado que ya funciona.
- **Repetición al mantener presionado:** el motor ignora input mientras `frog.animating` o si `pendingDir` ya está puesto, así que el auto-repeat de 300/80ms de `TouchControls` se traduce en saltos encadenados a ritmo de animación, no en saltos duplicados.
- Canvas 640×560 posicionado en absoluto al 100% dentro de `.crt-screen` — escala solo, sin necesitar reglas nuevas bajo `pointer: coarse`.

## sinapsis

**Mapeo:** las 4 flechas mueven el cursor de sonda una celda en la rejilla (`KEY_TO_DIRECTION`, `lib/games/sinapsis/engine.ts:159-163`), **sin wrap-around**: el motor descarta el movimiento si la celda destino cae fuera de la rejilla (`engine.ts:609-615`), así que en el borde la flecha simplemente no hace nada (el auto-repeat de `TouchControls` tampoco produce salto). SONDEAR (`Space`) sondea el nodo bajo el cursor (`engine.ts:597-601`).
**Notas:**

- **Única acción del catálogo con `code: "Space"` además de asteroides/tetris.** Etiqueta "SONDEAR" (fuente `--mono` del botón circular, entra en una línea).
- **HUD ya existía** desde el Paso 6 de su implementación (`drawHUD()` en `engine.ts:788`, invocado por frame desde `draw()` en `engine.ts:841`): SCORE a la izquierda, `CAPA N` centrado, vidas a la derecha y barra de tiempo de ronda. Verificado, no asumido — no se tocó el motor en esta corrida.
- **Vidas como puntos (5 círculos, `p.lifeOn`/`p.lifeOff`), no como texto `VIDAS: N`.** Misma excepción consciente que `asteroides`/`frogger`: el formato de texto fue una decisión de la spec 12 para dos motores que _no_ tenían HUD; sinapsis ya traía el suyo con iconos y no se reescribió renderizado que ya funciona.
- **`Space` se procesa aun en pausa/gameover a nivel de `handleKeyDown`** (el early-return de `paused`/`gameover` solo cubre las flechas); `handleProbe()` es quien filtra internamente. Comportamiento idéntico a mantener la tecla física, no introducido por esta corrida.
- Canvas único 800×600 sin clases propias — cae bajo `.crt-screen canvas { max-width: 100%; height: auto }` (`app/globals.css:1091`), sin reglas nuevas bajo `pointer: coarse`.
- Cambios de esta corrida: `touchActions` en `GAME_REGISTRY.sinapsis` y la fila en `TOUCH_DIRECTIONS`. Nada más.

## sifon

**Mapeo:** ←/→ rotan el sifón de forma **continua** (el motor lee `this.keys["ArrowLeft"]/["ArrowRight"]` cada frame en `update()`, `lib/games/sifon/engine.ts:407-408`, no en el `keydown`), ↑ dispara, ↓ intercambia la burbuja cargada con la siguiente, DISPARAR (`Space`) dispara. `Space` y `ArrowUp` son sinónimos exactos en el motor (`engine.ts:370`).
**Notas:**

- **Las 4 flechas quedan habilitadas.** ↑ es redundante con el botón DISPARAR pero el motor sí lo escucha, así que se deja activo en vez de deshabilitarlo (el D-pad es un bloque fijo de 4 flechas; ocultarlo o inhabilitarlo sería quitar una tecla que el teclado físico sí tiene).
- **El swap (`ArrowDown`) no puede ser un segundo botón de acción.** `TouchAction.code` está tipado como el literal `"Space"` (`lib/games/registry.ts:53`) y ampliar ese tipo queda fuera del alcance de este agente; el swap ya es accesible desde ↓ del D-pad, así que no se pierde ninguna acción.
- **Rotación continua vs. auto-repeat:** ←/→ no dependen del repeat de 300/80ms de `TouchControls` — basta con mantener el dedo abajo, porque el motor rota mientras la tecla esté marcada como presionada. `keyup` sintético de `TouchControls` la libera correctamente.
- **Disparo/swap solo en `firstPress`** (`engine.ts:369`): el auto-repeat de `TouchControls` reenvía `keydown` sin `keyup` intermedio, así que mantener presionado ↑/↓/DISPARAR **no** encadena disparos ni swaps repetidos — hay que soltar y volver a tocar, igual que con la tecla física.
- **HUD ya existía** desde la implementación original: `drawPanels()` (`engine.ts:785`, invocado por frame desde `draw()` en `engine.ts:938`) dibuja PUNTUACIÓN, NIVEL, VIDAS, SIGUIENTE y el manómetro de PRESIÓN en los paneles laterales. Verificado, no asumido — el motor no se tocó en esta corrida.
- **Vidas como 3 puntos (círculos llenos/vacíos), no como texto `VIDAS: N`.** Misma excepción consciente que `asteroides`/`frogger`/`sinapsis`: el texto fue una decisión de la spec 12 para motores que _no_ tenían HUD.
- Canvas único 800×600 sin clases propias — cae bajo `.crt-screen canvas { max-width: 100%; height: auto }` (`app/globals.css:1091`), sin reglas nuevas bajo `pointer: coarse`.
- Cambios de esta corrida: `touchActions` en `GAME_REGISTRY.sifon` y la fila en `TOUCH_DIRECTIONS`. Nada más.
