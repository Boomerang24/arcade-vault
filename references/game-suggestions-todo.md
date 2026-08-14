# Sugerencias de juegos — TODO

Memoria persistente de `@game-planner`. Solo ese agente escribe aquí.
Categorías válidas: ARCADE · PUZZLE · SHOOTER · VERSUS

## Pendientes

<!-- - [ ] **NOMBRE** — `CATEGORÍA` · sugerido AAAA-MM-DD
  - Encaje: mapeo a EngineStats (score/lives/level/state), 1 canvas o multi-canvas, loop por frame o por turnos.
  - Hueco: qué categoría llena.
  - Cover: clase cover-* a reutilizar.
  - Fuente: carpeta en references/started-games/ o "desde cero".
  - Esfuerzo: bajo/medio/alto. Riesgo: principal riesgo o decisión pendiente. -->

- [ ] **DUELO** (Pong 2 jugadores local, mismo teclado) — `VERSUS` · sugerido 2026-08-14 · **recomendación #1**
  - Encaje: 1 canvas, loop por frame. Mapeo forzado y debe documentarse: `score` = puntos combinados de la partida (o del líder), `lives` reutilizado como puntos restantes para que el líder gane (no vidas reales), `level` = ronda, `state` playing/dead (punto anotado, transición corta) /gameover (alguien alcanza el puntaje de victoria). El contrato es de un jugador; un duelo real necesita este tipo de reinterpretación — no se puede evitar sin extender `EngineStats`, cosa que está prohibida.
  - Hueco: `VERSUS` no tiene ningún juego — único hueco total del catálogo (ARCADE×2, SHOOTER×1, PUZZLE×1, VERSUS×0).
  - Cover: `cover-duelo` (existe en `app/globals.css:501`, sin usar por ningún juego — ya diseñada para esto).
  - Fuente: desde cero (nada en `references/started-games/`).
  - Esfuerzo: medio. Riesgo: el mapeo forzado de `score`/`lives` puede resultar confuso en el HUD/leaderboard; conviene decidir en la spec qué numero exacto se guarda en `scores` (¿puntos del ganador? ¿diferencia?) antes de implementar.

- [ ] **INVADERS** (Space Invaders clásico) — `SHOOTER` · sugerido 2026-08-14 · alternativa de menor riesgo
  - Encaje: 1 canvas, loop por frame. Mapeo limpio y sin forzar: `score` = puntos por alien destruido, `lives` = vidas del jugador (3), `level` = oleada actual, `state` playing/dead(colisión)/gameover(vidas a 0). El contrato encaja igual de bien que asteroides/arkanoid.
  - Hueco: no es un hueco total (SHOOTER ya tiene asteroides), pero balancea el catálogo frente a ARCADE (2 juegos) sin sumar otro ARCADE.
  - Cover: `cover-invaders` (existe en `app/globals.css:455`, sin usar).
  - Fuente: desde cero (nada en `references/started-games/`).
  - Esfuerzo: bajo. Riesgo: gráficos procedurales de las filas de aliens en canvas, sin sprites — manejable con rectángulos/formas simples coherentes con la estética retro.

- [ ] **PAC-MAN-LIKE** (glotón en laberinto) — `ARCADE` · sugerido 2026-08-14 · baja prioridad
  - Encaje: 1 canvas, movimiento en grilla (loop por frame con input discreto). `score` = pellets comidos, `lives` = vidas reales, `level` = laberinto/velocidad de fantasmas, `state` playing/dead/gameover. Encaje limpio.
  - Hueco: ninguno — ARCADE ya es la categoría más poblada (2 juegos); este sería el tercero.
  - Cover: `cover-glot` (existe en `app/globals.css:436`, sin usar).
  - Fuente: desde cero.
  - Esfuerzo: medio (IA simple de fantasmas). Riesgo: sobre-representa ARCADE frente a VERSUS/SHOOTER; solo tiene sentido si se descarta DUELO o INVADERS.

