# 20 — SIFÓN: Mecánicas avanzadas

**Estado:** Draft
**Depende de:** SPEC 19
**Fecha:** 2026-08-30

**Objetivo:** Enriquecer el motor de SIFÓN con burbujas especiales de planta (bomba de gas, comodín de sirope y tapón de plomo), un sistema de cadenas con multiplicador y guía de trayectoria con rebotes, y una capa de presentación con audio generado por Web Audio y partículas de espuma — todo dentro de `lib/games/sifon/engine.ts`, sin tocar el contrato del catálogo ni el registry.

## Alcance

**Incluye:**

- **Sistema 1 — Burbujas especiales.** Tres tipos nuevos que pueden aparecer en la cola de disparo o en la masa generada del nivel, además de las 4 burbujas de color normales:
  - **Bomba de gas** (esfera amarilla con núcleo pulsante). Al pegarse, revienta **todas** las burbujas dentro de un radio de 2 anillos hexagonales alrededor de su celda, sin importar el color, y luego se resuelve el desprendimiento normal. No forma racimo por color. Aparece en la cola con probabilidad ~1 de cada 12 disparos a partir del nivel 2.
  - **Comodín de sirope** (burbuja blanca iridiscente con reflejo giratorio). Al pegarse, adopta el color del vecino más numeroso y participa en el flood-fill como ese color; si empata, escoge el color con más burbujas en todo el tanque. Aparece con probabilidad ~1 de cada 16 disparos a partir del nivel 3.
  - **Tapón de plomo** (burbuja gris mate, sin brillo). No aparece nunca en la cola: se genera **dentro de la masa** a partir del nivel 3 (1 tapón por fila generada a partir de la tercera fila). No revienta por color y no se puede reventar con un racimo; solo desaparece si queda desprendido y cae, o si lo alcanza una bomba. Es el elemento que obliga a jugar por desprendimiento en vez de por reventón directo.
- **Sistema 2 — Cadenas, multiplicador y guía con rebotes.**
  - **Multiplicador de cadena.** Cada disparo que revienta al menos una burbuja incrementa el contador de cadena; cada disparo que no revienta nada lo devuelve a 0. El multiplicador aplicado a la puntuación de ese disparo es `min(1 + 0.5·(cadena − 1), 4)` — es decir 1×, 1.5×, 2×, 2.5×… con tope en 4×. Se dibuja en el panel izquierdo como contador `CADENA ×N` que parpadea al subir.
  - **Bonus por desprendimiento masivo.** Desprender 5 o más burbujas de una sola vez suma un bonus adicional de `+50 × (n − 4)` sobre los +20 por burbuja ya existentes.
  - **Alivio de presión por reventón grande.** Reventar un racimo de 6 o más burbujas resta 2 al manómetro (nunca por debajo de 0). Es la única vía para retrasar el descenso de la prensa, y convierte los racimos grandes en la jugada estratégica del juego.
  - **Guía de trayectoria con rebotes.** La guía punteada de la spec 19 pasa a simular la trayectoria completa con hasta 2 rebotes en las paredes, terminando en un círculo fantasma sobre la celda donde quedaría la burbuja. Se calcula con la misma función de avance y colisión que usa el proyectil real, para que nunca mienta.
- **Sistema 3 — Presentación: audio generado y partículas.**
  - **Audio Web Audio, sin assets externos**, mismo patrón que el audio de Tetris: un `AudioContext` creado perezosamente en el primer disparo (no en el constructor, para no chocar con las políticas de autoplay del navegador), osciladores y envolventes generados en código. Sonidos: disparo (pulso corto descendente), rebote en pared (clic seco), pegado sin racimo (tono grave breve), reventón (barrido ascendente cuyo tono sube con el tamaño del racimo y con la cadena), desprendimiento (glissando descendente), bomba (ruido blanco con envolvente corta), descenso de la prensa (golpe grave), purga por pérdida de vida (sirena descendente) y game over (acorde descendente). Volumen general contenido bajo un `GainNode` maestro y silenciado completo mientras `state !== "playing"` o el motor está pausado.
  - **Partículas de espuma.** Al reventar, cada burbuja emite 6–10 gotas con gravedad y `globalAlpha` decreciente en su color; la bomba emite además un anillo de expansión. Las burbujas desprendidas dejan un rastro corto al caer. Presupuesto duro de partículas vivas (p. ej. 300) con descarte de las más antiguas, para no degradar el frame en cadenas grandes.
  - **Sacudida de cámara** breve (traslación de 2–4px amortiguada) al detonar una bomba y al descender la prensa.
