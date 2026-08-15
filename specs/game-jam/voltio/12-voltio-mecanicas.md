# 12 — VOLTIO: Mecánicas avanzadas

**Estado:** Draft
**Depende de:** SPEC 11
**Fecha:** 2026-08-15

**Objetivo:** Enriquecer el motor base de VOLTIO con tres sistemas nuevos — power-ups recogibles, patrones de placa por nivel con plataformas inestables y picos de tensión, y audio generado por Web Audio más efectos visuales de partículas — todo dentro de `lib/games/voltio/engine.ts` y su wrapper, sin tocar el contrato del catálogo ni la integración ya existente.

## Alcance

**Incluye:**

- **Sistema de power-ups.** Aparece como máximo un power-up a la vez en el tablero, en una celda aleatoria de una fila segura (7 o 13) o sobre una plataforma del canal, cada 12–18 segundos de juego activo. Se recoge al aterrizar sobre él y desaparece solo si no se recoge en 8 segundos. Tres tipos, con probabilidad 40/35/25:
  - **AISLANTE** (escudo, verde): absorbe la siguiente muerte por colisión con pulso o por caída al refrigerante, sin coste de vida. No protege contra el agotamiento de carga ni contra el arrastre fuera del canvas. Se consume al usarse. Indicador: aro verde pulsante alrededor de la chispa.
  - **OVERCLOCK** (turbo, magenta): durante 6 segundos, cada pulsación de flecha mueve la chispa **dos** celdas en vez de una, si el destino es válido; si el destino de dos celdas es inválido pero el de una lo es, se mueve una (degradación elegante, nunca se pierde el turno). Indicador: estela magenta detrás de la chispa y contador en el HUD.
  - **BATERÍA** (recarga, amarillo): rellena la carga al 100 al instante y suma +25 puntos. Es el más frecuente en niveles altos por el escalado de drenaje. Indicador: destello y salto visible de la barra de carga.
- **Patrones de placa por nivel.** Se sustituye el escalado puramente multiplicativo del nivel de la spec 11 por una **tabla determinista de patrones** (`LEVEL_PATTERNS`) con, como mínimo, 6 entradas que se ciclan con dificultad creciente a partir del nivel 7. Cada patrón fija, por carril: dirección, velocidad base, ancho y espaciado de pulsos, y ancho/espaciado de plataformas. Se añade una **cota superior de velocidad** por carril para que los niveles altos sigan siendo cruzables (riesgo anotado en la spec 11).
- **Condensadores inestables (a partir del nivel 3).** Una fracción de las plataformas del canal parpadea con ciclo fijo (~3s estable, ~1s en aviso parpadeante, ~1s descargada e intangible). Estar sobre una plataforma descargada equivale a caer al refrigerante. El aviso previo es siempre visible y de duración constante, para que la muerte nunca sea injusta. Es el equivalente propio a las tortugas que se sumergen del género de origen.
- **Picos de tensión (a partir del nivel 5).** Cada 10–14 segundos, un carril de bus de datos se marca durante 1,5 segundos con un parpadeo rojo de aviso en toda su franja y luego lo recorre un pico de tensión: un rayo que barre la fila completa a alta velocidad y mata al contacto, atravesando incluso a los pulsos normales. El AISLANTE sí protege de él. Nunca se dispara sobre la fila donde está la chispa si es la única casilla segura disponible; el aviso da tiempo suficiente para salir.
- **Audio generado con Web Audio, sin assets externos.** Mismo patrón que Tetris (spec 07): un `AudioContext` creado perezosamente dentro del motor en la primera interacción de teclado del usuario (nunca en el constructor, para no chocar con la política de autoplay de los navegadores), osciladores y envolventes generados en código. Efectos: salto (blip corto), nodo energizado (arpegio ascendente de 3 notas), placa completa (arpegio largo), muerte (ruido descendente de cortocircuito), power-up recogido (blip doble, timbre distinto por tipo), aviso de pico de tensión (zumbido grave), carga crítica por debajo de 20 (bip intermitente). Sin música de fondo. El audio se silencia en `pause()` y se cierra en `destroy()`.
- **Efectos visuales.** Partículas de chispa en cada salto (3–5 partículas cortas en dirección contraria al movimiento), explosión de cortocircuito al morir, halo creciente al energizar un nodo, brillo pulsante en los nodos ya energizados, flash blanco breve del canvas al recoger un power-up, y screen-shake sutil (≤4px, ≤250ms) al morir y al pasar un pico de tensión. Todo con primitivas de canvas; sin librerías nuevas.
- **HUD interno ampliado.** Los indicadores de power-up activo (icono + segundos restantes) se dibujan en la franja superior del canvas, junto a puntuación, nivel y nodos. La franja inferior mantiene carga y vidas, y añade el parpadeo rojo de carga crítica.
- **Puntuación.** BATERÍA suma +25. Sobrevivir a un pico de tensión que barre la fila donde estaba la chispa hasta 1 celda antes suma +100 ("esquive"). El resto del sistema de puntos de la spec 11 no cambia.
- Todo lo anterior vive en `lib/games/voltio/engine.ts` (o módulos hermanos dentro de `lib/games/voltio/`, p. ej. `patterns.ts` y `audio.ts`) y, si hace falta, en `components/games/voltio-canvas.tsx`.

