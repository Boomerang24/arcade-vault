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
| frogger    | ✅      | ✅   | ✅    | —                | 2026-08-17  |
| sinapsis   | ✅      | ✅   | ✅    | —                | 2026-08-28  |
| sifon      | ✅      | ✅   | ✅    | —                | 2026-08-31  |
| 2048       | ✅      | ✅   | ✅    | —                | 2026-09-01  |

## 2048

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/2048/engine.ts`. Juego 100% procedural (sin `public/games/2048/`), así que cada literal pasó a campo de paleta. El motor guarda `private currentSkin` + getter `palette`; `drawBackground`, `drawPanel`, `drawBoardFrame`, `drawTile`, `drawOverlay` y el velo de pausa de `draw()` leen de ahí. El elemento central es la **rampa `tiles`** (14 entradas, índice = `log2(value)`, la 0 nunca se dibuja): cada skin tiene la suya. Como la luminosidad de la rampa no es monótona en `classic`/`neon`, el color del número también es una rampa paralela (`tileTexts`, generada con el helper `textRamp(dark, light, until)`), en vez del `exponente <= 6 ? oscuro : blanco` original. El glow de ficha no es una rama `if (skin === "neon")` sino tres números (`tileBlurBase`/`tileBlurStep`/`tileBlurMax`), porque `classic` **ya tenía glow propio** (`min(4 + exp*2, 30)`) y había que conservarlo exacto. `setSkin()` redibuja sincrónicamente y `draw()` repone por su cuenta el overlay de FIN o el velo de pausa, así que el cambio se ve al instante incluso con la partida pausada o terminada. Selector compartido vía `GAME_REGISTRY["2048"].skins`.

| Rol                    | classic               | neon                | retro               |
| ---------------------- | --------------------- | ------------------- | ------------------- |
| bg                     | `#0a0a0f`             | `#06000f`           | `#0a0600`           |
| panelLabel             | `#8a8fb5`             | `#c800ff`           | `#8a5200`           |
| panelValue             | `#00f5ff`             | `#00f5ff`           | `#ffb000`           |
| boardFrame             | `#0f0f18`             | `#0b0018`           | `#140c00`           |
| boardBorder            | `#00f5ff`             | `#c800ff`           | `#ffb000`           |
| emptyCell              | `#15151f`             | `#16002e`           | `#1f1400`           |
| legend                 | `#4a4f70`             | `#7a00b0`           | `#8a5200`           |
| ficha 2 (exp 1)        | `#00c8d0`             | `#00d5ff`           | `#5a3400`           |
| ficha 4 (exp 2)        | `#00f5ff`             | `#00f5ff`           | `#7a4700`           |
| ficha 8 (exp 3)        | `#00e0a8`             | `#00ffc8`           | `#8f5400`           |
| ficha 16 (exp 4)       | `#00ff88`             | `#00ff88`           | `#a66200`           |
| ficha 32 (exp 5)       | `#9bf53a`             | `#aaff00`           | `#bd7100`           |
| ficha 64 (exp 6)       | `#f5ff00`             | `#f5ff00`           | `#d18000`           |
| ficha 128 (exp 7)      | `#ffc400`             | `#ffb300`           | `#e08e00`           |
| ficha 256 (exp 8)      | `#ff8a3d`             | `#ff6a00`           | `#ef9d00`           |
| ficha 512 (exp 9)      | `#ff5da0`             | `#ff2d78`           | `#ffb000`           |
| ficha 1024 (exp 10)    | `#ff2f96`             | `#ff006e`           | `#ffc133`           |
| ficha 2048 (exp 11)    | `#ff006e`             | `#ff00c8`           | `#ffd166`           |
| ficha 4096 (exp 12)    | `#ff4fb0`             | `#c800ff`           | `#ffe099`           |
| ficha 8192+ (exp 13)   | `#ff7dc8`             | `#9d4dff`           | `#ffeecc`           |
| texto ficha (oscuro)   | `#0a0a0f` (exp ≤ 6)   | `#06000f` (exp ≤ 8) | `#0a0600` (exp ≥ 6) |
| texto ficha (claro)    | `#ffffff` (exp ≥ 7)   | `#ffffff` (exp ≥ 9) | `#ffd280` (exp ≤ 5) |
| glow ficha (base/step) | 4 / 2 (máx 30)        | 10 / 3 (máx 44)     | 0 / 0 (máx 0)       |
| overlayVeil            | `rgba(10,10,15,0.72)` | `rgba(6,0,15,0.75)` | `rgba(10,6,0,0.75)` |
| overlayGlow / blur     | `#00f5ff` / 18        | `#ff006e` / 28      | `#ffb000` / 0       |
| overlayTitle           | `#ff006e`             | `#ff006e`           | `#ffb000`           |
| overlaySub             | `#e6e9ff`             | `#00f5ff`           | `#ffd280`           |
| pauseVeil              | `rgba(10,10,15,0.55)` | `rgba(6,0,15,0.58)` | `rgba(10,6,0,0.58)` |