- [ ] **RANA** (tipo Frogger, cruzar carriles) — `ARCADE` · sugerido 2026-08-14 · baja prioridad
  - Encaje: 1 canvas, loop por frame con scroll de carriles. `score` = avances/cruces logrados, `lives` = vidas reales, `level` = velocidad/número de carriles, `state` playing/dead/gameover. Encaje limpio.
  - Hueco: ninguno — mismo problema que PAC-MAN-LIKE, infla ARCADE.
  - Cover: `cover-rana` (existe en `app/globals.css:491`, sin usar).
  - Fuente: desde cero.
  - Esfuerzo: bajo-medio. Riesgo: ninguno técnico relevante; el único freno es la diversidad de categorías.

- [ ] **VUELO** (tipo Flappy Bird, volar/esquivar tuberías) — `ARCADE` · sugerido 2026-08-14
  - Encaje: 1 canvas, loop por frame, físicas mínimas (gravedad+salto). Mapeo limpio sin forzar: `score`=tuberías pasadas, `lives`=1 o vidas reales, `level`=velocidad de scroll, `state` playing/dead(colisión)/gameover.
  - Hueco: ninguno — infla ARCADE, ya la categoría más poblada.
  - Cover: ninguno libre (los 4 covers sin usar ya están reservados por DUELO/INVADERS/PAC-MAN-LIKE/RANA); requeriría clase CSS nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo. Riesgo: ninguno técnico; menor riesgo/esfuerzo de las 5 propuestas ARCADE adicionales de esta ronda.

- [ ] **PIRÁMIDE** (tipo Q*bert, saltos isométricos) — `ARCADE` · sugerido 2026-08-14
  - Encaje: `score`=cubos cambiados de color, `lives`=vidas reales, `level`=pirámide/velocidad enemigos, `state` estándar. Riesgo no está en EngineStats sino en el renderizado isométrico.
  - Hueco: ninguno — infla ARCADE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio-alto (proyección isométrica, grilla triangular).

- [ ] **BARRILES** (tipo Donkey Kong, plataformas) — `ARCADE` · sugerido 2026-08-14
  - Encaje: `score`=puntos por esquivar/saltar+altura, `lives`=vidas reales, `level`=plataforma/velocidad, `state` estándar. Motor de físicas (escaleras, colisión plataforma-jugador) más complejo que lo ya implementado.
  - Hueco: ninguno — infla ARCADE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: alto (física de plataformas + IA simple de barriles).

- [ ] **MISILES** (tipo Missile Command, defender ciudades) — `ARCADE` · sugerido 2026-08-14
  - Encaje: `score`=misiles interceptados, `lives`=ciudades restantes (mapeo natural), `level`=oleada, `state` estándar. Roza SHOOTER temáticamente pero el género clásico lo cataloga como ARCADE/reacción.
  - Hueco: ninguno — infla ARCADE. (Ver también DEFENSA AÉREA, versión SHOOTER de esta misma idea — elegir una sola.)
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio (trayectorias parabólicas simples, explosión por radio).

- [ ] **PINBALL** (flipper simplificado, 2 flippers) — `ARCADE` · sugerido 2026-08-14
  - Encaje: `score`=puntos por bumpers/rampas, `lives`=bolas restantes (3), `level`=multiplicador/etapa, `state` estándar. Mapeo conceptualmente limpio pero física de colisión bola-flipper-bumpers es la más compleja del lote ARCADE.
  - Hueco: ninguno — infla ARCADE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: alto. Riesgo técnico más alto de las 20 propuestas de esta ronda (tunneling de colisión, ángulos de rebote, timing de flippers).

- [ ] **BURBUJAS** (tipo Puzzle Bobble, disparar burbujas para agrupar) — `PUZZLE` · sugerido 2026-08-14
  - Encaje: `score`=burbujas reventadas, `lives`=disparos antes que baje el techo (o vidas reales), `level`=patrón/velocidad del techo, `state` playing/dead(techo toca el suelo)/gameover. El más "arcade" del lote PUZZLE; buen contraste con Tetris (lateral/apuntado vs. caída vertical).
  - Hueco: PUZZLE solo tiene tetris (1) — balancea la categoría.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio (colisión círculo-círculo, snap a grilla hexagonal).

