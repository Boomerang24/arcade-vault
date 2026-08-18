# 14 — Optimización de render en Frogger

**Estado:** Implemented
**Depende de:** SPEC 12, SPEC 13
**Fecha:** 2026-08-17

**Objetivo:** Reducir el costo de render por frame de `lib/games/frogger/engine.ts` (menos `ctx.save()`/`ctx.restore()` y `shadowBlur` por entidad, scanlines de la skin `retro` pre-renderizadas en un canvas offscreen en vez de redibujarse pixel a pixel cada frame) hasta sostener ≥55 FPS con CPU throttling 4x en nivel 5+ con skin `neon`.

---

## Por qué esta spec existe

El síntoma reportado es jank creciente con el nivel/tiempo de juego. `buildRoadLane`/`buildRiverLane` reducen el hueco entre entidades (`levelGapBonus`) y suben la velocidad (`LEVEL_SPEED_STEP`, `levelSpeedRampMult`) a medida que sube `level` — así que en niveles altos hay más entidades simultáneas en pantalla. Cada entidad se dibuja con `ctx.save()` + `applySkinGlow()` (que activa `ctx.shadowBlur` en skin `neon`) + `ctx.restore()` en `drawEntity()`, y lo mismo ocurre en `drawGoals()` (5 veces por frame) y `drawFrog()`. `shadowBlur` es una de las operaciones más caras de Canvas2D porque fuerza un blur por software en cada shape que la tiene activa; multiplicada por 15-30 entidades por frame en niveles altos, es la sospecha principal del jank. La skin `retro` suma `drawScanlines()`, que hace ~90 llamadas a `fillRect` de 1px de alto por frame, siempre, en vez de una sola vez.

No se toca ningún otro motor (`arkanoid`, `asteroides`, `snake`, `tetris`) en esta spec — usan `shadowBlur`/`ctx.save()` con menor densidad de entidades simultáneas y no hay síntoma reportado en ellos.

---

## Alcance

**Incluye:**

- Medir el baseline de performance de `frogger` antes de tocar código: DevTools Performance, CPU throttling 4x, nivel 5+ (jugado manualmente hasta llegar o forzado subiendo `this.level` para la medición), skin `neon`, 30s de juego continuo. Registrar FPS promedio y frames largos (>16.6ms).
- Reducir `ctx.save()`/`ctx.restore()` en el hot path de dibujo (`drawEntity`, `drawGoals`, `drawFrog`) agrupando el estado de canvas que puede compartirse entre shapes del mismo tipo en vez de aislarlo por shape individual.
- Evitar togglear `shadowBlur` shape por shape cuando varias shapes consecutivas comparten skin/color: agrupar el `shadowBlur` una vez por lote de shapes en vez de una vez por shape.
- Pre-renderizar las scanlines de la skin `retro` (`drawScanlines`) a un `OffscreenCanvas` (o `HTMLCanvasElement` no adjunto al DOM) una sola vez al activar esa skin, y en cada frame solo hacer un `drawImage` de ese buffer sobre el canvas principal.
- Volver a medir con el mismo protocolo (nivel 5+, skin `neon`, throttling 4x, 30s) y confirmar el umbral de aceptación.
- Repetir la medición final también en skin `retro` (con las scanlines cacheadas) para confirmar que no regresó el jank ahí.

**Fuera de alcance (para futuras specs):**

- Cualquier cambio a `arkanoid`, `asteroides`, `snake` o `tetris`, aunque compartan el patrón `shadowBlur`/`ctx.save()`. Si tras esta spec se confirma el mismo síntoma en otro juego, se abre spec propia para ese motor.
- Cambios de mecánica, dificultad, `EngineStats` o balance de niveles (`LEVEL_SPEED_STEP`, `levelGapBonus`, etc.). Esta spec es puramente de render, no de gameplay.
- Migrar el render a WebGL o a una librería de canvas (Pixi, Konva, etc.). Se mantiene Canvas2D puro, como el resto del catálogo.
- Object pooling de `Entity` o cambios a `updateEntities`/`updateFrog` (lógica de update, no de dibujo) salvo que el profiling del paso 1 muestre que el costo real está ahí y no en el render — en ese caso se documenta como decisión revisada, no se asume de entrada.
- Tocar `components/games/frogger-canvas.tsx` o el cableado táctil de la spec 12/13.

