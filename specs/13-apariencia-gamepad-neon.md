# 13 — Apariencia gamepad neón

**Estado:** Implemented
**Depende de:** SPEC 12
**Fecha:** 2026-08-17

**Objetivo:** Refinar la apariencia visual de `TouchControls` (D-pad + botones de acción) para igualar el look del componente de referencia `references/gamepad-assets/` (panel contenedor tipo tarjeta, D-pad con hub central y gema pulsante, flechas SVG unificadas, glow intensificado al presionar), sin tocar la lógica de eventos táctiles, el registro de juegos ni ningún otro componente.

## Alcance

**Incluye:**

- **Panel contenedor único.** `.touch-controls` pasa de ser un contenedor transparente a una tarjeta con: fondo degradado oscuro (`linear-gradient(180deg, #1c1c28, #0c0c14)` o equivalente con tokens ya existentes del tema), borde sutil (`rgba(0,245,255,0.18)`), `border-radius`, doble borde interno (pseudo-elemento `::before` con `inset` + borde tenue, igual que `.gp::before` en la referencia), textura de puntos de fondo (pseudo-elemento `::after` con `radial-gradient` de puntos de 1px, igual que `.gp::after`), y sombra/glow exterior (`box-shadow` con blur cyan). El panel envuelve tanto el D-pad como el grupo de botones de acción — layout interno (`gp-body`: dos columnas, D-pad a la izquierda y acciones a la derecha) igual a la referencia.
- **D-pad con hub central.** Se agrega un elemento central (`.touch-dpad-hub`) en la celda `grid-column: 2; grid-row: 2` del grid 3×3 (hoy vacía), con fondo radial oscuro, borde cyan tenue, y una "gema" central (rombo `clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)`) en color cyan con `box-shadow` de glow y animación de pulso (`@keyframes` opacidad/escala, igual a `pulse-led` de la referencia). Es puramente decorativo (`aria-hidden`), no captura eventos.
- **Flechas del D-pad como SVG.** Se reemplaza el glifo de texto rotado (`▲` + `transform: rotate()`) por un único `<svg>` triangular inline (`viewBox="0 0 24 24"`, `<path>` con `fill="currentColor"`) reutilizado en los 4 botones, rotado por CSS igual que hoy (`0°/90°/180°/-90°`), manteniendo el enfoque "un solo glifo, 4 rotaciones" ya validado en spec 12 — el cambio es la forma del glifo (SVG en vez de carácter Unicode), no el mecanismo de rotación.
- **Glow intensificado en estado presionado (`.on`/`:active`).** Los botones del D-pad y de acción ganan, al presionar, un `box-shadow` más intenso (`inset` + `0 0 Npx` con el color del token correspondiente) y la flecha/etiqueta gana `filter: drop-shadow(...)` con el mismo color, igualando el efecto de "encendido" de `.dp.on`/`.ab.on` de la referencia. El comportamiento de qué clase se activa (ya sea `:active`/`:hover` vía CSS puro, sin nuevo estado de React) se mantiene — no se introduce una clase `.on` gestionada por JS; se usa `:active` de CSS, que ya cubre press-and-hold visualmente durante el tiempo que el botón permanece presionado.
- **Botones de acción con anillo punteado al presionar.** Se agrega un pseudo-elemento o `<span>` decorativo (`.touch-action-ring`) con borde punteado (`border: 1px dashed currentColor`) que aparece con `opacity`/`scale` al presionar (`:active`), igual al `.ab-ring` de la referencia — puramente decorativo, no afecta el hit-target del botón (el botón conserva su tamaño actual, el anillo se dibuja fuera de sus límites con `inset` negativo).
- **Etiquetas de acción se mantienen** ("DISPARAR", "CAER"), con el mismo tratamiento tipográfico (`--mono`) ya definido en spec 12 — solo se ajusta su `text-shadow`/glow para que combine con el nuevo fondo radial del botón.
- **Colores por posición se mantienen**: primer botón de acción cyan, segundo magenta (ya definido en spec 12 vía `:nth-child`), ahora aplicados también al fondo radial (`radial-gradient` con el tono correspondiente) del botón, no solo al borde.
- Verificación visual en los 4 juegos del catálogo (`asteroides`, `tetris`, `arkanoid`, `snake`) en viewport táctil simulado (375px), comparando contra `references/gamepad-assets/gamepad-neon.png`.

**No incluye (fuera de alcance):**

