# 16 — SINAPSIS: MODO SOBRECARGA (Mecánicas)

**Estado:** Draft
**Depende de:** SPEC 15
**Fecha:** 2026-08-20

**Objetivo:** Añadir a SINAPSIS una segunda variante jugable, **MODO SOBRECARGA** — la corteza se reorganiza sola, aparecen impulsos corruptos y el jugador dispone de un pulso de diagnóstico — seleccionable desde una pantalla de arranque dentro del canvas, más audio generado por Web Audio y efectos visuales de impacto, todo dentro del motor ya existente y sin tocar el contrato `EngineStats`.

## Alcance

**Incluye:**

- **Pantalla de arranque dentro del canvas.** Al montar el motor y tras cada `reset()`, SINAPSIS entra en una fase de arranque: el tablero se dibuja ya repartido pero con todos los nodos `hidden`, el reloj de la ronda **no corre**, y sobre el tablero se muestra un panel con el modo seleccionado y las instrucciones (`ESPACIO — INICIAR`, `M — CAMBIAR MODO`, `S — SILENCIO`). La primera pulsación de `Space` arranca la partida: el reloj empieza a correr y esa misma pulsación **no** sondea ningún nodo.
- **Selector de modo.** La tecla `M` alterna entre `CLÁSICO` y `SOBRECARGA` **solo durante la fase de arranque**; una vez iniciada la partida, `M` es un no-op (no se cambia de modo a mitad de partida). El modo por defecto es `CLÁSICO`, de modo que quien no toque nada juega exactamente la variante de la SPEC 15. El modo elegido persiste entre partidas de la misma sesión de canvas (tras `reset()` la fase de arranque conserva el último modo elegido).
- **MODO SOBRECARGA — twist 1: reflujo sináptico (barajado en caliente).** Cada `max(6, 14 - level)` segundos, dos parejas de nodos **aún ocultos** intercambian posiciones. El intercambio se anima como un deslizamiento cruzado de 400ms sobre la rejilla, con estela, para que el jugador pueda seguir con la vista a dónde va cada nodo si está atento. Reglas:
  - Los nodos `matched` **nunca** se mueven.
  - Un nodo `revealed` de la jugada en curso nunca se mueve.
  - Si quedan menos de 4 nodos ocultos, el reflujo se salta ese ciclo.
  - Durante la animación, el sondeo se acepta con normalidad sobre nodos quietos; sondear un nodo en movimiento se ignora (no-op).
- **MODO SOBRECARGA — twist 2: impulsos corruptos (virus).** A partir del nivel 2, cada capa incluye **un par extra** de un glifo 13 exclusivo del modo (aspa corrupta, dibujada con el mismo criterio de primitivas y en rojo). La rejilla crece en 2 celdas respecto a la tabla de la SPEC 15 cuando ello no rompe el layout, y cuando ya está en el tope de 6×4 el par corrupto **sustituye** a un par normal (11 pares normales + 1 par corrupto). Emparejar los dos nodos corruptos:
  - **No** cuenta como sinapsis estable ni acerca a completar la capa.
  - Resta 200 puntos (mínimo 0, la puntuación nunca baja de cero).
  - Quema una derivación (`lives -= 1`) y dispara la ventana `"dead"` de 700ms, igual que un fallo normal.
  - Tras la ventana, ambos nodos vuelven a `hidden` y **se reubican** en dos celdas ocultas aleatorias distintas de las que ocupaban.
  - La capa se completa cuando todos los pares **no corruptos** están resueltos; el par corrupto queda sin resolver y se pierde con el cambio de capa.
- **MODO SOBRECARGA — twist 3: pulso de diagnóstico (power-up).** Cada 3 aciertos consecutivos (cadena múltiplo de 3) el jugador gana una carga de pulso, con tope de **1 carga almacenada**. La tecla `X` gasta la carga y revela **todos** los nodos ocultos del tablero durante 900ms, con un barrido visual de arriba a abajo. Durante el pulso el sondeo sigue permitido (esa es toda la gracia: memorizar y encadenar). Un fallo reinicia la cadena pero **no** consume la carga ya ganada. Pulsar `X` sin carga es un no-op silencioso.
- **MODO SOBRECARGA — puntuación.** Todas las sumas de la SPEC 15 (par, bonus de cadena, bonus de capa) se multiplican por **1.5** y se truncan a entero, como compensación del riesgo añadido. La resta de 200 por par corrupto se aplica **después** del multiplicador, sin escalar.
- **Audio generado con Web Audio API**, sin ningún asset externo, mismo patrón que ya usa Tetris:
  - `AudioContext` creado **de forma perezosa en el primer evento de teclado real** (política de autoplay de los navegadores), no en el constructor.
  - Sonidos: sonda (blip corto), acierto (arpegio ascendente de dos notas), fallo/corrupto (ruido descendente), reflujo (barrido de sierra), pulso de diagnóstico (sweep ascendente), subida de capa (fanfarria de cuatro notas), game over (descenso largo), y tic de reloj en los últimos 5 segundos de la ronda.
  - Tecla `S` alterna silencio, en cualquier momento de la partida, con indicador visible en el HUD. El estado de silencio persiste entre partidas de la misma sesión de canvas.
  - Todos los osciladores se detienen en `pause()` y en `destroy()`; `destroy()` cierra el `AudioContext`.