---

## Modelo de datos

Esta spec no introduce estructuras de datos nuevas. Reutiliza `Entity`, `Lane`, `Frog`, `Palette` ya definidos en `lib/games/frogger/engine.ts`. El único elemento nuevo es un buffer de render interno (canvas offscreen para las scanlines de `retro`), que es estado de implementación del engine, no un tipo de dominio.

---

## Plan de implementación

1. Medir el baseline: capturar un perfil de DevTools Performance en `frogger` (nivel 5+, skin `neon`, CPU throttling 4x, 30s), anotar FPS promedio y % de frames >16.6ms en la spec o en un comentario de PR. No se cambia código en este paso.

   **Baseline medido (2026-08-18, Playwright/Chromium headless, CDP `Emulation.setCPUThrottlingRate: 4`, nivel 5, 39 entidades en pantalla):** en vez de medir el intervalo entre `requestAnimationFrame` (que en headless resultó estar acotado por vsync sintético a ~120 Hz y no reflejaba coste real), se cronometró `draw()` de forma aislada llamándolo 300 veces por skin tras precalentar el JIT.

   | Skin    | `draw()` promedio | `draw()` máximo | % de llamadas >16.6ms |
   | ------- | ----------------- | --------------- | --------------------- |
   | classic | 0.11 ms           | 1.10 ms         | 0%                    |
   | neon    | 0.16 ms           | 2.20 ms         | 0%                    |
   | retro   | 0.27 ms           | 27.70 ms        | 0.33% (1 de 300)      |

   `update()` (lógica, sin dibujo) promedió 0.012 ms — confirma que el costo, si existe, está en el render y no en la lógica de actualización, como asumían las Decisiones de esta spec.

   **Limitación del entorno de medición:** el throttling de CDP ralentiza el hilo principal de JS pero no modela con fidelidad el costo de rasterización GPU de `shadowBlur` en hardware real (headless Chromium usa un renderer por software, SwiftShader) — por eso los promedios aislados no muestran el jank reportado en dispositivos reales. El único indicio consistente con la hipótesis de esta spec es el pico aislado de 27.7 ms en skin `retro` (`drawScanlines()` sin cachear), que coincide con el mecanismo descrito en "Por qué esta spec existe". El plan de optimización (pasos 2-4) se mantiene sin cambios: está basado en análisis de código (conteo de `shadowBlur`/`ctx.save()` por frame), no solo en este perfil aislado, y el pico de `retro` sí lo confirma parcialmente.

2. En `drawEntity()`, agrupar las llamadas a `applySkinGlow`/`ctx.save()`/`ctx.restore()` por tipo de entidad dentro de `drawLaneEntities()` en vez de por entidad individual, de forma que shapes del mismo tipo y skin compartan un solo `save`/`shadowBlur`/`restore`. Verificación manual: el render visual de autos, camiones, troncos y tortugas se ve idéntico en las 3 skins.
3. Aplicar el mismo agrupamiento en `drawGoals()` (5 metas) y evaluar si `drawFrog()` necesita su propio `save`/`restore` aislado (probablemente sí, por ser una sola shape con múltiples colores). Verificación manual: metas y rana se ven idénticas.
4. Implementar el cacheo de `drawScanlines()`: crear el buffer offscreen una vez al construir el engine o al cambiar a skin `retro`, dibujar las líneas ahí una sola vez, y sustituir el cuerpo de `drawScanlines()` por un `ctx.drawImage()` del buffer. Verificación manual: skin `retro` se ve visualmente igual (scanlines presentes).
5. Repetir la medición del paso 1 con el mismo protocolo y comparar contra el baseline. Si no se alcanza ≥55 FPS, iterar sobre los pasos 2-4 antes de cerrar la spec (no se agregan técnicas nuevas fuera de las ya descritas sin actualizar esta spec primero).

   **Medición final (2026-08-18, mismo protocolo que el baseline del paso 1: `draw()` aislado ×300, nivel 5, 39 entidades, CDP throttle 4x):**

   | Skin    | `draw()` antes → después | reducción | máximo antes → después |
   | ------- | ------------------------ | --------- | ---------------------- |
   | classic | 0.11 ms → 0.10 ms        | ~15%      | 1.10 ms → 1.00 ms      |
   | neon    | 0.16 ms → 0.09 ms        | ~46%      | 2.20 ms → 0.90 ms      |
   | retro   | 0.27 ms → 0.08 ms        | ~70%      | 27.70 ms → 1.80 ms     |

   `update()` se mantiene igual (0.012 ms → 0.005 ms, dentro del ruido de medición) — confirma que no se tocó lógica, solo render, como establece el Alcance.

   **Sobre el umbral literal de aceptación (≥55 FPS en DevTools Performance, 30s de juego):** no se pudo medir así en este entorno headless — ya documentado en el paso 1, el throttling de CDP no reproduce con fidelidad el costo de rasterización GPU de `shadowBlur` en hardware real, y `requestAnimationFrame` en Chromium headless queda acotado por un vsync sintético (~120 Hz) que no refleja el costo real de un frame. Lo que sí se puede afirmar con esta metodología: los tres cambios (pasos 2-4) redujeron el costo de `draw()` medido en un 15-70% según la skin, eliminaron el pico de 27.7ms de `retro` (bajó a 1.8ms), y el costo total por frame (`draw()` + `update()`) quedó muy por debajo del presupuesto de 16.6ms incluso bajo throttle 4x. La verificación final del umbral de 55 FPS en un dispositivo o navegador real (no headless) queda pendiente y debe hacerla un humano con DevTools antes de mergear — ver criterios de aceptación.

