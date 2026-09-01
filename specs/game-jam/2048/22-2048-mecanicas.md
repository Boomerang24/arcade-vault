# 22 — 2048: Mecánicas avanzadas

**Estado:** Draft
**Depende de:** SPEC 21
**Fecha:** 2026-08-31

**Objetivo:** Enriquecer el motor de 2048 con un sistema de rebobinado que le da significado real a `lives` y a `"dead"`, un sistema de puntuación con multiplicador por fusiones múltiples y bonus de umbral, y una capa de presentación con audio generado por Web Audio y partículas — todo dentro de `lib/games/2048/engine.ts`, sin tocar el contrato del catálogo ni el registry.

## Alcance

**Incluye:**

- **Sistema 1 — Rebobinado (`REBOBINAR`) y estado `ATASCADO`.** Es el sistema que convierte el mapeo forzado de `lives` de la spec 21 en un mapeo con significado real.
  - El motor mantiene una **pila de historial** con los últimos **3** estados del tablero (tablero completo, `score`, `moves` y `maxTile`), apilada al final de cada turno válido.
  - **3 cargas de rebobinado** por partida. Pulsar `Espacio` (o `Z`) consume una carga y restaura el estado inmediatamente anterior: el tablero, la puntuación y el contador de movimientos vuelven atrás. `maxTile` y por tanto `level` **no** retroceden (una vez alcanzada, la ficha máxima cuenta como logro de la partida).
  - Rebobinar con 0 cargas, o sin historial (primer turno), no hace nada más que un aviso visual y sonoro breve; no consume nada.
  - **Estado `ATASCADO` (`state: "dead"`).** Cuando el tablero se bloquea (sin celdas vacías ni pares adyacentes iguales) y **todavía quedan cargas de rebobinado**, el motor entra en `"dead"` en vez de `"gameover"`: dibuja un overlay `TABLERO ATASCADO — REBOBINA` y acepta **solo** la tecla de rebobinado. Al rebobinar, vuelve a `"playing"`. Si el tablero se bloquea con **0 cargas**, pasa directo a `"gameover"` e invoca `onGameOver(score)` como en la spec 21.
  - El **contador de cargas se dibuja en el panel izquierdo** como 3 celdas que se apagan al gastarse, además de reflejarse en `lives`.
- **Sistema 2 — Puntuación avanzada: fusiones múltiples y umbrales.**
  - **Multiplicador por fusiones en el mismo turno.** Un turno que resuelve `n` fusiones aplica al total de ese turno un multiplicador `1` (n=1), `1.5` (n=2), `2` (n=3) y `3` (n≥4). El multiplicador se dibuja como `×N` flotante sobre el tablero durante ~600 ms.
  - **Bonus de umbral.** La primera vez en la partida que aparece una ficha de un valor nuevo igual o superior a `128`, se suman `valor × 5` puntos extra y se muestra un cartel `¡NUEVO UMBRAL 256!` durante ~900 ms. Cada valor paga el bonus una única vez por partida.
  - **Penalización por rebobinar.** Cada rebobinado devuelve la puntuación al valor previo (parte del restore) y además resta un **10%** de los puntos que se estaban devolviendo, redondeado hacia abajo y nunca por debajo de 0. Rebobinar es una red de seguridad, no una máquina de repetir turnos buenos.
  - **Bonus de cierre.** Al entrar en `"gameover"`, se suman `500 × cargas de rebobinado sin usar`. Premia terminar la partida sin muletas y evita que las 3 cargas sean puntuación gratis.