- Cambios a la lógica de eventos táctiles (`dispatchKey`, `startPress`/`stopPress`, repeat de 300ms/80ms) en `touch-controls.tsx` — se mantiene intacta tal como la dejó spec 12.
- Cambios a `lib/games/registry.ts`, `TouchAction`, o el mapeo de acciones por juego — ningún juego gana ni pierde botones de acción.
- Cambios a `mobile-footer.tsx`, `jugar-client.tsx`, `Nav`, o el escalado responsive del canvas — esta spec es exclusiva del componente `TouchControls` y sus estilos asociados.
- Cambios a `drawHUD()` de ningún motor, ni a `EngineStats`.
- Soporte de teclado físico (`gamepad.html` de referencia también soporta flechas/WASD/Z/X vía `keydown` global) — el catálogo ya tiene su propio manejo de teclado por motor desde antes de spec 12; no se toca.
- Fuentes de Google Fonts nuevas — el proyecto ya usa `--pixel`/`--mono` equivalentes a las de la referencia (`Press Start 2P`/`JetBrains Mono`); no se agregan imports nuevos.

## Modelo de datos

No se introduce ningún tipo, tabla ni prop nueva. `TouchControlsProps` (`actions`, `directions`) no cambia — este es un refinamiento puramente visual (JSX/markup decorativo + CSS) sobre el componente y los selectores ya existentes:

```tsx
// components/games/touch-controls.tsx — nuevos elementos puramente decorativos, sin nuevas props
<div className="touch-controls">
  <div className="touch-dpad">
    {/* 4 botones existentes, ahora con <svg> en vez de <span> de texto */}
    <div className="touch-dpad-hub" aria-hidden="true">
      <span className="touch-dpad-hub-gem" />
    </div>
  </div>
  {actions.length > 0 && (
    <div className="touch-actions">
      {/* botones existentes, cada uno gana un <span className="touch-action-ring" aria-hidden /> */}
    </div>
  )}
</div>
```

Clases CSS nuevas en `app/globals.css`: `.touch-controls::before`, `.touch-controls::after` (panel/textura), `.touch-dpad-hub`, `.touch-dpad-hub-gem` (+ `@keyframes` de pulso), `.touch-dpad-arrow-svg` (reemplaza el uso de `.touch-dpad-arrow` como contenedor de texto), `.touch-action-ring`. Las clases existentes (`.touch-controls`, `.touch-dpad`, `.touch-dpad button`, `.touch-action-btn`, `.touch-actions`) se modifican in-place (fondo, sombra, `:active`) sin cambiar su rol estructural en el grid/flex actual.

## Plan de implementación

1. **Panel contenedor de `.touch-controls`.** En `app/globals.css`, agregar fondo degradado, borde, `border-radius`, padding, `box-shadow` exterior, y los pseudo-elementos `::before`/`::after` (doble borde + textura de puntos) al selector `.touch-controls`, replicando `.gp`/`.gp::before`/`.gp::after` de `references/gamepad-assets/gamepad.html`. Verificación: en viewport táctil, el bloque de controles se ve como una tarjeta con borde y textura, no como fondo transparente.
2. **Hub central del D-pad.** Agregar el `div.touch-dpad-hub` (con `span.touch-dpad-hub-gem` dentro) en el JSX de `touch-controls.tsx`, posicionado en `grid-column: 2; grid-row: 2` vía CSS, con el `@keyframes` de pulso. Verificación: el centro del D-pad muestra un rombo cyan pulsante, sin interferir con el clic de los 4 botones de flecha alrededor.
3. **Flechas SVG.** Reemplazar el `<span className="touch-dpad-arrow">▲</span>` por un `<svg>` inline (triángulo, `viewBox="0 0 24 24"`) en los 4 botones del D-pad, manteniendo las clases de rotación (`touch-dpad-arrow-left/right/down`) ahora aplicadas al `<svg>`. Verificación: las 4 flechas se ven proporcionalmente idénticas (mismo criterio que ya exigía spec 12), ahora con trazo SVG en vez de glifo de fuente.
4. **Glow en estado presionado.** En `app/globals.css`, agregar reglas `:active`/`:hover` a `.touch-dpad button` y `.touch-action-btn` con `box-shadow`/`filter: drop-shadow(...)` intensificado usando los tokens `--cyan`/`--magenta` ya existentes. Verificación: al mantener presionado (mouse o touch simulado) un botón, se ve un glow visiblemente más intenso que el estado en reposo, en los 4 juegos.
5. **Anillo punteado en botones de acción.** Agregar `span.touch-action-ring` en el JSX de cada botón de acción en `touch-controls.tsx`, con estilos `border: 1px dashed currentColor`, `opacity: 0` en reposo y `opacity: 1`/`transform: scale(...)` en `:active`, posicionado con `inset` negativo respecto al botón padre. Verificación: al presionar el botón de acción (Asteroides/Tetris), aparece el anillo punteado alrededor sin desplazar el layout ni agrandar el hit-target real.
6. **Ajuste de color de fondo radial en botones de acción.** Cambiar el `background` de `.touch-action-btn` de sólido a `radial-gradient` con los tonos cyan/magenta correspondientes por posición (`:nth-child(1)`/`:nth-child(2)`), conservando la etiqueta de texto y su glow. Verificación: los botones de acción se ven con volumen esférico similar a la referencia, en vez de plano.
7. **Verificación en navegador (los 4 juegos).** Con DevTools en modo touch-simulation en viewport 375×667: comparar visualmente `asteroides`, `tetris`, `arkanoid`, `snake` contra `gamepad-neon.png` — panel/borde/textura visibles, hub central pulsante, flechas SVG uniformes, glow intensificado al presionar, anillo punteado en botones de acción, etiquetas descriptivas legibles. Confirmar que el D-pad y los botones de acción siguen disparando los mismos `KeyboardEvent` que antes (sin regresión funcional respecto a spec 12) y que `npm run build` pasa sin errores.