**Estilo por skin:**

- `classic`: literales originales exactos (fondo `#0a0a0f`, marco `#0f0f18` con borde cian, celdas vacías `#15151f`, panel `#8a8fb5`/`#00f5ff`, leyenda `#4a4f70`, rampa cian → verde → amarillo → magenta, glow `min(4 + exp*2, 30)`, overlay magenta con glow cian sobre velo al 72%). Sin scanlines.
- `neon`: marco y etiquetas violeta (`#c800ff`) sobre negro púrpura, rampa más saturada que remata en violeta (`#ff00c8` → `#c800ff` → `#9d4dff`) en vez de rosa pálido, glow de ficha ~2.5x (`min(10 + exp*3, 44)`), overlay magenta con blur 28 y subtítulo cian.
- `retro`: monocromo ámbar CRT sobre negro cálido, sin glow, con scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px, buffer offscreen cacheado) dibujadas sobre el tablero pero **debajo** del overlay/velo de pausa y **nunca sobre el panel lateral**, para que puntos/mejor ficha/nivel/movimientos sigan legibles.

**Notas:** en `retro` la rampa de fichas es de luminancia pura (`#5a3400` → `#ffeecc`, 13 escalones), que aquí funciona mejor que en otros juegos porque **cada ficha lleva su número escrito encima**: el color nunca fue el discriminante de la mecánica, solo un refuerzo de "cuán grande es". Por eso el color del texto también se invierte respecto de `classic`: claro (`#ffd280`) sobre los escalones oscuros (exp ≤ 5) y oscuro (`#0a0600`) sobre los brillantes. Se eligió ámbar y no verde fósforo porque la rampa `classic` ya recorre el verde (`#00ff88`, `#9bf53a`). El velo de pausa y el overlay de FIN cubren solo el rect del tablero (el panel lateral queda visible), igual que antes del refactor. Cero cambios de mecánica: `slide`, `spawnTile`, `isBlocked`, `SLIDE_MS`/`SETTLE_MS`, el buffer de una pulsación y la puntuación quedaron intactos — el glow no afecta a nada porque el juego es por turnos sobre una rejilla y no hay colisiones por píxel. No se añadió ningún asset a `public/games/`.

