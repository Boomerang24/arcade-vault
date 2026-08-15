# Juegos con skins

Memoria de `@skin-designer`. Solo ese agente escribe aquí.
Skins obligatorias: `classic` (default, look original), `neon`, `retro`.
El agente trabaja **un juego por corrida** — nunca recorre el catálogo completo.

## Estado del catálogo

| Juego      | classic | neon | retro | Extras           | Actualizado |
| ---------- | ------- | ---- | ----- | ---------------- | ----------- |
| tetris     | ✅      | ✅   | ✅    | pastel, pixelart | 2026-08-15  |
| asteroides | ✅      | ✅   | ✅    | —                | 2026-08-15  |
| arkanoid   | ✅      | ✅   | ✅    | —                | 2026-08-15  |
| snake      | ✅      | ✅   | ✅    | —                | 2026-08-15  |

## arkanoid

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/arkanoid/engine.ts`. Arkanoid dibuja **todo** desde `public/games/arkanoid/spritesheet-breakout.png` (pala, bola, 5 filas de ladrillos y sus 4 frames de explosión), así que la paleta no son colores de relleno sino **tintes aplicados en runtime**: `getTintedFrame(frame, tint)` recorta el frame a un canvas offscreen, aplica `globalCompositeOperation = "color"` (reemplaza tono+saturación y **conserva la luminosidad**, así el bisel del sprite no se aplana), recupera el alpha con `"destination-in"` y opcionalmente oscurece con `"source-atop"` + `rgba(0,0,0,dim)`. El resultado se cachea en un `Map` con clave `${sx},${sy},${sw},${sh}|color|dim`, así que cada frame se tiñe una sola vez por skin. Todo pasa por la única primitiva `drawSprite(frame, x, y, w, h, tint)`, que también aplica el `shadowBlur`/`shadowColor` del glow. `classic` deja todos los tintes en `null` y salta el offscreen por completo. `setSkin()` redibuja sincrónicamente (funciona en pausa). No se añadió ningún PNG nuevo.

| Rol                       | classic           | neon                | retro              |
| ------------------------- | ----------------- | ------------------- | ------------------ |
| background                | `#000000`         | `#06000f`           | `#0a0600`          |
| paddle                    | sin teñir         | `#00f5ff`           | `#ffb000`          |
| ball                      | sin teñir         | `#f5ff00`           | `#ffb000`          |
| ladrillo fila 1 (red)     | sin teñir         | `#ff006e`           | `#ffb000`          |
| ladrillo fila 2 (yellow)  | sin teñir         | `#f5ff00`           | `#ffb000` dim 0.08 |
| ladrillo fila 3 (green)   | sin teñir         | `#00ff88`           | `#ffb000` dim 0.16 |
| ladrillo fila 4 (cyan)    | sin teñir         | `#00f5ff`           | `#ffb000` dim 0.24 |
| ladrillo fila 5 (magenta) | sin teñir         | `#c800ff`           | `#ffb000` dim 0.32 |
| overlay title             | `#f0f0f0`         | `#ff006e`           | `#ffb000`          |
| overlay sub               | `#f0f0f0`         | `#00f5ff`           | `#ffb000`          |
| overlay dim               | `rgba(0,0,0,0.6)` | `rgba(6,0,15,0.72)` | `rgba(10,6,0,0.7)` |

**Estilo por skin:**

- `classic`: pixel-idéntico al port original — `drawImage` directo del spritesheet, fondo `#000`, overlay `#f0f0f0` sobre `rgba(0,0,0,0.6)`. Sin glow ni scanlines.
- `neon`: `shadowBlur: 14` con el color del propio tinte en pala, bola, ladrillos y explosiones, y también en el texto del overlay. Colores alineados con los tokens del sitio (`--cyan`, `--magenta`, `--yellow`, `--green`).
- `retro`: monocromo ámbar CRT (`#ffb000`) sobre negro cálido, sin glow, con scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px) dibujadas sobre el campo pero **debajo** del overlay de nivel/game over.