- **Efectos visuales de impacto** (ambos modos, salvo donde se indique):
  - Partículas de chispa al formar una sinapsis estable (12 partículas radiales que se desvanecen en ~400ms).
  - Sacudida corta del tablero (±3px, 200ms) y flash rojo del marco al quemar una derivación.
  - Estela de deslizamiento durante el reflujo (solo SOBRECARGA).
  - Barrido luminoso vertical durante el pulso de diagnóstico (solo SOBRECARGA).
  - Parpadeo del reloj del HUD en rojo durante los últimos 5 segundos de la ronda.
  - Todas las partículas se acumulan en un único array con cota máxima (128 partículas vivas; las más antiguas se descartan) y se dibujan en un solo lote `save()`/`restore()`, siguiendo los patrones de render generalizados por la spec 14.
- Ajuste de `short`/`long` de la fila `sinapsis` en `games` (vía `mcp__supabase__apply_migration`, migración `update_game_sinapsis_modos`) para mencionar los dos modos. Es el único cambio permitido a la fila.
- HUD interno ampliado: indicador de modo (`CLÁSICO` / `SOBRECARGA`), icono de carga de pulso disponible, e indicador de silencio.

**No incluye (fuera de alcance):**

- Cualquier cambio a `EngineStats`, `EngineCallbacks`, `GameCanvasProps` o `GameEngineHandle`. El modo, la carga de pulso y el silencio son estado **interno** del motor y viajan al HUD solo por lo que se dibuja dentro del canvas — nunca por campos nuevos del contrato.
- Cualquier cambio a `lib/games/registry.ts` más allá de lo ya hecho en la SPEC 15: la entrada `sinapsis` sigue siendo una línea y **no** se le añaden `skins` ni `touchActions` aquí.
- Cualquier cambio a `components/jugar-client.tsx`. El selector de modo vive **dentro del canvas**, no en la UI de React, precisamente para no abrir una rama específica de este juego en la play-page.
- Leaderboards separados por modo, o columna nueva en `scores` — ver Decisiones.
- Skins (`@skin-designer`) y controles táctiles (`@mobile-porter`): siguen fuera, en sus subagentes.
- Cambios a `asteroides`, `tetris`, `arkanoid`, `snake` o `frogger`.
- Assets binarios de audio (`.mp3`, `.wav`) o de imagen. Todo se genera en runtime.

## Modelo de datos

El contrato externo **no cambia**: `SinapsisEngine` conserva la misma firma de constructor y los mismos `pause/resume/reset/forceGameOver/destroy` definidos en la SPEC 15, y `components/games/sinapsis-canvas.tsx` no se modifica en absoluto. Todo lo de esta spec vive dentro de `lib/games/sinapsis/engine.ts`.

Estado interno añadido (referencia para la implementación, no expuesto al exterior):

```ts
type Mode = "classic" | "overload";
type Phase = "boot" | "running"; // "boot" = pantalla de arranque, reloj congelado

// añadido al estado del motor:
// mode: Mode                  — persiste entre reset()
// phase: Phase
// muted: boolean              — persiste entre reset()
// pulseCharges: 0 | 1         — carga de diagnóstico almacenada
// pulseMs: number             — ms restantes del revelado por diagnóstico (0 = inactivo)
// refluxMs: number            — ms hasta el próximo reflujo
// swaps: { a: number; b: number; t: number }[] — intercambios en curso (t = 0..1)
// particles: { x, y, vx, vy, life, color }[]   — cota máxima 128
// shakeMs: number             — sacudida del tablero pendiente
// audio: { ctx: AudioContext | null; ... }     — creado en el primer keydown real
```