## sifon

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/sifon/engine.ts`. Juego 100% procedural (burbujas con gradiente radial, sin `public/games/sifon/`), así que cada literal pasó a campo de paleta, incluidos los 4 colores de burbuja (`palette.bubbles`, indexado por `BubbleColor`). El motor guarda `private currentSkin` + getter `palette`; `renderMassCache`, `drawBubbleAt`, `drawWell`, `drawDangerLine`, `drawPress`, `drawNozzle`, `drawPanels`, `drawOverlay` y `draw()` leen de ahí. El glow no es una rama `if (skin === "neon")` sino tres campos numéricos (`bubbleBlur`, `nozzleBlur`, `overlayBlur`), porque `classic` **ya tenía glow propio** (8/12/18) y había que conservarlo exacto; lo mismo con `bubbleCore`/`bubbleSpecular` (centro del gradiente y punto de brillo). El flash de purga se deriva del hex `purgeFlash` con `withAlpha()`, conservando la rampa `0.25 · deadTimer/DEAD_SECONDS`. `setSkin()` marca `massDirty` (para regenerar el canvas offscreen donde están horneadas las burbujas asentadas) y redibuja sincrónicamente, reponiendo el overlay "PAUSA" si estaba pausado. `BUBBLE_HEX` se mantiene como export histórico apuntando a `SKIN_PALETTES.classic.bubbles`. Selector compartido vía `GAME_REGISTRY.sifon.skins`.

| Rol             | classic                | neon                   | retro                    |
| --------------- | ---------------------- | ---------------------- | ------------------------ |
| bg              | `#050510`              | `#06000f`              | `#0a0600`                |
| poolWall        | `#3a3a6a`              | `#c800ff`              | `#8a5200`                |
| poolFill        | `rgba(0,245,255,0.04)` | `rgba(255,0,110,0.05)` | `rgba(255,176,0,0.04)`   |
| press           | `#5a5a7a`              | `#7a00b0`              | `#8a5200`                |
| pressEdge       | `#9a9ac0`              | `#f5ff00`              | `#ffb000`                |
| pressBolt       | `#1a1a2e`              | `#12002b`              | `#1a1000`                |
| danger          | `#ef4444`              | `#ff006e`              | `#ff7b00`                |
| dangerAlt       | `#1a1000`              | `#12002b`              | `#1a1000`                |
| nozzle          | `#00f5ff`              | `#00f5ff`              | `#ffb000`                |
| aimGuide        | `rgba(0,245,255,0.6)`  | `rgba(0,245,255,0.7)`  | `rgba(255,176,0,0.6)`    |
| panelBg         | `#0a0a1a`              | `#0b0018`              | `#140c00`                |
| panelLine       | `rgba(0,245,255,0.15)` | `rgba(200,0,255,0.25)` | `rgba(255,176,0,0.15)`   |
| hud             | `#f0f0f0`              | `#00f5ff`              | `#ffb000`                |
| hudDim          | `rgba(240,240,240,.5)` | `rgba(0,245,255,0.55)` | `rgba(255,176,0,0.5)`    |
| gaugeFrame      | `#3a3a6a`              | `#c800ff`              | `#8a5200`                |
| gaugeFill       | `#f5ff00`              | `#f5ff00`              | `#ffb000`                |
| overlayTitle    | `#00f5ff`              | `#ff006e`              | `#ffb000`                |
| overlaySub      | `rgba(240,240,240,.7)` | `rgba(0,245,255,0.75)` | `rgba(255,176,0,0.7)`    |
| purgeFlash      | `#ef4444`              | `#ff006e`              | `#ff7b00`                |
| burbuja cyan    | `#00f5ff`              | `#00f5ff`              | `#ffe9b0`                |
| burbuja magenta | `#ff006e`              | `#ff006e`              | `#ffb000`                |
| burbuja yellow  | `#f5ff00`              | `#f5ff00`              | `#d18800`                |
| burbuja green   | `#00ff88`              | `#00ff88`              | `#7a4400`                |
| bubbleCore      | `#ffffff`              | `#ffffff`              | `rgba(255,232,190,0.6)`  |
| bubbleSpecular  | `rgba(255,255,255,.5)` | `rgba(255,255,255,.6)` | `rgba(255,232,190,0.35)` |
| glow            | 8 / 12 / 18            | 16 / 20 / 26           | 0 / 0 / 0                |

(la fila `glow` es `bubbleBlur / nozzleBlur / overlayBlur`)

**Estilo por skin:**

- `classic`: literales originales exactos (fondo `#050510`, paredes del pozo `#3a3a6a`, prensa gris azulada con borde `#9a9ac0`, línea de peligro `#ef4444`, boquilla cian con blur 12, HUD `#f0f0f0`/`rgba(240,240,240,0.5)`, manómetro amarillo, overlay cian con blur 18, burbujas con los 4 tokens neón del sitio y núcleo blanco). Sin scanlines.
- `neon`: pozo y manómetro violeta (`#c800ff`), prensa púrpura con borde amarillo, línea de peligro magenta, HUD cian, overlay magenta; todo el glow sube ~2x (burbujas 16, boquilla 20, overlay 26). Los 4 colores de burbuja **no cambian** respecto de `classic` porque ya son exactamente los tokens del sitio (`--cyan`, `--magenta`, `--yellow`, `--green`): lo que cambia es el cromo alrededor y la intensidad del glow.
- `retro`: monocromo ámbar CRT sobre negro cálido, sin glow, con scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px, buffer offscreen cacheado) dibujadas sobre el pozo pero **debajo** de los paneles de HUD y del overlay, para que puntuación/nivel/vidas/manómetro y el texto de fin de partida sigan legibles.