**Notas:** las explosiones reutilizan el tinte del ladrillo que las originó (`palette.bricks[explosion.color]`), así que no necesitan entrada propia. Como en `retro` las 5 filas comparten un solo tono, se diferencian por un ramp de `dim` (0 → 0.32) en vez de por color; el ramp se suavizó tras la pasada de navegador porque con valores más altos las filas bajas quedaban ilegibles sumadas a las scanlines. Se eligió ámbar (no verde fósforo) para mantener coherencia con `tetris`/`asteroides` y porque `neon` ya usa `#00ff88`. Cero cambios de mecánica: velocidades, radios, hitboxes y colisiones quedaron intactos; el teñido no altera el tamaño de dibujo de ningún sprite.

## snake

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/snake/engine.ts`. El motor guarda `private currentSkin` + getter `palette`; `setSkin()` redibuja sincrónicamente (funciona en pausa). El glow se centraliza en `applySkinGlow` y el radio de esquina de los segmentos es un campo de la paleta (`cornerRadius`). El único asset raster (`public/games/snake/fruits.png`) se **tiñe en runtime**: `tintedFruit(kind)` recorta el frame a un canvas offscreen y aplica `globalCompositeOperation = "source-atop"` con `fruitTint`/`fruitTintAlpha`, cacheando el resultado en un `Map` con clave `${kind}|${skin}` para no re-teñir por frame. `classic` deja `fruitTint: null`, así que dibuja el sprite original sin pasar por el offscreen. No se añadió ningún PNG nuevo.

| Rol              | classic             | neon                   | retro               |
| ---------------- | ------------------- | ---------------------- | ------------------- |
| background       | `#000000`           | `#06000f`              | `#0a0600`           |
| head             | `#4ade80`           | `#00f5ff`              | `#ffb000`           |
| body             | `#16a34a`           | `#00ff88`              | `#cc7a00`           |
| bodyEdge         | —                   | `#00f5ff`              | `#0a0600`           |
| fruitTint        | — (sprite original) | `#f5ff00` (alpha 0.35) | `#ffb000` (alpha 1) |
| overlay backdrop | `rgba(0,0,0,0.6)`   | `rgba(6,0,15,0.68)`    | `rgba(10,6,0,0.68)` |
| overlay title    | `#f0f0f0`           | `#ff006e`              | `#ffb000`           |
| overlay sub      | `#f0f0f0`           | `#00f5ff`              | `#ffb000`           |
| cornerRadius     | 4                   | 4                      | 0                   |

**Estilo por skin:**

- `classic`: literales originales exactos (cabeza `#4ade80`, cuerpo `#16a34a`, `roundRect` r=4, fruta sin teñir, overlay `rgba(0,0,0,0.6)` + `#f0f0f0`). Sin glow ni contorno.
- `neon`: `shadowBlur` en cabeza (14), cuerpo (8), fruta (12) y overlay; contorno cian por segmento; fruta con tinte amarillo al 35% que conserva la silueta reconocible de cada sprite.
- `retro`: monocromo ámbar CRT sobre negro cálido, segmentos cuadrados (r=0) separados por contorno del color de fondo, fruta teñida ámbar al 100% y scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px) dibujadas sobre el campo pero **debajo** del overlay de fin de partida.

**Notas:** ámbar para `retro` porque `neon` ya usa verde (`#00ff88`) en el cuerpo, y coherente con `asteroides`. El teñido se encola implícitamente tras `spriteImage.onload`: `drawFruit` retorna temprano si `!spritesLoaded`, así que `setSkin` antes de la carga no cachea un canvas vacío. Cero cambios de mecánica: `CELL`, `pad`, grid de colisión, tick por nivel y puntuación intactos — el `cornerRadius: 0` de `retro` es puramente visual (las colisiones son por celda de grid, no por forma).