- **Sistema 3 — Presentación: audio generado y partículas.**
  - **Audio Web Audio, sin assets externos**, mismo patrón que Tetris y Sifón: un `AudioContext` creado **perezosamente en el primer movimiento** (nunca en el constructor, para no chocar con las políticas de autoplay), osciladores y envolventes generados en código, todo bajo un `GainNode` maestro conservador. Sonidos: deslizamiento (barrido corto de ruido filtrado), fusión (tono cuyo pitch sube con `log2(valor)`, de modo que fusionar 1024 suena claramente más agudo que fusionar 4), movimiento inválido (clic seco grave), aparición de ficha (pulso muy breve), nuevo umbral (arpegio ascendente de 3 notas), rebobinado (barrido descendente con efecto de "cinta hacia atrás"), rebobinado sin cargas (buzz corto), entrada en `ATASCADO` (tono de alarma sostenido y corto) y game over (acorde descendente). **Silencio total** mientras el motor está pausado; en `"dead"` solo suenan la alarma inicial y el rebobinado.
  - **Partículas y sacudida.** Cada fusión emite 4–8 chispas en el color de la ficha resultante, con gravedad y `globalAlpha` decreciente; las fusiones de 256 o más añaden un anillo de expansión y una **sacudida de cámara** amortiguada de 2–4 px, aplicada como traslación del contexto y revertida al final del frame. Presupuesto duro de partículas vivas (p. ej. 200) descartando las más antiguas.
  - **Realce de la ficha máxima:** la ficha de mayor valor del tablero lleva un `shadowBlur` pulsante lento, para localizarla de un vistazo en tableros densos.
- Ajuste opcional de `short`/`long` de la fila `2048` en `games` vía `mcp__supabase__apply_migration`, **solo si** el rebobinado merece mencionarse en la ficha de catálogo. Es el único cambio de datos permitido en esta spec.

**No incluye (fuera de alcance):**

- Cualquier cambio a `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` o `RegisteredGame`. El multiplicador, los umbrales y el historial son estado interno del motor y se comunican solo por el HUD dibujado en el canvas.
- Cambios en `lib/games/registry.ts` más allá de lo ya hecho en la spec 21 (la línea `"2048"` ya existe), y cero cambios en `components/jugar-client.tsx`.
- Cambios en el esquema de `games`/`scores`; como mucho, el texto `short`/`long` de la fila `2048`.
- `skins` y `touchActions`: siguen siendo trabajo posterior de `@skin-designer` y `@mobile-porter`. (Nota para `@mobile-porter`: el rebobinado usa `Espacio`, que encaja directo en un `touchActions: [{ code: "Space", label: "REBOBINAR" }]` — pero esa línea **no** se añade en esta spec.)
- Assets binarios: `public/games/2048/` sigue sin crearse. Todo el audio se sintetiza y todo el arte es procedural.
- Control de volumen o mute en la UI de `/juego/[id]/jugar`: sería tocar un componente compartido para un solo juego. El motor decide su volumen y respeta la pausa.
- Fichas especiales (bloqueadas, comodines, bombas), tableros de otro tamaño y modos de juego alternativos.
- Persistir el historial o la partida entre recargas.
- Cambios a `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger`, `sinapsis` o `sifon`.

## Modelo de datos