**Notas:** en `retro` las 4 burbujas **no pueden ser monocromas** como en `sinapsis` o `frogger`: aquí el color _es_ la mecánica (racimos de 3 del mismo color) y todas las burbujas comparten la misma silueta circular, así que no hay forma alternativa de discriminarlas. Se usó un ramp de 4 intensidades de ámbar bien separadas (`#ffe9b0` > `#ffb000` > `#d18800` > `#7a4400`), como el ramp de `dim` de `arkanoid`; el gap entre las dos más oscuras se amplió tras la pasada de navegador porque `#c47a00`/`#8f5a00` se confundían sumados a las scanlines. Además el núcleo del gradiente (`bubbleCore`) y el brillo especular pasan a ámbar translúcido en `retro`, porque el blanco puro del original aplanaba las cuatro intensidades. Cero cambios de mecánica: `SPEED`, `ROT_SPEED`, `MAX_ANGLE`, `GRAVITY`, geometría hexagonal (`D`/`R`/`ROW_H`), umbral de presión, línea de peligro y puntuación quedaron intactos — el glow no altera hitboxes porque las colisiones son círculo-círculo por centro de celda, no por píxel dibujado. No se añadió ningún asset a `public/games/`.

## sinapsis

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/sinapsis/engine.ts`. Juego 100% procedural (los 12 glifos se dibujan con primitivas de canvas, no hay `public/games/sinapsis/`), así que cada literal pasó a ser un campo de la paleta, incluidos los **12 colores de glifo** (`palette.glyphs`, mismo orden que `GLYPH_DRAWERS`). El motor guarda `private currentSkin` + getter `palette`; `drawGlyphs`, `drawCursor`, `drawDeathFlash`, `drawHUD` y el fallback de fondo de `draw()` leen de ahí. La intensidad del glow no es una rama `if (skin === "neon")` sino cuatro campos numéricos de la paleta (`glyphBlurRevealed`, `glyphBlurMatched`, `cursorBlur`, `deathFlashBlur`), porque `classic` **ya tenía glow propio** (14/18/12/20) y había que conservarlo exacto. `setSkin()` regenera `boardCache` —el canvas offscreen donde están horneados fondo, marco, dorsos y patrón de circuito— y luego redibuja sincrónicamente (verificado en pausa). Selector compartido vía `GAME_REGISTRY.sinapsis.skins`.

| Rol         | classic                | neon                   | retro                  |
| ----------- | ---------------------- | ---------------------- | ---------------------- |
| background  | `#050510`              | `#06000f`              | `#0a0600`              |
| nodeBack    | `#12122a`              | `#12002b`              | `#1a1000`              |
| nodeBorder  | `#3a3a6a`              | `#c800ff`              | `#8a5200`              |
| circuitLine | `rgba(0,245,255,0.18)` | `rgba(255,0,110,0.22)` | `rgba(255,176,0,0.18)` |
| cursor      | `#00f5ff`              | `#f5ff00`              | `#ffd280`              |
| hudBg       | `#0a0a1a`              | `#0b0018`              | `#140c00`              |
| hudColor    | `#f0f0f0`              | `#00f5ff`              | `#ffb000`              |
| lifeOn      | `#00ff88`              | `#00ff88`              | `#ffb000`              |
| lifeOff     | `#2a2a44`              | `#2a0a3a`              | `#3d2900`              |
| deadFlash   | `#ef4444`              | `#ff006e`              | `#ff7b00`              |
| timerHigh   | `#4ade80`              | `#00ff88`              | `#ffb000`              |
| timerLow    | `#ef4444`              | `#ff006e`              | `#ff7b00`              |
| glifo 1     | `#00f5ff`              | `#00f5ff`              | `#ffb000`              |
| glifo 2     | `#ff006e`              | `#ff006e`              | `#ffb000`              |
| glifo 3     | `#f5ff00`              | `#f5ff00`              | `#ffb000`              |
| glifo 4     | `#00ff88`              | `#00ff88`              | `#ffb000`              |
| glifo 5     | `#b026ff`              | `#c800ff`              | `#ffb000`              |
| glifo 6     | `#ffb000`              | `#ff9d00`              | `#ffb000`              |
| glifo 7     | `#00bfff`              | `#2b7bff`              | `#ffb000`              |
| glifo 8     | `#ff4da6`              | `#ff2df5`              | `#ffb000`              |
| glifo 9     | `#adff2f`              | `#b6ff00`              | `#ffb000`              |
| glifo 10    | `#40e0d0`              | `#00ffd0`              | `#ffb000`              |
| glifo 11    | `#ff5a3c`              | `#ff3b1f`              | `#ffb000`              |
| glifo 12    | `#c792ea`              | `#d580ff`              | `#ffb000`              |
| glow        | 14 / 18 / 12 / 20      | 22 / 26 / 18 / 28      | 0 / 0 / 0 / 0          |