Reglas de mapeo (sin cambios respecto a la SPEC 15, se listan solo las que esta spec toca):

- `score`: sigue siendo la puntuación acumulada. En SOBRECARGA incorpora el multiplicador ×1.5 y la penalización de −200 por par corrupto, con piso en 0. **No** se marca de ninguna forma en `scores` que la partida fuera de un modo u otro.
- `lives`: sigue siendo las derivaciones (5). El par corrupto consume una, exactamente igual que un fallo normal.
- `level`: sin cambios de semántica; en SOBRECARGA la cuenta de pares pendientes para completar la capa **excluye** el par corrupto.
- `state`: sin cambios. Durante `phase: "boot"` el motor reporta `"playing"` con `score: 0`, `lives: 5`, `level: 1` — no existe un estado `"idle"` en el contrato y no se va a inventar. Ver Decisiones.

Fila `games`: solo se reescriben `short` y `long` para mencionar los dos modos. `id`, `title`, `cat`, `cover`, `color`, `best` y `plays` quedan intactos.

## Plan de implementación

1. **Fase de arranque y selector de modo.** Añadir `phase` y `mode` al estado del motor. En `"boot"`: no decrementar el reloj de ronda, dibujar el panel de arranque centrado sobre el tablero (modo actual, `ESPACIO — INICIAR`, `M — CAMBIAR MODO`, `S — SILENCIO`), y tratar `Space` como "iniciar" en vez de "sondear". `M` alterna el modo solo en `"boot"`. `reset()` vuelve a `"boot"` conservando `mode` y `muted`. Verificación: al entrar a `/juego/sinapsis/jugar` el reloj está quieto en su valor inicial hasta la primera pulsación de `Space`, esa pulsación no destapa ningún nodo, `M` cambia el rótulo del panel, y tras un game over + JUGAR DE NUEVO se vuelve al panel con el modo previamente elegido.
2. **Reflujo sináptico.** Implementar el temporizador `refluxMs` (`max(6, 14 - level)` segundos, decrementado por delta-time solo en `phase: "running"` y `state: "playing"`), la selección de dos parejas de nodos ocultos elegibles, y la animación de intercambio de 400ms interpolando la posición dibujada de cada nodo (el índice lógico se intercambia al inicio; lo que se interpola es solo el punto de dibujo). Bloquear el sondeo sobre nodos con `swap` en curso. Saltar el ciclo si hay menos de 4 nodos ocultos. Verificación: en SOBRECARGA nivel 1, dos parejas de nodos se cruzan visiblemente cada ~13s, los nodos ya resueltos nunca se mueven, y sondear justo después del cruce destapa el glifo que corresponde a la **nueva** posición.
3. **Impulsos corruptos.** Añadir el glifo 13 (aspa corrupta, rojo) y la generación del par corrupto en SOBRECARGA a partir del nivel 2, con la regla de crecimiento/sustitución de la rejilla descrita en el Alcance. Implementar su resolución: −200 puntos con piso en 0, −1 derivación, ventana `"dead"`, reocultado y reubicación en dos celdas ocultas aleatorias. Ajustar el contador de pares pendientes para que excluya el par corrupto. Verificación: llegar al nivel 2 en SOBRECARGA, emparejar los dos glifos rojos, y comprobar que la puntuación baja, se pierde una derivación, el par vuelve a ocultarse en otras posiciones, y que la capa se completa igualmente al resolver el resto de pares.
4. **Pulso de diagnóstico.** Implementar `pulseCharges` (se gana al alcanzar cadena múltiplo de 3, tope 1) y la tecla `X`, que la gasta activando `pulseMs = 900` — durante ese tiempo todos los nodos `hidden` se dibujan como `revealed` con un barrido vertical, sin cambiar su estado lógico. Un fallo reinicia la cadena pero conserva la carga. Verificación: encadenar 3 aciertos enciende el icono de carga en el HUD, `X` revela todo el tablero durante ~0.9s y apaga el icono, y `X` sin carga no hace nada.
5. **Multiplicador de SOBRECARGA.** Aplicar el ×1.5 truncado a par, bonus de cadena y bonus de capa cuando `mode === "overload"`, y verificar que la penalización de −200 se aplica sin escalar y después del multiplicador. Verificación: el mismo acierto que da 100 en CLÁSICO da 150 en SOBRECARGA; una cadena de 4 da 150/225/300/375.
6. **Audio Web Audio.** Crear el submódulo de audio dentro de `lib/games/sinapsis/` (o un archivo hermano `audio.ts` importado solo por el motor): `AudioContext` perezoso en el primer `keydown`, funciones para cada uno de los ocho sonidos listados en el Alcance usando osciladores y envolventes de ganancia, tecla `S` para silenciar, silenciamiento respetado en todas las llamadas, y parada limpia en `pause()`/`destroy()` (incluido `ctx.close()`). Verificación: cada acción tiene su sonido, `S` los corta todos y lo indica en el HUD, pausar en mitad de un sonido largo no lo deja sonando, y salir de la página no deja el `AudioContext` abierto (comprobable en el panel de rendimiento del navegador).
7. **Efectos visuales.** Añadir el sistema de partículas con cota de 128 y dibujo en un único lote `save()`/`restore()`, la sacudida del tablero, el flash rojo de derivación quemada, la estela del reflujo, el barrido del pulso y el parpadeo del reloj bajo 5 segundos. Verificación: con la rejilla máxima 6×4, reflujo activo y una ráfaga de partículas simultánea, el juego mantiene 60fps sin caídas perceptibles; el conteo de `save()`/`restore()` por frame no crece con el número de partículas.
8. **HUD ampliado.** Añadir a `drawHUD()` el indicador de modo, el icono de carga de pulso y el indicador de silencio, sin romper la legibilidad de los campos ya existentes (puntuación, capa, derivaciones, reloj). Verificación: los siete indicadores caben en la franja de 64px sin solaparse en la rejilla máxima.
9. **Textos de la fila `games`.** Reescribir `short`/`long` de `sinapsis` vía `mcp__supabase__apply_migration` (migración `update_game_sinapsis_modos`) para que mencionen los dos modos. Verificación: `/juego/sinapsis` muestra los textos nuevos.
10. **Verificación en navegador.** Jugar una partida completa en cada modo. En CLÁSICO: comprobar que el juego se comporta **exactamente** como en la SPEC 15 (sin reflujo, sin virus, sin pulso, sin multiplicador) más audio y partículas. En SOBRECARGA: reflujo, par corrupto desde el nivel 2, pulso de diagnóstico, multiplicador. En ambos: HUD interno y `player-hud` externo consistentes, PAUSA congela reloj, reflujo, ventanas de resolución y pulso, FIN y game over muestran la misma puntuación en overlay interno y modal externo, GUARDAR PUNTUACIÓN inserta en `scores` y aparece en `/juego/sinapsis` y `/salon-de-la-fama`, JUGAR DE NUEVO devuelve a la pantalla de arranque con el modo elegido, SALIR no deja loop, listeners ni `AudioContext` vivos. Confirmar que los otros cinco juegos siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] Al entrar a `/juego/sinapsis/jugar` aparece la pantalla de arranque dentro del canvas y el reloj de la ronda no corre hasta la primera pulsación de `Space`.
- [ ] Esa primera pulsación de `Space` inicia la partida y **no** sondea ningún nodo.
- [ ] `M` alterna `CLÁSICO`/`SOBRECARGA` solo en la pantalla de arranque; pulsarla durante la partida no tiene efecto.
- [ ] Con el modo `CLÁSICO` seleccionado, el juego se comporta igual que en la SPEC 15: no hay reflujo, ni glifo corrupto, ni pulso de diagnóstico, ni multiplicador.
- [ ] En `SOBRECARGA`, dos parejas de nodos ocultos intercambian posición cada `max(6, 14 - level)` segundos con animación de 400ms; los nodos `matched` nunca se mueven.
- [ ] En `SOBRECARGA` nivel ≥2 existe exactamente un par de glifo corrupto por capa; emparejarlo resta 200 puntos (nunca por debajo de 0), quema una derivación, vuelve a ocultarse y se reubica.
- [ ] La capa se completa en `SOBRECARGA` con el par corrupto sin resolver.
- [ ] Una cadena múltiplo de 3 otorga una carga de pulso (tope 1); `X` revela todo el tablero durante ~900ms; `X` sin carga es un no-op; un fallo reinicia la cadena pero conserva la carga.
- [ ] En `SOBRECARGA`, par, bonus de cadena y bonus de capa se multiplican por 1.5 truncado; la penalización de −200 no se escala.
- [ ] Suenan los ocho efectos listados, generados con Web Audio sin ningún archivo de audio en `public/`.
- [ ] El `AudioContext` se crea en el primer `keydown` real y se cierra en `destroy()`; no hay advertencias de autoplay en consola.
- [ ] `S` alterna silencio en cualquier momento y el HUD lo refleja.
- [ ] PAUSA congela reloj, temporizador de reflujo, animaciones de intercambio, ventanas de resolución y pulso de diagnóstico.
- [ ] `EngineStats`, `EngineCallbacks`, `GameCanvasProps` y `GameEngineHandle` no cambiaron ni una línea.
- [ ] `components/games/sinapsis-canvas.tsx`, `lib/games/registry.ts` y `components/jugar-client.tsx` no cambiaron respecto a la SPEC 15.
- [ ] Guardar la puntuación en cualquiera de los dos modos inserta en `scores` y aparece en `/juego/sinapsis` y `/salon-de-la-fama`.
- [ ] Con rejilla 6×4, reflujo activo y partículas en vuelo el juego mantiene 60fps, y el número de `save()`/`restore()` por frame no crece con el número de entidades.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **El twist se entrega como un modo seleccionable, no como una capa que sustituye al clásico.** El encargo pedía dos variantes jugables distintas del mismo juego base y no duplicados: CLÁSICO es memoria pura contra reloj, SOBRECARGA convierte la misma corteza en un tablero inestable donde memorizar posiciones deja de ser suficiente. Ambos comparten motor, glifos y render; se distinguen por reglas, no por código duplicado.
- **CLÁSICO es el modo por defecto.** Quien entra sin leer nada juega exactamente la variante de la SPEC 15, que es la que se verificó de punta a punta primero. SOBRECARGA es opt-in explícito.
- **El selector de modo vive dentro del canvas, no en `jugar-client.tsx`.** Añadir un selector en la play-page significaría una rama específica de `sinapsis` en un componente compartido, prohibido por el contrato del proyecto. Una pantalla de arranque dibujada en canvas es además más coherente con la estética arcade y no requiere estado de React.
- **La pantalla de arranque reporta `state: "playing"` en vez de inventar un `"idle"`.** `EngineStats` no se extiende bajo ninguna circunstancia. Se acepta el pequeño desajuste semántico (el `player-hud` externo muestra 0 puntos / 5 derivaciones / capa 1 mientras el jugador aún no ha empezado), que es exactamente lo que mostraría una partida recién iniciada — el desajuste no es observable como error para el jugador.
- **`M` se bloquea una vez iniciada la partida.** Permitir cambiar de modo a mitad de partida haría posible farmear el multiplicador ×1.5 de SOBRECARGA saltando a él solo en el momento del bonus de capa, y ensuciaría el significado de una puntuación guardada.
- **Un único leaderboard para ambos modos, sin columna nueva en `scores`.** Separar leaderboards exigiría tocar el esquema de `scores` y los accesores de `lib/scores.ts`, que son infraestructura compartida por los seis juegos: un coste desproporcionado para una variante de un solo juego. El multiplicador ×1.5 existe precisamente para que las dos variantes convivan en la misma tabla sin que SOBRECARGA sea una elección estrictamente peor pese a su mayor riesgo.
- **×1.5 truncado como compensación, en vez de un sistema de puntos separado.** Es la palanca más simple posible y se ajusta en un solo sitio del código si la primera partida real revela desbalance.
- **El pulso de diagnóstico es exclusivo de SOBRECARGA.** Se consideró darlo también en CLÁSICO y se descartó: en CLÁSICO no hay reflujo ni virus contra los que compensar, así que sería puro regalo y trivializaría el modo verificado en la SPEC 15. Su función es ser el contrapeso del caos, no un añadido de calidad de vida.
- **Tope de 1 carga de pulso almacenada.** Acumular cargas permitiría guardarse tres pulsos para la capa más difícil y saltársela entera; con tope de 1, el power-up se usa o se pierde, que es la decisión interesante.
- **El par corrupto quema una derivación además de restar puntos.** Solo restar puntos lo volvería un error barato que el jugador ignoraría; costar una derivación lo convierte en una amenaza real que obliga a memorizar dónde está el veneno, que es justo el giro que aporta al género.
- **El par corrupto se reubica tras resolverse, en vez de quedarse fijo o desaparecer.** Si se quedara fijo, se memoriza una vez y deja de importar; si desapareciera, el castigo sería de una sola vez por capa. Reubicarlo mantiene la tensión durante toda la capa sin ser injusto (el jugador ve la animación de reubicación).
- **El reflujo mueve solo nodos ocultos y nunca los ya resueltos.** Mover sinapsis estables sería visualmente confuso y no añadiría dificultad real, porque su glifo ya es conocido; el reto está en perder la pista de lo que aún no se ha resuelto.
- **El reflujo se anima en 400ms en vez de teletransportar los nodos.** Un intercambio instantáneo se percibiría como un bug del juego; la animación con estela lo convierte en información que el jugador atento puede aprovechar, y así el twist premia la atención en vez de castigarla al azar.
- **Los temporizadores nuevos (reflujo, pulso, partículas, sacudida) usan el mismo delta acumulado del loop que el reloj de ronda.** Misma decisión y mismo motivo que en la SPEC 15: `pause()` tiene que congelar el juego entero, y `setTimeout` lo rompería.
- **Audio generado con Web Audio, sin archivos.** Mismo patrón que Tetris, ya probado en el repo. Evita añadir binarios al repositorio y hace que los sonidos escalen con el estado del juego (p. ej. el tic del reloj) sin gestionar buffers.
- **`AudioContext` perezoso en el primer `keydown` y `S` para silenciar.** Crear el contexto en el constructor dispara la advertencia de autoplay en Chrome y deja el contexto suspendido; el primer `keydown` es un gesto de usuario válido. Se eligió `S` (silencio) y no `M`, porque `M` ya está tomada por el selector de modo y ambas letras compiten por el mismo mnemónico en inglés.
- **Los efectos visuales se aplican a ambos modos.** Partículas, sacudida y flash son presentación, no reglas: restringirlos a SOBRECARGA dejaría al modo clásico visualmente pobre sin ganancia de diseño.
- **Render optimizado desde el principio (lotes de `save()`/`restore()`, cota de partículas).** La spec 14 ya generalizó estos patrones tras el jank de Frogger; aplicarlos al escribir el código evita tener que pasar `@game-performance-booster` sobre un motor recién nacido.
- **La fila `games` solo se toca en `short`/`long`.** Es el único cambio de datos que el alcance de una spec de mecánicas justifica; `cat`, `color` y `cover` fijados en la SPEC 15 siguen siendo correctos con los dos modos.