**No incluye (fuera de alcance):**

- Cualquier cambio a `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` o `RegisteredGame`. Los power-ups y la carga **no** se exponen al HUD externo.
- Cambios a `lib/games/registry.ts` (`voltio` ya está registrado desde la spec 11) o a `components/jugar-client.tsx`.
- Cambios al esquema de `games` o `scores`. Como mucho, un `update` de `short`/`long` de la fila `voltio` si los textos redactados en la spec 11 se quedan cortos frente a las mecánicas nuevas — es el único toque a base de datos permitido aquí.
- Assets binarios (sprites, samples de audio, música). Todo el audio es sintetizado y todo el arte es procedural.
- Control de volumen o toggle de silencio en la UI (no existe en el resto del catálogo; añadirlo sería una feature transversal con su propia spec).
- Power-ups negativos, enemigos que persigan a la chispa, o modificaciones al mapa de filas fijado en la spec 11.
- Cambios a `asteroides`, `tetris`, `arkanoid` o `snake`.

## Modelo de datos

El contrato externo **no cambia**: `VoltioEngine` conserva exactamente la firma de la spec 11 (`constructor(canvas, callbacks)`, `pause/resume/reset/forceGameOver/destroy`) y el wrapper `components/games/voltio-canvas.tsx` no cambia su forma `forwardRef`. Solo se añade estado interno al motor:

```ts
// lib/games/voltio/engine.ts — tipos internos nuevos (no exportados al registry)
type PowerUpKind = "aislante" | "overclock" | "bateria";

type PowerUp = {
  kind: PowerUpKind;
  col: number; // float: puede viajar sobre una plataforma del canal
  row: number;
  ttl: number; // segundos restantes antes de desaparecer sin recogerse
  carrierId: number | null; // plataforma sobre la que viaja, si aplica
};

type ActiveEffects = {
  aislante: boolean; // escudo disponible
  overclockUntil: number; // timestamp interno; 0 si inactivo
};

type Platform = {
  id: number;
  col: number;
  row: number;
  width: number; // en celdas
  unstable: boolean; // parpadea y se descarga (nivel >= 3)
  phase: number; // desfase del ciclo estable/aviso/descargada
};

type Surge = {
  row: number;
  state: "warning" | "sweeping";
  t: number; // segundos en el estado actual
  dir: 1 | -1;
  x: number; // px, solo en "sweeping"
};
```

```ts
// lib/games/voltio/patterns.ts
export type LanePattern = {
  dir: 1 | -1;
  speed: number; // px/s
  size: number; // ancho en celdas (pulso o plataforma)
  gap: number; // separación en celdas
};

export type LevelPattern = {
  buses: LanePattern[]; // 5 entradas, filas 8-12
  coolant: LanePattern[]; // 5 entradas, filas 2-6
  drainRate: number; // unidades de carga por segundo
  unstableRatio: number; // fracción de plataformas inestables (0 si nivel < 3)
};

export const LEVEL_PATTERNS: LevelPattern[]; // >= 6 entradas
export const MAX_LANE_SPEED: number; // cota superior aplicada al escalar niveles altos
export function getLevelPattern(level: number): LevelPattern; // cicla y escala con cota
```

```ts
// lib/games/voltio/audio.ts
export class VoltioAudio {
  ensureStarted(): void; // crea el AudioContext perezosamente, en la 1ª tecla del usuario
  jump(): void;
  node(): void;
  boardComplete(): void;
  death(): void;
  powerUp(kind: "aislante" | "overclock" | "bateria"): void;
  surgeWarning(): void;
  lowCharge(): void;
  setMuted(muted: boolean): void; // usado por pause()/resume()
  destroy(): void; // cierra el AudioContext
}
```

**Mapeo de `EngineStats` (sin cambios respecto a la spec 11):**