(la fila `glow` es `glyphBlurRevealed / glyphBlurMatched / cursorBlur / deathFlashBlur`)

**Estilo por skin:**

- `classic`: literales originales exactos (fondo `#050510`, dorsos `#12122a` con borde `#3a3a6a`, circuito cian al 18%, cursor cian con blur 12, flash de castigo `#ef4444` con blur 20, HUD `#f0f0f0` sobre `#0a0a1a`, barra de tiempo `#4ade80`/`#ef4444`, los 12 glifos con sus tonos originales). Sin scanlines.
- `neon`: dorsos violeta sobre negro púrpura, patrón de circuito magenta, cursor amarillo (contrasta contra el violeta del marco, que en esta skin ocupa el color cian que usaba el cursor), HUD cian y glifos con los tonos saturados alineados a los tokens del sitio (`--cyan`, `--magenta`, `--yellow`, `--green`, `#c800ff`). Todo el glow sube ~50%.
- `retro`: monocromo ámbar CRT (`#ffb000`) sobre negro cálido, sin glow, con scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px, buffer offscreen cacheado) dibujadas sobre el tablero pero **debajo** del HUD, para que score/capa/derivaciones y la barra de tiempo sigan legibles.

**Notas:** en `retro` los **12 glifos comparten el mismo ámbar a propósito**. La spec del juego exige que las formas sean distinguibles por silueta y no solo por color, así que el color nunca fue el discriminante de la mecánica de emparejado; un ramp de luminancia por glifo (como el de `arkanoid`) habría sido peor aquí, porque insinuaría una relación entre glifos de tono parecido que no existe. El cursor es la única excepción monocroma de `retro` (`#ffd280`, ámbar claro) para que el marco activo se distinga del borde de los dorsos. Se eligió ámbar y no verde fósforo porque `neon` ya usa `#00ff88` en vidas y barra de tiempo. Cero cambios de mecánica: ventanas de resolución (`MATCH_WINDOW_MS`/`MISS_WINDOW_MS`), reloj de ronda, dimensiones de rejilla, `cellRect`, cadena de puntuación y navegación del cursor quedaron intactos — el glow no altera nada porque el cursor se mueve por índice de celda, no por píxel. No se añadió ningún asset a `public/games/`.