## Riesgos identificados

- **El reflujo y las ventanas de resolución pueden pisarse.** Si un intercambio arranca en el mismo frame en que se resuelve una pareja, un nodo podría estar simultáneamente en animación de swap y en transición a `matched`, dejando el glifo dibujado en una posición y el estado lógico en otra. Debe existir una precedencia explícita: mientras `resolveTimer > 0`, el reflujo no arranca; y los nodos implicados en la jugada actual quedan excluidos de la elegibilidad del swap.
- **El par corrupto en la rejilla tope 6×4 sustituye a un par normal**, lo que reduce a 11 los pares necesarios para completar la capa; si el contador de pendientes no se recalcula al generar el tablero (y se deja en "cols×rows/2"), la capa nunca se completará y la partida se quedará colgada hasta que expire el reloj. Es el fallo más probable de esta spec y hay que cubrirlo específicamente en el paso 3.
- **La reubicación del par corrupto puede caer en celdas donde ya no queden nodos ocultos suficientes** (final de capa, con casi todo resuelto). Necesita un fallback determinista: si hay menos de 2 celdas ocultas elegibles, el par corrupto se queda donde está en vez de bloquear el loop buscando destino.
- **El `AudioContext` es un recurso que sobrevive al desmontaje si no se cierra.** Navegar repetidamente entre `/juego/sinapsis/jugar` y otras rutas sin cerrar el contexto acumula instancias hasta que el navegador rechaza crear más (el límite práctico ronda las seis en Chrome). `destroy()` debe cerrarlo, y hay que verificarlo con varias entradas y salidas seguidas, no con una sola.
- **El tic de reloj de los últimos 5 segundos se dispara una vez por segundo desde el loop de render**, que corre a 60fps; sin un flag de "ya sonó este segundo" se dispararían 60 osciladores por segundo y el audio se saturaría de forma muy audible.
- **El HUD pasa de cuatro a siete indicadores en la misma franja de 64px.** Con la fuente pixel (`--pixel`), que es ancha, el riesgo de solapamiento es real; conviene decidir el reparto horizontal en el paso 8 antes de dar por buena la legibilidad, y no darlo por hecho desde el diseño sobre papel.
- **`reset()` conserva `mode` y `muted` pero debe limpiar todo lo demás** (partículas, swaps en vuelo, `pulseCharges`, `pulseMs`, `refluxMs`, `shakeMs`). Un `reset()` incompleto tras un game over deja animaciones de la partida anterior corriendo sobre el tablero nuevo — el tipo de fallo que solo aparece jugando la segunda partida seguida, no la primera.