- Ajuste de `short`/`long` de la fila `sifon` en `games` **solo si** las burbujas especiales justifican mencionarlas en el texto de catálogo, vía `mcp__supabase__apply_migration`. Es opcional y es el único cambio de datos permitido en esta spec.

**No incluye (fuera de alcance):**

- Cualquier cambio a `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` o `RegisteredGame`. La cadena, el manómetro y los tipos especiales son estado interno del motor y se comunican solo por el HUD dibujado en el canvas.
- Cambios en `lib/games/registry.ts` más allá de lo ya hecho en la spec 19 (la línea `sifon` ya existe), y cero cambios en `components/jugar-client.tsx`.
- Cambios en el esquema de `games` o `scores`; solo, como mucho, el texto `short`/`long` de la fila `sifon`.
- `skins` y `touchActions`: siguen siendo trabajo de `@skin-designer` y `@mobile-porter` después de esta spec.
- Assets binarios: `public/games/sifon/` sigue sin crearse. Todo el audio se sintetiza y todo el arte es procedural.
- Control de volumen o mute en la UI de `/juego/[id]/jugar`: sería un cambio en un componente compartido. El motor decide su volumen y respeta la pausa.
- Un quinto color de burbuja: se evaluó en la spec 19 y sigue descartado; la dificultad extra la aportan los tapones de plomo.
- Cambios a `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger` o `sinapsis`.

## Modelo de datos