- `score`: se le suman los +25 de BATERÍA y los +100 de esquive de pico de tensión. Mismo campo, misma semántica.
- `lives`: sin cambios. El AISLANTE evita que una muerte descuente vida, pero no altera el rango 3 → 0 ni cuándo se dispara el game over.
- `level`: sin cambios en su significado; lo que cambia es cómo se traduce a dificultad (tabla `LEVEL_PATTERNS` con cota de velocidad en vez de multiplicador libre).
- `state`: sin cambios. Los power-ups activos se pierden al entrar en `"dead"` (el escudo también, si no se había consumido), y no se conservan entre vidas.

## Plan de implementación

1. **Tabla de patrones por nivel.** Crear `lib/games/voltio/patterns.ts` con `LanePattern`/`LevelPattern`, al menos 6 entradas de `LEVEL_PATTERNS`, `MAX_LANE_SPEED` y `getLevelPattern(level)` (cicla la tabla y aplica un escalado acotado a partir del nivel 7). Sustituir en el motor el escalado multiplicativo de la spec 11 por llamadas a `getLevelPattern`. Verificación: jugar los niveles 1 a 6 confirma que cada placa tiene una silueta de tráfico distinta y todas son cruzables; los niveles 8+ no superan `MAX_LANE_SPEED`.
2. **Condensadores inestables.** Añadir `unstable`/`phase` a las plataformas del canal, generarlas según `unstableRatio` a partir del nivel 3, dibujar los tres estados (estable, aviso parpadeante, descargada semitransparente) y tratar "sobre plataforma descargada" igual que "en refrigerante sin plataforma". Verificación: en nivel 3 hay plataformas que parpadean con aviso claro y constante antes de descargarse, y quedarse sobre una descargada cuesta una vida.
3. **Sistema de power-ups.** Añadir el spawner (máximo uno a la vez, cada 12–18s, TTL 8s, colocado en fila segura o sobre una plataforma con `carrierId`), la recogida por aterrizaje, los tres efectos (AISLANTE consumible, OVERCLOCK de 6s con salto doble y degradación elegante, BATERÍA con recarga +25 puntos) y su limpieza al entrar en `"dead"`, en `reset()` y al subir de nivel. Verificación: cada tipo se recoge, aplica su efecto observable, expira correctamente, y un power-up sobre una plataforma viaja con ella.
4. **Picos de tensión.** Implementar la máquina de estados `Surge` (`warning` 1,5s con parpadeo rojo de la franja → `sweeping` barrido a alta velocidad), la selección de fila (nunca la única casilla segura disponible para la chispa), la muerte al contacto, la protección del AISLANTE y el bonus de +100 por esquive ajustado. Activo a partir del nivel 5. Verificación: en nivel 5 el aviso es inequívoco y da tiempo de sobra a salir de la fila; el barrido mata; con escudo, no.
5. **Audio Web Audio.** Crear `lib/games/voltio/audio.ts` con `VoltioAudio`, inicialización perezosa en la primera pulsación de teclado, y los efectos listados en el Alcance mediante osciladores + envolventes de ganancia. Cablearlos desde el motor en cada evento correspondiente, silenciar en `pause()`, reanudar en `resume()` y cerrar el `AudioContext` en `destroy()`. Verificación: no hay warning de autoplay en consola al cargar la página, cada evento suena de forma distinguible, el sonido se corta al pausar y no queda ningún `AudioContext` vivo tras salir de la partida.
6. **Efectos visuales y HUD ampliado.** Añadir el pool de partículas (salto, muerte, halo de nodo), el flash de power-up, el screen-shake acotado (≤4px, ≤250ms), el brillo pulsante de los nodos energizados, los indicadores de power-up activo en la franja superior y el parpadeo rojo de carga crítica en la inferior. Verificación: los efectos son legibles sin tapar los obstáculos, el HUD interno sigue cabiendo en sus dos franjas de 40px, y el framerate se mantiene estable con muchas partículas en pantalla.
7. **Balance y textos.** Jugar una partida completa hasta game over ajustando frecuencias de spawn, duración del OVERCLOCK y `drainRate` por nivel. Si los textos de la fila `voltio` en `games` se quedan cortos frente a las mecánicas nuevas, actualizarlos con una migración `update_game_voltio_texts` vía `mcp__supabase__apply_migration`. Verificación: una partida media alcanza al menos el nivel 3 sin que el juego se sienta ni trivial ni imposible.
8. **Verificación en navegador y build.** En `/juego/voltio/jugar`: recoger los tres power-ups y ver su efecto e indicador; morir sobre un condensador descargado; sobrevivir a un pico de tensión y comprobar el +100; confirmar que el HUD externo (`player-hud`) sigue mostrando solo Puntuación/Vidas/Nivel y sigue sincronizado; que PAUSA congela también power-ups, picos, partículas y audio; que el game over, el guardado de puntuación y la aparición en `/juego/voltio` y `/salon-de-la-fama` siguen funcionando igual que en la spec 11. Confirmar que los otros cuatro juegos siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] Existe `lib/games/voltio/patterns.ts` con al menos 6 entradas en `LEVEL_PATTERNS` y una cota `MAX_LANE_SPEED` efectiva en niveles altos.
- [ ] Los niveles 1 a 6 tienen configuraciones de carril visiblemente distintas y todos son cruzables.
- [ ] A partir del nivel 3 aparecen plataformas inestables con aviso parpadeante de duración constante antes de descargarse.
- [ ] Estar sobre una plataforma descargada cuesta una vida, igual que caer al refrigerante.
- [ ] Hay como máximo un power-up en el tablero a la vez, aparece cada 12–18s y desaparece si no se recoge en 8s.
- [ ] AISLANTE absorbe exactamente una muerte por pulso o refrigerante sin descontar vida, y no protege del agotamiento de carga ni del arrastre fuera del canvas.
- [ ] OVERCLOCK mueve dos celdas por pulsación durante 6s y degrada a una celda cuando el destino de dos es inválido, sin perder el turno.
- [ ] BATERÍA rellena la carga al 100 y suma exactamente +25 puntos.
- [ ] Un power-up colocado sobre una plataforma viaja con ella y sigue siendo recogible.
- [ ] Los efectos activos se pierden al entrar en `"dead"`, en `reset()` y al subir de nivel.
- [ ] A partir del nivel 5 los picos de tensión avisan 1,5s con parpadeo rojo en la franja antes de barrer, matan al contacto, y el AISLANTE protege de ellos.
- [ ] Esquivar un pico de tensión por poco suma +100.
- [ ] El `AudioContext` se crea solo tras la primera pulsación de teclado del usuario; no hay warning de autoplay en consola.
- [ ] Salto, nodo, placa completa, muerte, power-up, aviso de pico y carga crítica tienen sonidos distinguibles y sintetizados (sin archivos de audio en `public/`).
- [ ] `pause()` silencia el audio y congela power-ups, picos y partículas; `destroy()` cierra el `AudioContext`.
- [ ] El HUD interno muestra el power-up activo con su tiempo restante y el parpadeo de carga crítica, sin desbordar las franjas de 40px.
- [ ] El screen-shake no supera 4px ni 250ms.
- [ ] `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` y `lib/games/registry.ts` quedan **byte a byte iguales** que tras la spec 11.
- [ ] `components/jugar-client.tsx` no cambia.
- [ ] Guardar la puntuación sigue insertando en `scores` y apareciendo en `/juego/voltio` y `/salon-de-la-fama`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Tres power-ups, no más.** Se descartó una lista larga (imán, cámara lenta, salto en diagonal, multiplicador de puntos) porque cada uno multiplica los casos de interacción con las plataformas móviles y los picos de tensión. Tres cubre las tres necesidades reales del juego: sobrevivir (AISLANTE), avanzar rápido (OVERCLOCK) y no quedarse sin carga (BATERÍA), que es exactamente el triángulo de tensión de la spec 11.
- **Máximo un power-up simultáneo en el tablero.** Con dos o más, la ruta óptima pasa a ser recogerlos todos y el juego deja de tratar sobre cruzar. Uno a la vez lo mantiene como una decisión puntual: desviarme o seguir.
- **Los power-ups no viajan en `EngineStats`.** Es el mismo criterio que la carga en la spec 11: el contrato es cerrado y el HUD externo (`player-hud`) muestra solo Puntuación/Vidas/Nivel para todos los juegos. El indicador de power-up se dibuja dentro del canvas, donde el jugador ya está mirando.
- **OVERCLOCK con degradación elegante en vez de bloquear el movimiento.** Si el salto de dos celdas fuera inválido y se perdiera el turno, el power-up se convertiría en un castigo cerca de la fila de nodos, que es justo donde más se quiere usar. Degradar a un salto es la opción que nunca traiciona al jugador.
- **Condensadores inestables con aviso de duración constante.** Se descartó el aviso aleatorio o proporcional a la velocidad del carril: la gracia del género es la memorización del ritmo, y un aviso variable se lee como injusto. Se descartó también hundirlos de golpe sin aviso (como algunas versiones del original), por lo mismo.
- **Picos de tensión solo a partir del nivel 5, con aviso de 1,5s.** Introducirlos antes solaparía dos mecánicas nuevas (inestables en el 3, picos en el 5) demasiado pronto. El aviso largo es deliberado: el pico debe ser un evento espectacular y evitable, no una fuente de muertes aleatorias en un juego de 3 vidas.
- **La tabla `LEVEL_PATTERNS` sustituye al escalado multiplicativo de la spec 11.** La propia spec 11 anota el riesgo de que velocidad ×1.15 y drenaje ×1.1 por nivel exploten hacia el nivel 8. Patrones deterministas + `MAX_LANE_SPEED` resuelven eso y además dan identidad visual a cada placa, en vez de "lo mismo pero más rápido".
- **Audio sintetizado con Web Audio, inicializado perezosamente.** Mismo patrón que Tetris (spec 07), por dos razones: no añade ni un byte al bundle ni a `public/`, y evita la política de autoplay de los navegadores creando el `AudioContext` solo tras una pulsación real del usuario. Se descartó buscar samples externos: implicaría archivos binarios y una decisión de licencias que no corresponde a este juego.
- **Sin música de fondo ni toggle de silencio.** Ningún juego del catálogo tiene música ni control de volumen; añadirlo aquí crearía una inconsistencia y, si se quiere, debería ser una feature transversal a los cinco juegos con su propia spec.
- **Screen-shake acotado a ≤4px y ≤250ms.** El fondo del sitio ya tiene rejilla en perspectiva, scanlines y ruido; un shake agresivo sobre eso marea y hace ilegible el tablero. Se prefiere un golpe corto y contenido.
- **Se permite actualizar `short`/`long` de la fila `games`, nada más.** Es el único cambio en base de datos justificable: las mecánicas nuevas cambian cómo se vende el juego en `/` y `/juego/voltio`. No se toca el esquema ni `best`/`plays`.
- **Sin tercera spec de pulido.** Se evaluó separar HUD/partículas/audio en una tercera entrega, y se descartó: los efectos visuales y sonoros son inseparables del feedback de los power-ups y los picos de tensión (un pico sin aviso visual y sonoro es directamente injusto), así que trocearlos más dejaría un estado intermedio peor que el de la spec 11 sola.

