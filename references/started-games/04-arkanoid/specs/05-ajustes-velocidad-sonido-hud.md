# 05 - Ajustes de velocidad, sonido y HUD

**Estado:** Implemented
**Depende de:** SPEC 01, SPEC 03, SPEC 04
**Fecha:** 2026-08-07

**Objetivo:** Reducir el volumen de los efectos de sonido, hacer que la pelota inicie más lenta y acelere progresivamente por nivel, y reordenar el HUD para que Score quede a la izquierda, Nivel al centro y Vidas a la derecha.

## Alcance

**Incluye:**
- Bajar el volumen de `ball-bounce.mp3` y `break-sound.mp3` un 15% (de 1.0 a 0.85).
- La velocidad de la pelota en el nivel 1 es un 20% más lenta que la velocidad base actual (`5`), es decir `4`.
- Por cada nivel adicional, la velocidad sube un 5% de la velocidad base (`0.25`) de forma lineal: nivel 1 = `4`, nivel 2 = `4.25`, nivel 3 = `4.5`.
- La velocidad se recalcula según `currentLevel` cada vez que la pelota se reposiciona (`resetBall()`), tanto al iniciar/avanzar de nivel como al perder una vida dentro del mismo nivel — en este último caso el valor resultante no cambia porque el nivel es el mismo.
- Reordenar el HUD (`index.html`) para que los `<span>` aparezcan en el orden Score, Nivel, Vidas, de modo que con el `justify-content: space-between` ya existente, Score quede a la izquierda, Nivel quede en el centro y Vidas a la derecha.
- Corregir `resetGame()` para que reinicie `currentLevel = 1`, ya que hoy no lo hace (desviación del criterio de aceptación de SPEC 04) y es necesario para que la velocidad de nivel 1 se aplique correctamente en cada partida nueva.

**No incluye (fuera de este spec):**
- Control de volumen o mute ajustable por el jugador — los volúmenes quedan fijos en código.
- Cambios de velocidad de la pala, tamaño de bloques, o cualquier otra dificultad progresiva distinta de la velocidad de la pelota.
- Escalado no lineal (compuesto) de la velocidad — se descarta explícitamente, ver decisiones.
- Centrado matemático exacto del elemento Nivel con CSS adicional (position/transform) — se usa el comportamiento natural de `space-between`.
- Cambios al ángulo de rebote (`ball.dx = ball.speed * Math.sin(bounceAngle)`) más allá de que ya usa `ball.speed`, que ahora varía por nivel.

## Modelo de datos

No se introduce persistencia. Se modifican estas estructuras en memoria dentro de `game.js`:

```js
// Volumen fijo para ambos efectos de sonido
const bounceSound = new Audio('assets/sounds/ball-bounce.mp3');
bounceSound.volume = 0.85;
const breakSound = new Audio('assets/sounds/break-sound.mp3');
breakSound.volume = 0.85;

// Velocidad base de la pelota (antes hardcodeada como 5 dentro del objeto ball)
const BASE_BALL_SPEED = 5;

// Calcula la velocidad de la pelota para un nivel dado (1-based)
function getBallSpeedForLevel(level) {
  return BASE_BALL_SPEED * 0.8 + (level - 1) * (BASE_BALL_SPEED * 0.05);
}
```

`ball.speed` dejará de inicializarse como literal `5` en la definición del objeto `ball` y pasará a asignarse dentro de `resetBall()` mediante `getBallSpeedForLevel(currentLevel)`.

No se añaden campos nuevos a `bricks`, `paddle` ni al HUD en el DOM (solo se reordenan los `<span>` existentes).

## Plan de implementación

1. En `game.js`, extraer la velocidad inicial de `ball` a una constante `BASE_BALL_SPEED = 5`, y añadir la función `getBallSpeedForLevel(level)`.
2. Modificar `playSound(audioEl)` para copiar `clone.volume = audioEl.volume` desde el elemento original al clon (ya que `cloneNode()` no copia la propiedad `volume`), y fijar `bounceSound.volume = 0.85` y `breakSound.volume = 0.85` junto a su declaración.
3. Modificar `resetBall()` para asignar `ball.speed = getBallSpeedForLevel(currentLevel);` antes de calcular `dx`/`dy`.
4. Añadir `currentLevel = 1;` dentro de `resetGame()`.
5. En `index.html`, reordenar los tres `<span>` dentro de `#hud` a: `#score`, `#level`, `#lives` (mismo contenido interno de cada uno, solo cambia el orden).
6. Verificar manualmente: el HUD muestra Score-Nivel-Vidas de izquierda a derecha; la pelota se siente más lenta al iniciar una partida nueva; al subir de nivel la pelota es perceptiblemente más rápida; los sonidos de rebote y rotura suenan más bajo que antes.

Cada paso deja el juego ejecutable y verificable abriendo `index.html` en el navegador.

## Criterios de aceptación

- [ ] Al iniciar una partida nueva (`resetGame()` o primera carga), `ball.speed` es `4` (20% menos que la velocidad base de `5`).
- [ ] Al avanzar al nivel 2 desde la pantalla `'levelup'`, `ball.speed` pasa a `4.25`.
- [ ] Al avanzar al nivel 3, `ball.speed` pasa a `4.5`.
- [ ] Al perder una vida dentro del mismo nivel, la velocidad de la pelota no cambia respecto al valor que tenía antes de perder la vida.
- [ ] Tras game over o victoria, al reiniciar la partida, `currentLevel` vuelve a `1` y la pelota vuelve a iniciar a velocidad `4`.
- [ ] El volumen percibido de `ball-bounce.mp3` y `break-sound.mp3` es menor que antes del cambio (volume `0.85` en vez de `1.0`), en clones y en el elemento original.
- [ ] En el HUD, Score aparece a la izquierda, Nivel en el centro y Vidas a la derecha.
- [ ] El resto del comportamiento de los specs 01, 03 y 04 (física, sonidos por evento, estados, niveles) sigue funcionando sin cambios.

## Decisiones tomadas y descartadas

- **Volumen reducido en ambos sonidos (`ball-bounce.mp3` y `break-sound.mp3`), no solo el de rebote:** decisión explícita del usuario al responder las preguntas de clarificación, aunque el pedido original solo mencionaba el rebote.
- **Escalado de velocidad lineal sobre la base (`+5% de la base por nivel`) en vez de compuesto:** decisión explícita del usuario; cada nivel suma un incremento fijo de `0.25` en vez de multiplicar el nivel anterior por 1.05.
- **Recalcular `ball.speed` dentro de `resetBall()` en vez de solo en las transiciones de nivel:** se centraliza en un único punto porque el resultado es idéntico cuando el nivel no cambia (tras perder una vida), evitando duplicar la lógica de cálculo en dos sitios distintos.
- **Corregir `resetGame()` para reiniciar `currentLevel`:** no fue pedido explícitamente por el usuario, pero es necesario para que "la pelota viaje 20% más lento al inicio del juego" sea cierto en partidas posteriores a la primera, y además alinea el comportamiento con un criterio de aceptación ya existente en SPEC 04 que hoy no se cumple.
- **Reorden simple del HUD confiando en `justify-content: space-between` en vez de centrado CSS exacto:** decisión explícita del usuario; cambio mínimo sin tocar `style.css`.
- **Sin control de volumen ajustable por el jugador:** se mantiene fuera de alcance, consistente con la decisión ya tomada en SPEC 03 de dejar el control de audio para un spec futuro si se solicita.