## Criterios de aceptación

- [ ] En viewport táctil, `.touch-controls` se ve como un panel con borde, fondo degradado, textura de puntos y sombra exterior, igual que `gamepad-neon.png`, en los 4 juegos del catálogo.
- [ ] El D-pad muestra un hub central con una gema en forma de rombo, con animación de pulso, sin bloquear ni desplazar los 4 botones de flecha que lo rodean.
- [ ] Las 4 flechas del D-pad son SVG (no glifos de texto), visualmente uniformes entre sí, rotadas correctamente en sus 4 direcciones.
- [ ] Al mantener presionado un botón del D-pad o de acción (mouse o touch), el glow se intensifica visiblemente respecto al estado en reposo.
- [ ] Al presionar un botón de acción, aparece un anillo punteado alrededor que desaparece al soltar.
- [ ] Las etiquetas "DISPARAR" (Asteroides) y "CAER" (Tetris) se siguen mostrando dentro de sus botones circulares, legibles, sin desbordar.
- [ ] Arkanoid y Snake (0 botones de acción) muestran el panel y el D-pad sin el grupo de acciones, sin espacio vacío incorrecto.
- [ ] La lógica de eventos táctiles no cambia: presionar cada control sigue disparando el mismo `KeyboardEvent`/`code` que antes de esta spec, verificable jugando los 4 juegos.
- [ ] `lib/games/registry.ts`, `mobile-footer.tsx`, `jugar-client.tsx` y los 4 `engine.ts` no se modifican.
- [ ] En desktop (sin `pointer: coarse`), `.touch-controls` sigue sin renderizarse, igual que antes de esta spec.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Solo se toca `components/games/touch-controls.tsx` y `app/globals.css`.** Confirmado explícitamente por el usuario: el refinamiento es puramente visual, no requiere tocar `mobile-footer.tsx`, `jugar-client.tsx`, `lib/games/registry.ts` ni ningún `engine.ts`. Evita reabrir el alcance funcional ya cerrado y verificado en spec 12.
- **Se mantienen las etiquetas descriptivas ("DISPARAR"/"CAER") en vez de letras A/B.** La referencia usa letras únicas por ser un mockup genérico de gamepad, pero spec 12 ya había decidido explícitamente usar etiquetas descriptivas por usabilidad (el jugador ve qué hace cada botón sin adivinar). Esta spec prioriza esa decisión previa sobre la fidelidad visual literal a la referencia en ese punto puntual.
- **Panel único envolviendo D-pad + acciones, en vez de fondos separados por grupo.** Decisión explícita del usuario, replicando fielmente `.gp` de la referencia (un solo contenedor con borde/textura/glow), en vez de mantener el fondo transparente actual de spec 12.
- **El `:active`/`:hover` de CSS reemplaza la necesidad de una clase `.on` gestionada por JS.** La referencia (`gamepad.html`) usa una clase `.on` añadida/removida por JS junto con `:active` porque su demo standalone también responde a teclado. En este proyecto, `touch-controls.tsx` no necesita reflejar el estado de teclado físico en su propio UI (los botones son solo emisores, no indicadores del estado del motor), así que `:active` de CSS puro basta para el feedback visual de "presionado" sin agregar estado de React nuevo — coherente con la decisión de spec 12 de no tocar la lógica de eventos.
- **Flechas SVG en vez de glifo de texto, pero manteniendo el mecanismo de "un solo glifo rotado por CSS" de spec 12.** Se cambia el tipo de glifo (SVG en vez de carácter Unicode) para igualar visualmente a la referencia, pero se conserva la técnica de reutilizar una sola forma con 4 rotaciones — ya validada en spec 12 como solución al problema de flechas con métricas de fuente inconsistentes.
- **Botones de acción con `radial-gradient` en el fondo, en vez de fondo sólido.** Iguala el volumen esférico de `.ab` en la referencia; se mantienen los mismos tokens de color (`--cyan`/`--magenta`) ya usados por posición desde spec 12, sin introducir una paleta nueva.