## Riesgos identificados

- **Un power-up que viaja sobre una plataforma inestable puede volverse irrecogible** si la plataforma se descarga justo cuando el jugador salta hacia él. Decidir explícitamente si los power-ups pueden colocarse sobre plataformas inestables (recomendación: no) durante el paso 3, o el jugador perderá vidas persiguiendo señuelos.
- **Colisión del pico de tensión contra el jugador que viaja sobre una plataforma.** El pico barre las filas de buses (8–12), donde no hay plataformas, así que el caso no debería darse; pero si el balance del paso 7 lleva a permitir picos en el canal, la interacción entre barrido, plataforma y arrastre continuo es un nido de bugs. Mantener los picos confinados a los buses.
- **La regla "nunca sobre la única casilla segura" es más difícil de implementar de lo que parece:** requiere evaluar si la fila del jugador tiene salida viable en ese instante (celdas adyacentes libres de pulsos), no solo si el jugador está ahí. Una implementación ingenua puede acabar bloqueando todos los picos o ninguno.
- **`AudioContext` y `pause()`/desmontaje de React.** El wrapper desmonta y remonta el motor al navegar; si `destroy()` no cierra el contexto, una sesión larga con varias entradas y salidas de la partida acumulará contextos hasta que el navegador se niegue a crear más (límite típico de 6). Verificarlo expresamente en el paso 5.
- **Coste de render de las partículas junto al `shadowBlur` del tema neón.** `shadowBlur` es caro en canvas 2D; aplicarlo a decenas de partículas por frame puede hundir el framerate justo en el momento de la muerte, cuando más partículas hay. Limitar el glow a los elementos jugables (chispa, nodos, pulsos) y dibujar las partículas planas.
- **El escudo del AISLANTE tiene un caso ambiguo:** morir arrastrado fuera del canvas mientras se tiene escudo. El Alcance decide que **no** protege (el jugador ya no está en el tablero), pero es un caso que se descubre jugando y hay que dejarlo probado explícitamente, o se leerá como un bug.
- **Acumular +100 por esquive puede farmearse** si la condición de "esquive ajustado" es laxa: un jugador podría quedarse en la fila adyacente a la del pico esperando cada barrido. Definir la condición como "estaba en la fila barrida y la abandonó dentro de los últimos 0,3s antes del paso del pico", no como simple proximidad.