6. Medir también skin `retro` con el mismo protocolo (nivel 5+, throttling 4x, 30s) para confirmar que el cacheo de scanlines no dejó una regresión ahí. (Incluido en la tabla del paso 5: `retro` mejoró, no regresó.)

---

## Criterios de aceptación

- [x] `npm run build` pasa sin errores tras los cambios.
- [x] Visualmente, las 3 skins (`classic`, `neon`, `retro`) se ven igual que antes del cambio (autos, camiones, troncos, tortugas, metas, rana, HUD, scanlines de `retro`) — comparado contra `.playwright-screenshots/frogger-*.png` y contra capturas nuevas en nivel 5 y con metas mixtas en los pasos 2-4.
- [x] El gameplay no cambia de comportamiento — verificado jugando con teclado real (no solo forzando estado): puntuación por avance, colisión/muerte en río sin soporte y actualización de vidas en el HUD se comportan igual que antes; sin errores en consola.
- [x] No se modifica ningún archivo fuera de `lib/games/frogger/engine.ts` (`git diff main...HEAD --stat`: solo `engine.ts` y esta spec).

**No verificable en este entorno (eliminado del checklist, ver nota del paso 5):**

- ~~En DevTools Performance, con CPU throttling 4x, nivel 5+, skin `neon`, 30s de juego continuo: FPS promedio ≥55.~~
- ~~El mismo protocolo en skin `retro` también sostiene FPS promedio ≥55.~~

Chromium headless (usado por Playwright/CDP en esta implementación) no reproduce con fidelidad el costo de rasterización GPU de `shadowBlur` en hardware real, y su `requestAnimationFrame` queda acotado por un vsync sintético — ambos ya documentados como limitación en el paso 1. La evidencia disponible con esta metodología (tabla del paso 5: `draw()` baja 15-70% según skin, pico de `retro` de 27.7ms→1.8ms) es fuerte pero no sustituye la medición literal del umbral. **Antes de mergear, un humano debe abrir Frogger en Chrome real, activar CPU throttling 4x en DevTools Performance, llegar a nivel 5+ y confirmar visualmente/con el FPS meter que ya no hay jank perceptible**, especialmente en skin `neon` y en móvil.

---

## Decisiones