- [ ] **2048** (deslizar y fusionar fichas numeradas) — `PUZZLE` · sugerido 2026-08-14
  - Encaje: turnos, no frame-loop. Mapeo forzado (similar a DUELO, documentar en spec): `score`=suma de fusiones, `lives`=sin concepto real (forzar a 1 o "movimientos sin fusión"), `level`=ficha máxima alcanzada, `dead` prácticamente sin uso.
  - Hueco: balancea PUZZLE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo (grilla 4x4, sin física ni sprites).

- [ ] **BUSCAMINAS** (Minesweeper) — `PUZZLE` · sugerido 2026-08-14 · mapeo más fiel del lote PUZZLE
  - Encaje: turnos (revelar celdas). Mapeo limpio: `lives`=1 (mina=game over inmediato), `score`=celdas reveladas, `level`=dificultad/tamaño de grilla, `state` estándar. El que mejor respeta la semántica original de `lives`/`dead` de todo este lote.
  - Hueco: balancea PUZZLE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo (flood-fill simple, sin animación compleja).

- [ ] **SOKOBAN** (empujar cajas a objetivos) — `PUZZLE` · sugerido 2026-08-14
  - Encaje: turnos por grilla. Mapeo más forzado del lote PUZZLE (similar riesgo a DUELO): no hay "muerte" natural, `lives`/`dead` sin uso real salvo como reintentos; `score`=inverso de movimientos o niveles completados.
  - Hueco: balancea PUZZLE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio (requiere diseñar varios niveles/mapas).

- [ ] **MEMORIA** (Concentración, voltear pares) — `PUZZLE` · sugerido 2026-08-14
  - Encaje: turnos con temporizador visual. `score`=pares acertados, `lives`=intentos fallidos permitidos, `level`=tamaño de grilla/ronda, `state` estándar. Menos "arcade" en sensación, más casual.
  - Hueco: balancea PUZZLE.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo (sin física, solo estado de cartas + timer).

- [ ] **ESCUADRÓN** (tipo Galaga, formaciones en picada) — `SHOOTER` · sugerido 2026-08-14 · mejor equilibrio del lote SHOOTER
  - Encaje: limpio y sin forzar. `score`=aliens destruidos, `lives`=vidas reales (3), `level`=oleada/patrón, `state` estándar. Mismo molde ya probado por asteroides; complementa a INVADERS sin duplicarlo (formación fija+disparo vs. patrones de vuelo+picada).
  - Hueco: balancea SHOOTER frente a ARCADE.
  - Cover: ninguno libre (los 4 libres ya reservados); nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio (patrones de movimiento en curva).

- [ ] **CIEMPIÉS** (tipo Centipede) — `SHOOTER` · sugerido 2026-08-14 · alternativa a ESCUADRÓN
  - Encaje: limpio. `score`=segmentos/arañas eliminados, `lives`=vidas reales, `level`=velocidad/densidad del campo, `state` estándar.
  - Hueco: balancea SHOOTER.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio (fragmentación del ciempiés al impactar es el punto delicado).

- [ ] **ESCUADRÓN VERTICAL** (shooter de scroll vertical, tipo 1942) — `SHOOTER` · sugerido 2026-08-14
  - Encaje: limpio en el papel, pero scroll continuo + variedad de enemigos + posibles power-ups es más ambicioso que cualquier juego actual del catálogo.
  - Hueco: balancea SHOOTER.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: alto. Riesgo: el más caro del lote SHOOTER, mayor riesgo de alcance.

- [ ] **DEFENSA AÉREA** (tipo Missile Command, torreta antimisiles) — `SHOOTER` · sugerido 2026-08-14 · opción de menor esfuerzo
  - Encaje: mapeo parcialmente forzado (documentar como DUELO): `score`=misiles interceptados, `level`=oleada, `lives`=ciudades restantes en vez de vidas del jugador. Duplica la idea de MISILES (versión ARCADE) — elegir una sola categoría para este concepto.
  - Hueco: balancea SHOOTER.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo-medio (apuntar+disparar, formas geométricas simples).