## asteroides

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/asteroides/engine.ts`. Cada clase de dibujo (`Bullet`, `Asteroid`, `Ship`, `Particle`) recibe `(ctx, palette, skin)`; el motor expone `private currentSkin` + getter `palette` y `setSkin()` redibuja sincrónicamente (funciona en pausa). El glow por skin se centraliza en el helper `applySkinGlow` y los colores con alpha (partículas, llama del propulsor, subtítulo del overlay) se derivan del hex de la paleta con `withAlpha`. Juego 100% procedural: no hay sprites, no se añadió ningún asset. Selector compartido vía `GAME_REGISTRY.asteroides.skins`.

| Rol           | classic   | neon      | retro     |
| ------------- | --------- | --------- | --------- |
| background    | `#000000` | `#06000f` | `#0a0600` |
| ship          | `#ffffff` | `#00f5ff` | `#ffb000` |
| thruster      | `#ff8200` | `#00ff88` | `#ff7b00` |
| bullet        | `#ffffff` | `#f5ff00` | `#ffd280` |
| asteroid      | `#ffffff` | `#ff006e` | `#cc8c00` |
| particle      | `#ffffff` | `#f5ff00` | `#ffb000` |
| hud           | `#ffffff` | `#00f5ff` | `#ffb000` |
| overlay title | `#ffffff` | `#ff006e` | `#ffb000` |
| overlay sub   | `#ffffff` | `#00f5ff` | `#ffb000` |

**Estilo por skin:**

- `classic`: reproduce literal por literal el port original (blanco sobre negro, propulsor `rgba(255,130,0,0.85)`, subtítulo al 65%). Sin glow ni relleno de asteroides.
- `neon`: `shadowBlur`/`shadowColor` en nave, balas, asteroides, partículas, HUD y overlay; asteroides con relleno magenta al 12%. Colores alineados con los tokens del sitio (`--cyan`, `--magenta`, `--yellow`, `--green`).
- `retro`: monocromo ámbar CRT (`#ffb000`) sobre negro cálido, sin glow, relleno de asteroide al 10% y scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px) dibujadas sobre el campo de juego pero **debajo** del HUD, para que puntaje/nivel/vidas sigan legibles.

**Notas:** se eligió ámbar (no verde fósforo) para `retro` porque `neon` ya usa `#00ff88` en el propulsor. Cero cambios de mecánica: radios, velocidades, colisiones y `lineWidth` quedaron idénticos — ninguna hitbox visual cambió.

## tetris

**Técnica:** paleta por índice de pieza (`SKIN_PALETTES: Record<SkinName, Array<string|null>>`) + rama por skin dentro de `drawBlock` (`lib/games/tetris/engine.ts`). Selector compartido en `jugar-client.tsx` vía `GAME_REGISTRY.tetris.skins`.

| Rol     | classic   | neon      | retro     |
| ------- | --------- | --------- | --------- |
| pieza I | `#4dd0e1` | `#00fff2` | `#ffb000` |
| pieza O | `#ffd54f` | `#faff00` | `#ffb000` |
| pieza T | `#ba68c8` | `#ff2df5` | `#ffb000` |
| pieza S | `#81c784` | `#39ff6a` | `#ffb000` |
| pieza Z | `#e57373` | `#ff3b3b` | `#ffb000` |
| pieza J | `#64b5f6` | `#3d9dff` | `#ffb000` |
| pieza L | `#ffb74d` | `#ff9d1f` | `#ffb000` |

**Estilo por skin:**

- `classic`: relleno plano + franja superior blanca translúcida (highlight).
- `neon`: `shadowBlur`/`shadowColor` + contorno del mismo color.
- `retro`: monocromo ámbar CRT, sin glow, con scanlines horizontales sutiles (`rgba(0,0,0,0.22)` cada 3px) y contorno oscuro.
- `pastel` (extra): esquinas redondeadas, paleta suave propia.
- `pixelart` (extra): reutiliza la paleta `classic`, solo cambia el estilo de trazo (textura de cuadrícula 4×4).