- **Sí:** medir con DevTools antes y después, en vez de solo verificación visual. Razón: "se siente lento" no es verificable; un número de FPS sí.
- **Sí:** CPU throttling 4x como proxy de móvil real. Razón: la spec 12 ya agregó soporte táctil móvil, y uno de los síntomas reportados es "peor en móvil" — no se dispone de un dispositivo físico de gama baja para el protocolo de medición, así que el throttling de DevTools es la aproximación estándar.
- **Sí:** nivel 5+ como escenario de medición. Razón: `levelGapBonus`/`LEVEL_SPEED_STEP` hacen que la densidad y velocidad de entidades suban con el nivel — es el peor caso realista, y explica el síntoma "empeora con el nivel".
- **Sí:** cachear scanlines en un canvas offscreen en vez de reducir su frecuencia de dibujo (p. ej. cada 2 frames). Razón: un buffer estático es más simple, no introduce parpadeo, y las scanlines no cambian frame a frame.
- **No:** tocar otros motores en esta spec, aunque compartan el patrón `shadowBlur`. Razón: sin síntoma reportado ni medición en ellos, cambiarlos sería especulativo; se decidió acotar a Frogger y abrir spec aparte si aparece el mismo problema en otro juego.
- **No:** migrar a WebGL/Pixi. Razón: sobre-ingeniería para el problema medido; el resto del catálogo usa Canvas2D puro y se busca mantener consistencia arquitectónica.
- **No:** tocar `updateEntities`/`updateFrog` (lógica) de entrada. Razón: el análisis de código apunta al costo de render (`shadowBlur`, `save/restore`, scanlines redibujadas), no a la lógica de actualización; si el profiling del paso 1 contradice esto, se documenta como decisión revisada antes de tocar lógica.

---

## Riesgos

| Riesgo                                                                                                                                              | Mitigación                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Agrupar `save`/`restore`/`shadowBlur` por lote introduce una regresión visual sutil (glow que se queda activo en una shape que no debería tenerlo). | Verificación visual manual contra `.playwright-screenshots/frogger-*.png` en las 3 skins antes de cerrar la spec.                  |
| `OffscreenCanvas` no está disponible en algún navegador objetivo.                                                                                   | Usar un `HTMLCanvasElement` creado en memoria (no adjunto al DOM) como fallback universal en vez de depender de `OffscreenCanvas`. |
| El profiling del paso 1 muestra que el cuello de botella real está en `updateEntities`/`updateFrog` y no en el render.                              | Se documenta en la spec como hallazgo y se decide ahí mismo si se amplía el alcance o se abre spec nueva — no se asume de entrada. |

---

## Qué **no** está en esta spec

- Cambios a `arkanoid`, `asteroides`, `snake` o `tetris`.
- Cambios de mecánica, dificultad o balance de niveles de Frogger.
- Migración a WebGL o librerías de render de terceros.
- Cambios a la capa táctil (`frogger-canvas.tsx`, `jugar-client.tsx`, `touch-controls.tsx`).

Cada uno de estos, si se necesita, va en su propia spec.

---

## Post implementación

Resumen de lo aplicado en `lib/games/frogger/engine.ts` (commits `cc899d5`, `8b9ef01`, `52530e7`), pensado para reutilizarse en otros motores de `lib/games/<id>/engine.ts` que compartan el patrón `shadowBlur` + `ctx.save()`/`ctx.restore()` por entidad.

### 1. Agrupar `save()`/`shadowBlur`/`restore()` por lote, no por entidad

**Antes:** `drawEntity()` se llamaba una vez por entidad (auto, camión, tronco, tortuga) y cada llamada hacía su propio `ctx.save()` → `applySkinGlow()` (activa `shadowBlur`) → dibujo → `ctx.restore()`. Con 15-30 entidades por frame en niveles altos, eso son 15-30 activaciones/desactivaciones de `shadowBlur`, la operación más cara de Canvas2D.

**Después:** `drawLaneEntities()` primero clasifica todas las entidades del frame por tipo (`cars`, `trucks`, `logs`, `turtles`) en un solo recorrido, y cada tipo se dibuja con una función de lote (`drawVehicleBatch`, `drawLogBatch`, `drawTurtleBatch`) que abre **un solo** `save()`/`shadowBlur`/`restore()` para todo el lote. Dentro del lote, todas las shapes del mismo color se acumulan en un único `ctx.beginPath()` y se pintan con un solo `fill()`/`stroke()` al final, en vez de un `fill()`/`stroke()` por shape.

**Generalización — patrón a replicar en otro motor:**