- [ ] **CACERÍA** (tipo light-gun/Duck Hunt) — `SHOOTER` · sugerido 2026-08-14 · mapeo más forzado del lote SHOOTER
  - Encaje: `lives` tendría que representar "disparos fallados permitidos"; sin colisión física de nave, se aleja del molde de asteroides/arkanoid/snake.
  - Hueco: balancea SHOOTER.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo.

- [ ] **TRON / CICLOS DE LUZ** (2 motos dejan estela, pierde quien choca) — `VERSUS` · sugerido 2026-08-14 · menor riesgo técnico tras DUELO
  - Encaje: 1 canvas, grid+frame loop, input dual (WASD/flechas). `score`=casillas recorridas por el líder, `lives`/`state` con el mismo patrón forzado que DUELO. Sin física de pelota (menos riesgo de bugs que Pong).
  - Hueco: VERSUS sigue en 0 salvo que se implemente DUELO primero — cualquiera de estos 5 lo llenaría igual.
  - Cover: ninguno libre (`cover-duelo` ya reservado); nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio.

- [ ] **BATALLA DE TANQUES** (arena con obstáculos, 2 jugadores) — `VERSUS` · sugerido 2026-08-14
  - Encaje: mapeo forzado igual a DUELO, pero `lives` puede representar impactos recibidos reales — menos forzado que Pong-like.
  - Hueco: alternativa a DUELO para VERSUS.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio-alto (colisiones proyectil-obstáculo-tanque).

- [ ] **SERPIENTES RIVALES** (Snake Duel, 2 serpientes mismo tablero) — `VERSUS` · sugerido 2026-08-14 · recomendación #1 si se implementa más de un VERSUS
  - Encaje: reutiliza casi el motor de `snake` (grid, frame loop) — menor riesgo técnico del lote porque hay precedente directo en `lib/games/snake/`. Mapeo forzado de `lives`/`state` igual que DUELO.
  - Hueco: alternativa/complemento a DUELO para VERSUS.
  - Cover: ninguno libre (no reutilizar `cover-snake`, ya usada); nueva.
  - Fuente: adaptar `lib/games/snake/` existente.
  - Esfuerzo: bajo-medio (motor base ya existe, añadir 2º jugador y colisión cruzada).

- [ ] **HOCKEY DE MESA** (air hockey, disco + 2 mazos) — `VERSUS` · sugerido 2026-08-14 · riesgo de redundancia con DUELO
  - Encaje: física de rebote simple, mismo patrón forzado que DUELO. Conceptualmente muy cercano a DUELO/Pong (pelota+2 controles+puntaje) — compite por el mismo nicho.
  - Hueco: redundante si DUELO ya se implementa.
  - Cover: ninguno libre; nueva.
  - Fuente: desde cero.
  - Esfuerzo: medio. Riesgo principal: redundancia con DUELO, no técnico.

- [ ] **DUELO RÁPIDO** (quick-draw, reaccionar a una señal) — `VERSUS` · sugerido 2026-08-14 · esfuerzo más bajo del lote VERSUS
  - Encaje: turnos/eventos discretos (timer+input), no frame-loop continuo. `state` mapea limpio: playing(espera)/dead(falla o pierde ronda)/gameover(gana N rondas). `lives`=rondas restantes (uso real, no forzado) y `score`=tiempo de reacción o rondas ganadas — el mapeo menos forzado de los VERSUS nuevos.
  - Hueco: buen "quick win" para no dejar VERSUS con un único juego.
  - Cover: ninguno libre (visual minimalista, fácil de diseñar); nueva.
  - Fuente: desde cero.
  - Esfuerzo: bajo.

## Descartadas

<!-- - [x] ~~**NOMBRE**~~ — motivo, fecha. -->

## Implementadas

- [x] **ASTEROIDES** — `SHOOTER` · spec 05
- [x] **TETRIS** — `PUZZLE` · spec 07
- [x] **ARKANOID** — `ARCADE` · spec 08
- [x] **SNAKE** — `ARCADE` · spec 09
