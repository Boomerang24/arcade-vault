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