El contrato externo **no cambia**: `SifonEngine` conserva exactamente el constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)` y los métodos `pause/resume/reset/forceGameOver/destroy` definidos en la spec 19, y `components/games/sifon-canvas.tsx` no se modifica en absoluto. Todo lo de esta spec vive dentro de `lib/games/sifon/engine.ts` (opcionalmente repartido en módulos hermanos `lib/games/sifon/audio.ts` y `lib/games/sifon/particles.ts`, importados solo desde el motor).

Cambios internos al estado del motor:

- El tipo de celda de la masa pasa de "color" a una unión discriminada: `{ kind: "color"; color: BubbleColor } | { kind: "bomb" } | { kind: "wild" } | { kind: "lead" }`. El flood-fill de color trata `bomb`, `wild` sin resolver y `lead` como celdas **no coincidentes**; el flood-fill de conectividad los trata a todos por igual (cualquier celda ocupada conecta).
- Estado nuevo: `chain: number` (cadena actual), `particles: Particle[]`, `shake: { x: number; y: number; t: number }`, y un `audio: SifonAudio | null` creado en el primer disparo.
- La selección de la burbuja siguiente pasa a consultar primero las probabilidades de especial del nivel y solo después la lista de colores presentes en el tanque (regla anti-frustración de la spec 19, que se conserva intacta).

**Mapeo de `EngineStats`** (sin cambios respecto de la spec 19):

- `score`: ahora incorpora el multiplicador de cadena y el bonus por desprendimiento masivo, pero sigue siendo un entero acumulado.
- `lives`: cargas de purga restantes, 3 → 0. Sin cambios.
- `level`: nivel actual, que ahora además gobierna las probabilidades de aparición de bomba y comodín y la cantidad de tapones de plomo generados.
- `state`: `"playing"` / `"dead"` (purga) / `"gameover"`, sin cambios. El audio se silencia fuera de `"playing"`.

**La cadena no entra en `EngineStats`**, por la misma razón que la presión en la spec 19: el contrato del catálogo es cerrado y añadir un campo obligaría a tocar `jugar-client.tsx`.

## Plan de implementación

1. **Refactor del tipo de celda a unión discriminada.** Cambiar la representación de la masa de color plano a `{ kind: ... }`, actualizar generación de nivel, render, flood-fill de color y flood-fill de conectividad para que sigan comportándose **exactamente igual** con solo celdas `kind: "color"`. Verificación: el juego se comporta idéntico a la spec 19 (racimos de 3, desprendimientos, descenso, purga, niveles) — es un refactor puro, sin cambio de comportamiento observable.
2. **Tapón de plomo.** Generar 1 tapón por fila a partir de la tercera fila de la masa en niveles ≥3, con posición determinista por nivel. Dibujarlo gris mate y sin `shadowBlur`. Excluirlo del flood-fill de color e incluirlo en el de conectividad. Verificación: en el nivel 3 los tapones son visibles, ningún racimo los revienta, y cortar la conexión por debajo los hace caer y puntuar como cualquier burbuja desprendida.
3. **Bomba de gas.** Añadir el tipo a la cola con probabilidad ~1/12 desde el nivel 2, su dibujo pulsante y su resolución al pegarse: recolectar las celdas dentro de 2 anillos hexagonales (BFS de profundidad 2 sobre el vecindario ya existente), reventarlas todas y encadenar el desprendimiento normal. Verificación: una bomba disparada al centro de la masa abre un cráter hexagonal de radio 2, revienta tapones de plomo incluidos, y las burbujas que quedan colgando caen correctamente.
4. **Comodín de sirope.** Añadir el tipo a la cola con probabilidad ~1/16 desde el nivel 3, su dibujo iridiscente con reflejo animado, y la resolución al pegarse: contar colores entre los vecinos ocupados, adoptar el mayoritario (desempate por color más abundante en el tanque) y ejecutar el flood-fill como ese color. Si no tiene vecinos de color (solo plomo o solo prensa), se queda como celda `wild` sin color y no revienta hasta que un vecino nuevo la resuelva. Verificación: el comodín pegado junto a dos burbujas cian y una magenta revienta como cian; pegado aislado se queda en el tablero y se resuelve con el disparo siguiente.
5. **Cadena, multiplicador y alivio de presión.** Contador de cadena que sube con cada disparo que revienta y se reinicia con cada disparo estéril; multiplicador `min(1 + 0.5·(cadena − 1), 4)` aplicado a la puntuación del disparo; bonus `+50 × (n − 4)` para desprendimientos de 5 o más; −2 de presión al reventar racimos de 6 o más. Dibujar `CADENA ×N` en el panel izquierdo con parpadeo al subir. Verificación: tres disparos productivos seguidos muestran ×2 y la puntuación del tercero es efectivamente el doble de su valor base; un disparo estéril devuelve el contador a 1× de inmediato; un racimo de 6 baja el manómetro dos muescas.
6. **Guía de trayectoria con rebotes.** Extraer la lógica de avance-y-colisión del proyectil a una función pura reutilizable y ejecutarla en modo simulación (sin mutar estado) desde la posición de la boquilla con el ángulo actual, hasta 2 rebotes o hasta colisión. Dibujar la polilínea punteada y el círculo fantasma en la celda destino. Recalcular solo cuando cambia el ángulo o la masa, no en cada frame. Verificación: el círculo fantasma coincide siempre con la celda donde acaba realmente la burbuja, incluidos disparos con dos rebotes; rotar la boquilla actualiza la guía sin caída de framerate perceptible.
7. **Audio generado.** Crear el módulo de audio con `AudioContext` perezoso (primer disparo), `GainNode` maestro y una función por efecto (disparo, rebote, pegado, reventón con tono según tamaño y cadena, desprendimiento, bomba, descenso de la prensa, purga, game over). Silenciar mientras `state !== "playing"` o el motor está pausado, y cerrar el contexto en `destroy()`. Verificación: se oyen todos los efectos en su momento correcto, no hay warning de autoplay en consola al cargar la página, pausar corta el sonido, y salir de la partida no deja el contexto abierto.
8. **Partículas y sacudida.** Sistema de partículas con presupuesto duro y descarte de las más antiguas: gotas al reventar, anillo de expansión de la bomba, rastro de las burbujas que caen. Sacudida de cámara amortiguada al detonar bomba y al bajar la prensa, aplicada con una traslación en el contexto que se revierte al final del frame. Verificación: una cadena de reventones grandes mantiene el framerate estable y el presupuesto de partículas no se desborda; la sacudida no desplaza permanentemente el HUD ni recorta el dibujo del pozo.
9. **Balance y textos.** Jugar tres partidas completas hasta el nivel 4 y ajustar únicamente las constantes de probabilidad de especiales, el tope del multiplicador y el número de tapones si algo resulta injusto o trivial. Si las especiales merecen aparecer en la ficha del catálogo, actualizar `short`/`long` de la fila `sifon` vía `mcp__supabase__apply_migration` (migración `update_game_sifon_texts`). Verificación: `select short, long from games where id = 'sifon';` refleja el texto final si se cambió.
10. **Verificación en navegador y build.** Recorrer `/juego/sifon/jugar` completo: bomba, comodín y plomo aparecen y se comportan según lo descrito, la cadena multiplica y se reinicia, la guía con rebotes acierta la celda destino, el audio suena y respeta la pausa, las partículas no degradan el frame, el HUD interno y el `player-hud` externo siguen sincronizados, PAUSA/FIN/game over/guardar puntuación/JUGAR DE NUEVO/SALIR siguen funcionando igual que en la spec 19, y la puntuación guardada aparece en `/juego/sifon` y `/salon-de-la-fama`. Confirmar que los otros seis juegos siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] El refactor del tipo de celda no cambia ningún comportamiento observable con solo burbujas de color.
- [ ] Los tapones de plomo aparecen a partir del nivel 3, no revientan por racimo y sí caen al quedar desprendidos.
- [ ] Una bomba revienta todas las celdas dentro de 2 anillos hexagonales, incluidos tapones de plomo, y dispara el desprendimiento posterior.
- [ ] El comodín adopta el color del vecino mayoritario; aislado, permanece en el tablero sin reventar.
- [ ] Las especiales solo aparecen en la cola desde el nivel indicado (bomba ≥2, comodín ≥3) y el plomo nunca aparece en la cola.
- [ ] La cadena sube con cada disparo productivo, se reinicia con cada disparo estéril y el multiplicador está topado en 4×.
- [ ] Un desprendimiento de 5 o más burbujas suma el bonus `+50 × (n − 4)` además de los +20 por burbuja.
- [ ] Reventar un racimo de 6 o más resta 2 al manómetro, sin bajar de 0.
- [ ] La guía de trayectoria predice hasta 2 rebotes y el círculo fantasma coincide siempre con la celda final real del disparo.
- [ ] El `AudioContext` se crea en el primer disparo, no al montar el canvas, y no genera warnings de autoplay en consola.
- [ ] El audio se silencia durante pausa, `"dead"` y `"gameover"`, y el contexto se cierra en `destroy()`.
- [ ] Las partículas respetan el presupuesto máximo y una cadena de reventones grandes no degrada el framerate de forma perceptible.
- [ ] La sacudida de cámara se revierte por completo cada frame: el HUD y el pozo nunca quedan desplazados.
- [ ] `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` y `GAME_REGISTRY` quedan exactamente igual que tras la spec 19.
- [ ] `components/games/sifon-canvas.tsx` y `components/jugar-client.tsx` no se modifican.
- [ ] Guardar la puntuación sigue insertando en `scores` y apareciendo en `/juego/sifon` y `/salon-de-la-fama`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Tres especiales y no más.** Bomba (rompe por área), comodín (rompe por color) y plomo (bloquea) cubren los tres ejes del género sin solaparse. Se descartaron el rayo horizontal (redundante con la bomba), la burbuja que congela la prensa (haría irrelevante el manómetro, que es la tensión central del juego) y la burbuja imantada (difícil de leer visualmente en una rejilla hexagonal ya densa).
- **El plomo solo se genera en la masa, nunca en la cola.** Recibir un tapón para disparar sería recibir un turno perdido: castigo puro sin decisión. Dentro de la masa, en cambio, es un problema que se resuelve con planificación, y es lo que empuja al jugador hacia la jugada más interesante del género (cortar por debajo en vez de reventar por color).
- **La bomba usa BFS de profundidad 2 sobre el vecindario hexagonal existente, no un radio euclídeo en píxeles.** Reutiliza código ya escrito y verificado en la spec 19, y produce un cráter hexagonal limpio y predecible en vez de un círculo con bordes irregulares que el jugador no puede anticipar.
- **Multiplicador topado en 4×.** Sin tope, una racha larga en un tanque generoso dispararía la puntuación varios órdenes de magnitud por encima de una partida normal y haría el leaderboard compartido de `/salon-de-la-fama` ilegible frente al resto del catálogo. El tope mantiene el rango de puntuaciones comparable con Tetris y Arkanoid.
- **Alivio de presión por racimo grande en vez de por cualquier reventón.** Si cualquier racimo de 3 restara presión, la prensa casi nunca bajaría y desaparecería la amenaza. Exigir 6 o más convierte el alivio en una jugada buscada y no en un efecto secundario automático.
- **Guía con rebotes incluida, pese a que facilita el juego.** En la spec 19 se dejó fuera deliberadamente para poder decidir jugando. Se incluye aquí porque sin ella los ángulos cercanos al tope de ±75° son puro ensayo y error, lo que empuja al jugador a disparar siempre en vertical y desperdicia los rebotes, que son la mecánica distintiva del pozo estrecho. Se acota a 2 rebotes para que siga habiendo espacio de habilidad en los tiros más rebuscados.
- **La guía se calcula con la misma función que mueve el proyectil real.** Una simulación aparte se desincronizaría en cuanto se ajustara la velocidad o el radio de colisión, y una guía que miente es peor que no tener guía. El coste es un pequeño refactor a función pura, que además facilita probar la colisión de forma aislada.
- **Audio sintetizado con Web Audio, sin archivos.** Mismo criterio que Tetris: cero binarios en `public/`, cero peso de bundle y control total del tono (el reventón sube de pitch con el tamaño del racimo y con la cadena, algo imposible con un sample fijo sin varios archivos).
- **`AudioContext` creado en el primer disparo, no en el constructor.** Los navegadores bloquean el audio sin interacción previa del usuario; crearlo al montar el canvas produciría un warning en consola en cada carga de la página de juego y un contexto suspendido inútil.
- **Sin control de volumen en la UI.** Añadirlo implicaría tocar `components/jugar-client.tsx` o un componente compartido para un solo juego, exactamente lo que el contrato del catálogo prohíbe. El motor se autolimita con un `GainNode` maestro conservador y respeta la pausa.
- **Presupuesto duro de partículas con descarte de las más antiguas.** Sin cota, una cadena grande con bomba puede generar miles de partículas y hundir el framerate justo en el momento más vistoso de la partida — el peor instante posible para una caída de rendimiento.
- **La cadena no se muestra en el HUD externo.** Como la presión en la spec 19, vive en el canvas. El contrato de `EngineStats` se mantiene cerrado para que añadir el juego N+1 siga siendo una línea en `GAME_REGISTRY`.
- **Esta spec no toca el registry ni el wrapper.** Todo el alcance cabe dentro del motor, lo que la hace mergeable de forma independiente y trivialmente reversible si el balance no convence.

## Riesgos identificados

- **Comodín sin resolver dentro de la masa.** Un comodín pegado sin vecinos de color queda en un estado intermedio: si el flood-fill de color no lo trata explícitamente como "no coincidente", puede unirse a racimos de cualquier color y reventar el tanque entero por accidente. Definir su comportamiento en los dos flood-fill antes de escribir el render, y probar el caso de comodín rodeado solo de plomo.
- **Bomba pegada al borde del pozo o a la prensa.** El BFS de radio 2 debe recortarse contra los límites de la rejilla; sin ese recorte, las celdas fuera del pozo producirán índices inválidos o, peor, se plegarán al otro lado de la fila por aritmética de columnas.
- **Interacción entre bomba y desprendimiento en el mismo frame.** La bomba puede vaciar la base de varias columnas a la vez y desprender medio tanque; si el desprendimiento se calcula antes de retirar todas las celdas reventadas por la bomba, quedarán burbujas huérfanas flotando permanentemente. El orden es: reventar todo lo de la bomba, retirar de la masa, y solo entonces ejecutar la conectividad, una sola vez.
- **Alivio de presión aplicado durante `"dead"`.** Si un racimo grande se resuelve en el mismo evento que dispara la purga, el −2 de presión puede aplicarse sobre una presión ya reseteada a 0 y dejarla negativa. Acotar con `max(0, ...)` y decidir explícitamente el orden entre resolución de puntuación y purga.
- **Guía recalculada en cada frame.** Simular la trayectoria completa con colisión contra ~160 burbujas en cada frame mientras se mantiene pulsada una flecha es caro. Cachear el resultado e invalidarlo solo al cambiar el ángulo o la masa; si aun así pesa, reducir el submuestreo de la simulación respecto del proyectil real, aceptando un error de menos de medio radio.
- **Sacudida de cámara y el cacheo offscreen de la masa.** Si la masa se cachea en un canvas offscreen (recomendado en la spec 19 por coste de render), la traslación de la sacudida debe aplicarse al pintar ese canvas, no dentro de él; en caso contrario se invalidaría la caché cada frame durante la sacudida y se perdería justo la optimización que evita la caída de framerate.
- **`destroy()` con audio pendiente.** Si se sale de la partida con osciladores todavía sonando, cerrar el `AudioContext` de golpe puede dejar un clic audible o una excepción en consola. Bajar el gain maestro a 0 con una rampa corta antes de cerrar, y proteger el cierre contra doble invocación de `destroy()`.
- **Probabilidades de especiales y la regla de colores presentes.** La selección de la burbuja siguiente consulta primero las especiales y después los colores del tanque; si el tanque queda con un solo color y sale una racha de especiales, el jugador puede no recibir nunca el color que necesita para terminar el nivel. Garantizar que tras dos especiales consecutivas la siguiente sea obligatoriamente de color.
