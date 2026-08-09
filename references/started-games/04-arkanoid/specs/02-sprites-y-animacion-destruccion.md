# 02 - Sprites de bloques/pala/bola y animación de destrucción

**Estado:** Implemented
**Depende de:** SPEC 01
**Fecha:** 2026-08-07

**Objetivo:** Sustituir el renderizado plano de bloques, pala y bola por los sprites del spritesheet existente, y reproducir una animación de explosión (frames por color) cuando un bloque se destruye.

## Alcance

**Incluye:**
- Cargar `assets/spritesheet.js` y `assets/spritesheet-breakout.png` desde `index.html`, esperando a que la imagen cargue antes de iniciar el bucle de juego.
- Asignar un color de `SPRITES.blocks` a cada fila de bloques, de arriba a abajo: `red`, `yellow`, `green`, `cyan`, `magenta`.
- Dibujar los bloques activos con `drawSprite`/`drawFrame` según su color, en vez de `fillRect`.
- Dibujar la pala con `SPRITES.paddle` y la bola con `SPRITES.ball`, en vez de `fillRect`/`arc`.
- Al destruirse un bloque, el bloque deja de colisionar y de dibujarse de inmediato (igual que hoy), y se lanza en su lugar una animación de explosión que recorre los 4 frames de `EXPLOSION_FRAMES[color]` durante `EXPLOSION_DURATION` (150ms), usando el color correspondiente a la fila del bloque destruido.
- Cuando la animación termina (pasan los 150ms), esa explosión desaparece del todo y no queda ningún rastro visual.
- El score se sigue sumando en el momento del impacto, igual que en el spec 01; la animación es puramente visual y no afecta al gameplay ni al HUD.

**No incluye (fuera de este spec):**
- Sonido de rotura (`assets/sounds/break-sound.mp3`) — queda para un spec futuro de audio.
- Cambiar la resistencia de los bloques, puntuación por color, o tipos especiales de bloque.
- Animaciones para la pérdida de vida, victoria o game over.
- Cualquier bloque que use el color `gray` — el mapeo de 5 filas solo usa `red, yellow, green, cyan, magenta`; `gray` y `hotpink` quedan sin usar en este spec.

## Modelo de datos

No se introduce persistencia. Se añaden/modifican estas estructuras en memoria dentro de `game.js`:

```js
// Cada brick generado por generateBricks() gana un campo `color`:
// { x, y, width, height, active, color }  // color ∈ 'red' | 'yellow' | 'green' | 'cyan' | 'magenta'

// Nuevo array para animaciones de explosión en curso:
// explosions: array de { x, y, width, height, color, startTime }
let explosions = [];
```

`startTime` se guarda con `performance.now()` en el momento de la destrucción. El frame a dibujar se calcula como:

```js
const elapsed = performance.now() - explosion.startTime;
const frameIndex = Math.min(3, Math.floor(elapsed / (EXPLOSION_DURATION / 4)));
```

La explosión se elimina del array `explosions` cuando `elapsed >= EXPLOSION_DURATION`.

## Plan de implementación

1. Añadir `<script src="assets/spritesheet.js">` en `index.html`, antes de `game.js`.
2. En `game.js`, llamar a `loadSpritesheet(cb)` al arrancar; hasta que `cb` se ejecute, el juego no entra en el bucle de render (se muestra un fondo negro simple). Una vez cargado, se llama a `loop()` como hoy.
3. Añadir el campo `color` a cada brick en `generateBricks()`, según la fila (`red, yellow, green, cyan, magenta`).
4. Cambiar `drawBricks()` para usar `drawSprite(ctx, 'block_' + brick.color, brick.x, brick.y, brick.width, brick.height)` en vez de `fillRect`.
5. Cambiar `drawPaddle()` y `drawBall()` para usar `drawSprite(ctx, 'paddle', ...)` y `drawSprite(ctx, 'ball', ...)` respectivamente.
6. En `checkBrickCollisions()`, cuando un brick se marca `active = false`, empujar un nuevo objeto a `explosions` con `{ x: brick.x, y: brick.y, width: brick.width, height: brick.height, color: brick.color, startTime: performance.now() }`.
7. Añadir una función `updateExplosions()` que elimine del array `explosions` las que ya superaron `EXPLOSION_DURATION`, y llamarla desde `update()`.
8. Añadir una función `drawExplosions()` que recorra `explosions` y dibuje el frame correspondiente con `drawFrame(ctx, EXPLOSION_FRAMES[color][frameIndex], x, y, width, height)`, llamada desde `draw()` justo después de `drawBricks()`.

Cada paso deja el juego ejecutable y verificable abriendo `index.html` en el navegador.

## Criterios de aceptación

- [x] Al abrir `index.html`, los bloques se ven con sprites de color (no rectángulos planos), agrupados en bandas: roja, amarilla, verde, cian y magenta de arriba a abajo.
- [x] La pala y la bola se dibujan usando los sprites del spritesheet.
- [x] Al destruir un bloque, en su lugar se reproduce una animación de 4 frames con el color de esa fila, durante ~150ms, y luego desaparece sin dejar rastro.
- [x] Mientras la animación de explosión se reproduce, la bola ya puede pasar por el hueco del bloque destruido (no bloquea físicamente).
- [x] El score sigue sumando 10 puntos por bloque en el momento del impacto, igual que antes.
- [x] El resto de comportamiento del spec 01 (vidas, pausa, victoria, game over, reinicio) sigue funcionando sin cambios.

## Decisiones tomadas y descartadas

- **Sprites por fila con paleta clásica (red/yellow/green/cyan/magenta):** se elige este orden por ser el patrón visual típico de Arkanoid/Breakout, aprovechando los 7 colores disponibles sin necesidad de definir más de 5 filas.
- **`gray` y `hotpink` sin usar:** se descartan para este spec al haber solo 5 filas; quedan disponibles para un spec futuro si se añaden más filas o tipos de bloque.
- **Física del bloque destruida al instante, animación solo visual encima:** se elige para no alterar el gameplay validado en el spec 01; la alternativa (bloquear hasta que termine la animación) se descarta por añadir latencia perceptible al rebote.
- **Sprites también para pala y bola:** se incluye en este spec (decisión del usuario) ya que de todas formas se carga el spritesheet; evita un segundo spec solo para dos sprites triviales.
- **Sonido de rotura excluido:** se mantiene la decisión del spec 01 de no incluir audio en esta etapa; se deja para un spec de audio futuro que también cubra `ball-bounce.mp3`.
- **Sin persistencia ni nuevas pantallas:** este spec es puramente de renderizado y feedback visual, no introduce estados nuevos de juego.