El contrato externo **no cambia**: `Game2048Engine` conserva exactamente el constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)` y los métodos `pause/resume/reset/forceGameOver/destroy` definidos en la spec 21, y `components/games/2048-canvas.tsx` **no se modifica en absoluto**. Todo lo de esta spec vive dentro de `lib/games/2048/engine.ts` (opcionalmente repartido en módulos hermanos `lib/games/2048/audio.ts` y `lib/games/2048/particles.ts`, importados solo desde el motor).

Estado nuevo dentro del motor:

- `history: Snapshot[]` con `Snapshot = { board: (Tile | null)[]; score: number; moves: number; maxTile: number }`, capado a 3 entradas (se descarta la más antigua al apilar la cuarta). Los `Tile` se copian en profundidad al apilar: guardar referencias haría que el snapshot mutara con el tablero vivo.
- `rewinds: number` — cargas restantes, 3 → 0.
- `thresholdsAwarded: Set<number>` — valores que ya pagaron bonus de umbral.
- `floaters: Floater[]` — carteles flotantes de multiplicador y umbral, con su tiempo de vida.
- `particles: Particle[]` y `shake: { x: number; y: number; t: number }`.
- `audio: Game2048Audio | null`, creado en el primer movimiento.

**Mapeo de `EngineStats`** (cambia respecto de la spec 21 — es el punto central de esta spec):

- `score`: acumulado, ahora incluyendo multiplicador por fusiones múltiples, bonus de umbral, penalización del 10% al rebobinar y bonus de cierre. Sigue siendo un entero.
- `lives`: **deja de ser el `1` forzado de la spec 21** y pasa a valer las **cargas de rebobinado restantes** (3 → 0). Es un mapeo semánticamente honesto: una carga se consume para recuperarse de una situación perdida, exactamente lo que el `player-hud` compartido entiende por "vida". Ver Decisiones.
- `level`: sin cambios respecto de la spec 21 — `log2(maxTile) − 1`, monótono creciente, y **no retrocede al rebobinar**.
- `state`: **`"dead"` pasa a usarse de verdad** — tablero bloqueado con cargas disponibles (`ATASCADO`). `"playing"` durante el juego normal; `"gameover"` al bloquearse con 0 cargas o al pulsar FIN. `onGameOver` se sigue invocando una única vez, solo en la transición a `"gameover"`.

**Ni el multiplicador, ni los umbrales, ni el historial entran en `EngineStats`**: el contrato del catálogo es cerrado y añadir un campo obligaría a tocar `components/jugar-client.tsx`, que es exactamente lo que el diseño del registry evita.

## Plan de implementación

1. **Historial y rebobinado.** Añadir `history` (máximo 3 snapshots con copia profunda del tablero), `rewinds = 3`, el listener de `Espacio`/`Z` con `preventDefault`, y la restauración del snapshot anterior (tablero, `score`, `moves`; `maxTile` intacto). Rebobinar con 0 cargas o sin historial no consume nada. Dibujar las 3 celdas de carga en el panel izquierdo. Verificación: tras tres turnos, rebobinar tres veces devuelve el tablero exactamente a los estados intermedios y deja el contador en 0; el cuarto intento no cambia nada; rebobinar y volver a mover apila historial nuevo correctamente.
2. **Re-mapeo de `lives` y estado `ATASCADO`.** `lives` pasa a reportar `rewinds`. Al detectar bloqueo: si `rewinds > 0` → `state = "dead"` + overlay `TABLERO ATASCADO — REBOBINA`, ignorando toda tecla salvo la de rebobinado; si `rewinds === 0` → `"gameover"` + `onGameOver(score)` una sola vez. Rebobinar desde `"dead"` vuelve a `"playing"`. Verificación: bloquear el tablero con cargas muestra `ATASCADO` y las flechas no hacen nada; rebobinar reanuda la partida; agotar las cargas y volver a bloquear dispara el game over y el modal externo, con `lives` a 0 en el `player-hud`.
3. **Multiplicador por fusiones múltiples.** Contar fusiones del turno y aplicar `1` / `1.5` / `2` / `3` (n = 1, 2, 3, ≥4) al total del turno, redondeando hacia abajo. Cartel `×N` flotante sobre el tablero ~600 ms. Verificación: un turno con 4 fusiones (por ejemplo, dos filas de `2 2 2 2` alineadas) suma exactamente el triple de la suma de las cuatro fichas resultantes; un turno con una sola fusión no cambia respecto de la spec 21.
4. **Bonus de umbral y bonus de cierre.** `thresholdsAwarded` para pagar `valor × 5` la primera vez que aparece cada valor ≥128, con cartel `¡NUEVO UMBRAL N!` ~900 ms; y `+500 × rewinds` al entrar en `"gameover"`, sumado **antes** de invocar `onGameOver`. Verificación: llegar a 128 suma +640 una vez y no vuelve a pagarlo aunque se cree otra ficha 128; terminar sin gastar cargas suma exactamente +1500 y la puntuación del modal externo coincide con la del overlay interno.
5. **Penalización por rebobinar.** Al restaurar, aplicar la resta del 10% de la diferencia de puntuación devuelta, acotada con `max(0, ...)` y redondeada hacia abajo. Verificación: un turno que sumó 100 puntos y se rebobina deja la puntuación 10 puntos por debajo del valor previo al turno, nunca negativa.
6. **Audio generado.** Crear el módulo con `AudioContext` perezoso (primer movimiento), `GainNode` maestro y una función por efecto (deslizamiento, fusión con pitch por `log2(valor)`, movimiento inválido, aparición, umbral, rebobinado, rebobinado sin cargas, alarma de `ATASCADO`, game over). Silenciar por completo con el motor pausado, limitar a alarma y rebobinado en `"dead"`, y cerrar el contexto en `destroy()` con rampa de gain a 0 y guard contra doble invocación. Verificación: cada efecto suena en su momento, no hay warning de autoplay al cargar la página, pausar corta el sonido de inmediato y salir de la partida no deja el contexto abierto ni un clic audible.
7. **Partículas, sacudida y realce.** Sistema de partículas con presupuesto duro y descarte de las más antiguas: chispas por fusión en el color de la ficha resultante, anillo de expansión y sacudida amortiguada para fusiones ≥256, y `shadowBlur` pulsante en la ficha máxima del tablero. La sacudida se aplica como traslación del contexto revertida al final del frame. Verificación: un turno con 4 fusiones grandes mantiene el framerate estable, el presupuesto no se desborda y ni el HUD del panel izquierdo ni el marco del tablero quedan desplazados tras la sacudida.
8. **Balance y textos.** Jugar tres partidas completas hasta al menos la ficha 512 y ajustar únicamente las constantes: escalones del multiplicador, factor del bonus de umbral, porcentaje de penalización y bonus de cierre, verificando que el rango de puntuación siga siendo comparable con Tetris y Arkanoid en `/salon-de-la-fama`. Si el rebobinado merece aparecer en la ficha de catálogo, actualizar `short`/`long` de la fila `2048` vía `mcp__supabase__apply_migration` (migración `update_game_2048_texts`). Verificación: `select short, long from games where id = '2048';` refleja el texto final si se cambió.
9. **Verificación en navegador y build.** Recorrer `/juego/2048/jugar` completo: rebobinado consume carga y restaura el estado, `ATASCADO` aparece y se resuelve rebobinando, agotar cargas y bloquear dispara el game over, el multiplicador y los umbrales suman lo documentado, el audio suena y respeta pausa y `"dead"`, las partículas no degradan el frame, el HUD interno y el `player-hud` externo siguen sincronizados con `lives` = cargas restantes, y PAUSA/FIN/guardar puntuación/JUGAR DE NUEVO/SALIR siguen funcionando igual que en la spec 21, con la puntuación visible en `/juego/2048` y `/salon-de-la-fama`. Confirmar que los otros siete juegos siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] El historial guarda como máximo 3 snapshots, con copia profunda del tablero (mutar el tablero vivo no altera un snapshot apilado).
- [ ] Rebobinar restaura tablero, `score` y `moves` del turno anterior y consume exactamente una carga.
- [ ] Rebobinar con 0 cargas o sin historial no consume nada y no altera el estado.
- [ ] `level` y `maxTile` no retroceden al rebobinar.
- [ ] `lives` reporta las cargas restantes (3 → 0) y el `player-hud` externo lo muestra sincronizado con las 3 celdas del panel del canvas.
- [ ] Bloquear el tablero con cargas disponibles entra en `state: "dead"` con overlay `ATASCADO`, ignorando las flechas y aceptando solo el rebobinado.
- [ ] Bloquear el tablero con 0 cargas entra en `"gameover"` e invoca `onGameOver` una única vez.
- [ ] El multiplicador aplica `1` / `1.5` / `2` / `3` para 1, 2, 3 y ≥4 fusiones en el turno.
- [ ] Cada valor ≥128 paga su bonus de umbral (`valor × 5`) exactamente una vez por partida.
- [ ] Rebobinar resta un 10% adicional de los puntos devueltos, sin dejar la puntuación negativa.
- [ ] El bonus de cierre (`500 × cargas sin usar`) se suma antes de invocar `onGameOver`, y overlay interno y modal externo muestran la misma puntuación final.
- [ ] El `AudioContext` se crea en el primer movimiento, no al montar el canvas, y no genera warnings de autoplay.
- [ ] El pitch de la fusión sube con `log2(valor)` de forma audible entre una fusión de 4 y una de 1024.
- [ ] El audio se silencia por completo durante la pausa y se limita a alarma y rebobinado en `"dead"`; el contexto se cierra en `destroy()` sin clic ni excepción.
- [ ] Las partículas respetan el presupuesto máximo y un turno con 4 fusiones grandes no degrada el framerate de forma perceptible.
- [ ] La sacudida de cámara se revierte por completo cada frame: HUD y marco del tablero nunca quedan desplazados.
- [ ] `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` y `GAME_REGISTRY` quedan exactamente igual que tras la spec 21.
- [ ] `components/games/2048-canvas.tsx` y `components/jugar-client.tsx` no se modifican.
- [ ] Guardar la puntuación sigue insertando en `scores` y apareciendo en `/juego/2048` y `/salon-de-la-fama`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **El rebobinado existe, sobre todo, para darle significado real a `lives` y a `"dead"`.** La spec 21 dejó ambos forzados (`lives` fijo en 1, `"dead"` sin emitir) porque el 2048 clásico no tiene nada equivalente. En vez de extender `EngineStats` — prohibido por el contrato del catálogo —, se introduce una mecánica que encaja de forma natural en los campos existentes: una carga de rebobinado **es** una vida (te recuperas de una posición perdida) y `ATASCADO` **es** el `"dead"` canónico (perdiste, pero puedes continuar gastando una vida). Es el mismo razonamiento que llevó a Sifón a mapear `lives` a cargas de purga.
- **3 cargas y 3 snapshots, no rebobinado ilimitado.** Con historial infinito, el juego deja de ser 2048 y pasa a ser un buscador de la partida perfecta por ensayo y error, y el leaderboard se vuelve una medida de paciencia. Tres es suficiente para rescatar un error tonto y poco para sistematizarlo.
- **`maxTile` (y por tanto `level`) no retrocede al rebobinar.** `level` está definido en la spec 21 como monótono creciente; hacerlo bajar rompería esa invariante y produciría un `player-hud` que retrocede de nivel, algo que ningún otro juego del catálogo hace. Además, haber alcanzado una ficha sigue siendo cierto aunque se deshaga el turno.
- **Penalización del 10% al rebobinar, y no un coste fijo en puntos.** Un coste fijo sería irrelevante en partidas largas y brutal en las cortas; el porcentaje escala solo. Se descartó también no penalizar: sin coste sobre la puntuación, rebobinar tras un turno malo es estrictamente gratis y siempre correcto, lo que elimina la decisión.
- **Bonus de cierre por cargas sin usar.** Sin él, las tres cargas serían valor puro sin contrapartida y todo el mundo las gastaría siempre. Con él, guardarlas es una apuesta real: 1500 puntos por terminar limpio contra la posibilidad de una partida más larga.
- **Multiplicador por fusiones **del mismo turno**, no por turnos productivos consecutivos.** En 2048 casi todos los turnos fusionan algo, así que una cadena entre turnos sería un multiplicador permanentemente alto sin decisión detrás. Premiar las fusiones simultáneas, en cambio, recompensa la jugada realmente difícil: alinear el tablero para que un solo movimiento colapse cuatro parejas.
- **Multiplicador topado en 3×.** Un tope bajo mantiene el rango de puntuación comparable con el resto del catálogo en `/salon-de-la-fama`; el techo de 4 fusiones por turno en un tablero 4×4 ya es un límite natural, así que no hace falta más.
- **Bonus de umbral desde 128 y una sola vez por valor.** Por debajo de 128 los umbrales se alcanzan en los primeros segundos y el cartel sería ruido constante. Pagarlo una vez por valor evita que una partida larga farmee 128 repetidamente en vez de perseguir la ficha grande.
- **Audio sintetizado con Web Audio, sin archivos.** Mismo criterio que Tetris y Sifón: cero binarios en `public/`, cero peso de bundle, y control total del tono — que el pitch de la fusión suba con el valor de la ficha es información de juego real, imposible con un sample fijo sin mantener una docena de archivos.
- **`AudioContext` creado en el primer movimiento, no en el constructor.** Los navegadores bloquean el audio sin interacción previa; crearlo al montar produciría un warning en consola en cada carga de `/juego/2048/jugar` y un contexto suspendido inútil.
- **Sin control de volumen en la UI.** Añadirlo implicaría tocar `components/jugar-client.tsx` o un componente compartido para un solo juego, justo lo que el contrato del catálogo prohíbe.
- **Presupuesto duro de partículas.** Un turno con cuatro fusiones grandes es el momento más vistoso de la partida y sería el peor instante posible para una caída de framerate. Se acota y se descarta lo más antiguo.
- **Se descartó añadir fichas especiales (bloqueadas, comodines, bombas).** Cambiarían las reglas del núcleo del 2048, que es un juego de información perfecta y determinista salvo por la aparición aleatoria; introducir azar con consecuencias fuertes lo convertiría en otro juego. El rebobinado y la puntuación avanzada añaden profundidad sin tocar las reglas de deslizamiento y fusión.
- **Se descartó una tercera spec de pulido.** Con estos tres sistemas, el juego queda completo; el resto del recorrido visual (skins, táctil) ya lo cubren `@skin-designer` y `@mobile-porter` fuera del flujo de specs.

## Riesgos identificados

- **Snapshots por referencia.** Si el snapshot guarda el mismo array de `Tile` que usa el tablero vivo, cada movimiento posterior lo mutará y rebobinar restaurará el estado actual — un bug silencioso que solo aparece al rebobinar y que parece "el rebobinado no hace nada". La copia profunda de las 16 celdas es obligatoria y es lo primero que se prueba en el paso 1.
- **Rebobinar a mitad de una animación.** La tecla de rebobinado no pasa por el buffer de movimiento de la spec 21; si se acepta mientras hay una animación en curso, las fichas quedan interpolando hacia celdas de un tablero que ya no existe. Debe ignorarse (o encolarse igual que las flechas) mientras `anim !== null`.
- **Orden entre bonus de cierre y `onGameOver`.** Si el bonus de `500 × cargas` se suma después de invocar `onGameOver`, el modal externo y el leaderboard guardarán una puntuación menor que la del overlay interno — una discrepancia visible que además ensucia `scores` de forma irreversible. El orden es: sumar bonus → emitir `onStats` final → invocar `onGameOver`.
- **`"dead"` y el `player-hud` externo.** Es el primer estado `"dead"` real de este juego; hay que confirmar en navegador que `components/jugar-client.tsx` lo trata como el resto del catálogo (no abre el modal de fin de partida) y que solo la transición a `"gameover"` lo dispara. Si el HUD compartido reaccionara a `"dead"` de forma inesperada, la solución es ajustar el motor, nunca el componente compartido.
- **Bloqueo detectado inmediatamente después de rebobinar.** Rebobinar restaura un tablero que, por definición, no estaba bloqueado, pero la comprobación de bloqueo debe reejecutarse en el orden correcto o el motor puede volver a entrar en `"dead"` en el mismo frame y consumir todas las cargas en cascada.
- **Penalización acumulada del 10% con rebobinados encadenados.** Rebobinar tres veces seguidas aplica tres penalizaciones sobre bases distintas; con la fórmula mal anclada (porcentaje sobre el `score` total en vez de sobre la diferencia devuelta) una partida larga puede perder miles de puntos de golpe. La base es siempre la diferencia entre la puntuación actual y la del snapshot.
- **Pitch de fusión con valores muy altos.** `log2(32768) = 15`; si el mapeo a frecuencia es lineal sin techo, las fusiones grandes acaban en frecuencias molestas o inaudibles. Acotar la frecuencia resultante a un rango razonable (p. ej. 200–1200 Hz) en vez de escalar sin límite.
- **Sacudida de cámara y el HUD del panel izquierdo.** El HUD comparte contexto con el tablero; si la traslación se aplica antes de dibujar el panel, el texto de puntuación tiembla en cada fusión grande y se lee mal justo cuando el jugador quiere leerlo. La sacudida debe envolver únicamente el dibujo del tablero.
- **`destroy()` con osciladores sonando.** Cerrar el `AudioContext` de golpe puede dejar un clic audible o lanzar una excepción en consola al salir de la partida. Rampa corta del gain maestro a 0 antes de cerrar, y guard contra doble invocación de `destroy()`.