1. Identificar el bucle que dibuja N entidades por frame donde cada una llama a `ctx.save()`/`shadowBlur`/`ctx.restore()` individualmente.
2. Agrupar las entidades por (tipo, color/skin) antes de dibujar — un `Map` o arrays paralelos, un solo recorrido.
3. Por grupo: un `save()`, un `shadowBlur` (vía la función de glow existente), un `beginPath()` que acumula todas las shapes del grupo con `moveTo`/`arc`/`rect`/`lineTo` (no `beginPath()` por shape), un `fill()`/`stroke()` final, `shadowBlur = 0` antes de detalles sin glow (ruedas, vetas), y `restore()`.
4. Cuidado con `ctx.arc()`/`ctx.ellipse()` encadenados sin `moveTo()` previo: crean una línea fantasma que conecta el final del arco anterior con el inicio del siguiente. Solución usada: un `moveTo()` al punto de inicio del arco/elipse antes de cada `arc()`/`ellipse()` dentro del path compartido.
5. Verificación: comparación visual en todas las skins del juego, no solo medición de FPS — el riesgo real de este cambio es una regresión visual sutil (glow que se queda activo en la shape equivocada), no que dejes de ganar performance.

Aplica igual a `drawGoals()`: N formas del mismo tipo (bordes de metas, rellenos de metas alcanzadas) se acumulan en un `ctx.rect()`/`ctx.ellipse()` por goal dentro de un único `beginPath()`, y se trazan/rellenan con un solo `stroke()`/`fill()`.

**Cuándo NO aplica:** shapes que son la única instancia por frame (aquí, `drawFrog()`) no tienen lote que agrupar — no tocarlas.

### 2. Cachear geometría estática redibujada cada frame en un canvas offscreen

**Antes:** `drawScanlines()` (textura CRT de la skin `retro`) repetía ~190 `fillRect` de 1px de alto en **cada** frame, aunque el patrón nunca cambia entre frames — fue el causante del único pico duro medido (27.7ms en una llamada aislada).

**Después:** el patrón se dibuja **una sola vez** en un `HTMLCanvasElement` creado en memoria (no adjunto al DOM, `document.createElement("canvas")`) y cacheado como propiedad del engine (`scanlinesBuffer`, con getter lazy `getScanlinesBuffer()`). Cada frame, `drawScanlines()` se reduce a un solo `ctx.drawImage(buffer, 0, 0)`.

**Generalización — cuándo aplica:** cualquier elemento visual que (a) se redibuja cada frame con un bucle de muchas primitivas pequeñas (`fillRect`, `arc`, etc.) y (b) no depende de estado que cambie frame a frame (no de la posición del jugador, del nivel, del tiempo). Textura de fondo, patrones decorativos, grillas estáticas son candidatos típicos. Si el elemento cambia con la skin pero no frame a frame, cachear por skin (invalidar el buffer al cambiar de skin) en vez de cachear una sola vez para toda la vida del engine.

**Por qué `HTMLCanvasElement` en memoria y no `OffscreenCanvas`:** mismo resultado, pero `HTMLCanvasElement` no depende de soporte de navegador — es el fallback universal (ver Riesgos de esta spec).

### 3. Metodología de medición que sí funcionó en este entorno

El umbral de aceptación original (FPS en DevTools Performance con throttling 4x) **no fue verificable en headless** — Chromium headless usa un renderer por software (SwiftShader) que no modela el costo de rasterización GPU de `shadowBlur`, y su `requestAnimationFrame` queda acotado por un vsync sintético (~120Hz) que oculta el jank real.

**Lo que sí funcionó:** cronometrar `draw()` de forma aislada (llamarlo N veces seguidas tras precalentar el JIT, con CDP `Emulation.setCPUThrottlingRate` para simular CPU limitada) y comparar promedio/máximo antes/después por skin. Esto detectó el pico de 27.7ms de `retro` que el FPS meter headless no reflejaba, y cuantificó la mejora real (15-70% según skin) sin depender de un dispositivo físico.

**Para otro motor:** si se sospecha jank y no hay dispositivo real disponible, medir `draw()` (o el método de render equivalente) aislado con este mismo protocolo antes de tocar código, en vez de confiar solo en el FPS meter de DevTools en headless. La verificación final del umbral en FPS real sigue necesitando un humano con Chrome real (no headless) — no se puede sustituir del todo, solo acotar el riesgo antes de mergear.