## frogger

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/frogger/engine.ts`. Juego 100% procedural (no hay spritesheet ni `public/games/frogger/`), así que cada literal de color pasó a ser un campo de la paleta. El motor expone `private currentSkin` + getter `palette`; `zoneColor(row)`, `drawGoals`, `drawEntity`, `drawFrog`, `drawHUD` (incluida la barra de tiempo) y `drawOverlay` leen de ahí. El glow se centraliza en el helper `applySkinGlow(ctx, skin, color, blur)` (solo activo en `neon`); cada primitiva envuelve su dibujo en `save()/restore()` para no filtrar `shadowBlur`/`globalAlpha` entre entidades. `setSkin()` redibuja sincrónicamente (verificado en pausa). Selector compartido vía `GAME_REGISTRY.frogger.skins`.

| Rol              | classic           | neon                | retro               |
| ---------------- | ----------------- | ------------------- | ------------------- |
| zoneGoals        | `#123a12`         | `#12002b`           | `#3d2900`           |
| zoneRiver        | `#001b33`         | `#00121f`           | `#1f1400`           |
| zoneSafe         | `#0a2e0a`         | `#0b0026`           | `#2b1d00`           |
| zoneRoad         | `#000000`         | `#06000f`           | `#0a0600`           |
| goalBorder       | `#d4af00`         | `#f5ff00`           | `#ffb000`           |
| goalFilled       | `#4ade80`         | `#00ff88`           | `#ffb000`           |
| car              | `#ef4444`         | `#ff006e`           | `#ffb000`           |
| truck            | `#6b7280`         | `#c800ff`           | `#cc7a00`           |
| truckCab         | `#374151`         | `#7a00b0`           | `#8a5200`           |
| wheel            | `#111827`         | `#06000f`           | `#0a0600`           |
| log              | `#8b5a2b`         | `#f5ff00`           | `#cc7a00`           |
| logGrain         | `#5c3a1a`         | `#b0b800`           | `#0a0600`           |
| turtle           | `#16a34a`         | `#00f5ff`           | `#ffb000`           |
| frog             | `#22c55e`         | `#00ff88`           | `#ffb000`           |
| frogEye          | `#ffffff`         | `#f5ff00`           | `#0a0600`           |
| frogPupil        | `#000000`         | `#06000f`           | `#ffb000`           |
| hud              | `#f0f0f0`         | `#00f5ff`           | `#ffb000`           |
| timerHigh        | `#4ade80`         | `#00ff88`           | `#ffb000`           |
| timerMid         | `#facc15`         | `#f5ff00`           | `#cc7a00`           |
| timerLow         | `#ef4444`         | `#ff006e`           | `#8a5200`           |
| overlay backdrop | `rgba(0,0,0,0.6)` | `rgba(6,0,15,0.68)` | `rgba(10,6,0,0.68)` |
| overlay title    | `#f0f0f0`         | `#ff006e`           | `#ffb000`           |
| overlay sub      | `#f0f0f0`         | `#00f5ff`           | `#ffb000`           |

**Estilo por skin:**

- `classic`: literales originales exactos (río `#001b33`, troncos `#8b5a2b` con vetas `#5c3a1a`, tortugas `#16a34a`, rana `#22c55e` con ojos blancos, coches rojos y camiones grises, HUD `#f0f0f0`, barra de tiempo verde/amarillo/rojo). Sin glow ni scanlines.
- `neon`: `shadowBlur` en bocas de meta (10/14), vehículos (12), troncos (10), tortugas (12), rana (16), HUD (8), barra de tiempo (10) y overlay (18/10). Ruedas y cabina sin glow para que la silueta no se aplane. Colores alineados con los tokens del sitio (`--cyan`, `--magenta`, `--yellow`, `--green`).
- `retro`: monocromo ámbar CRT (`#ffb000`) sobre negro cálido, sin glow, con las zonas diferenciadas por luminancia ámbar (meta `#3d2900` > seguro `#2b1d00` > río `#1f1400` > carretera `#0a0600`) y scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px) dibujadas sobre el campo pero **debajo** del HUD y del overlay de game over.

**Notas:** en `retro` la distinción tronco/tortuga (crítica para la mecánica del río) no puede ser por tono, así que se separa por forma —el tronco ya era rectángulo con vetas y la tortuga círculo— y por dos escalones de ámbar (`#cc7a00` vs `#ffb000`); lo mismo con coche (`#ffb000`) vs camión (`#cc7a00` + cabina `#8a5200`). El fade de tortuga sumergida se mantiene idéntico (`globalAlpha 0.25`) en las 3 skins, porque es señal de mecánica, no de estilo. Ojo de la rana en `retro` invertido (ojo oscuro sobre cuerpo ámbar) para que siga leyéndose. Cero cambios de mecánica: velocidades de carril, `CELL`, colisiones por celda, deriva sobre soporte, temporizador de ronda y puntuación quedaron intactos — el glow de `neon` no altera hitboxes (las colisiones son por columna/fila, no por píxel dibujado). No se añadió ningún asset a `public/games/`.

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
