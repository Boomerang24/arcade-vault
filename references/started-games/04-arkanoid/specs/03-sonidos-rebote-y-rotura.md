# 03 - Sonidos de rebote y rotura de bloques

**Estado:** Implemented
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-08-07

**Objetivo:** Reproducir un efecto de sonido cuando la bola rebota contra paredes o pala, y otro distinto cuando destruye un bloque, usando los archivos de audio ya presentes en `assets/sounds/`.

## Alcance

**Incluye:**
- Reproducir `assets/sounds/ball-bounce.mp3` cuando la bola rebota contra las paredes laterales, la pared superior, o la pala.
- Reproducir `assets/sounds/break-sound.mp3` cuando un bloque se destruye por impacto de la bola.
- Permitir que los sonidos se solapen si varios eventos ocurren casi al mismo tiempo (p.ej. dos bloques golpeados en rápida sucesión), sin cortar reproducciones en curso.
- Precarga de ambos archivos de audio al arrancar el juego, en paralelo a la carga del spritesheet.

**No incluye (fuera de este spec):**
- Control de volumen o botón de mute en el HUD — se deja para un spec futuro si se solicita.
- Música de fondo continua.
- Comportamiento especial de audio al pausar (tecla P) — al detenerse la física en `'paused'`, simplemente no se generan nuevos eventos de colisión, no se requiere lógica adicional de silenciado.
- Sonidos para victoria, game over o pérdida de vida.
- Web Audio API / mezclado avanzado — se usa el elemento `Audio` nativo del navegador.

## Modelo de datos

No se introduce persistencia. Se añaden estas referencias en memoria dentro de `game.js`:

```js
// Elementos <audio> precargados, usados como plantilla para clonar en cada reproducción
const bounceSound = new Audio('assets/sounds/ball-bounce.mp3');
const breakSound = new Audio('assets/sounds/break-sound.mp3');
```

No se añaden campos nuevos a `ball`, `paddle` ni `bricks`.

## Plan de implementación

1. En `game.js`, crear los elementos `bounceSound` y `breakSound` con `new Audio(...)` al inicio del archivo, junto a las demás constantes globales.
2. Añadir una función `playSound(audioEl)` que reproduce el sonido clonando el elemento (`audioEl.cloneNode()`) y llamando a `.play()` sobre el clon, para permitir solapamiento sin cortar reproducciones en curso.
3. Llamar a `playSound(bounceSound)` en los tres puntos donde la bola invierte `dy`/`dx` por rebote: colisión con pared izquierda/derecha, colisión con pared superior, y colisión con la pala.
4. Llamar a `playSound(breakSound)` en `checkBrickCollisions()`, en el mismo punto donde se marca `brick.active = false` y se lanza la animación de explosión (spec 02).
5. Verificar manualmente que ambos sonidos se escuchan en sus eventos correspondientes y que no bloquean ni ralentizan el bucle de juego.

Cada paso deja el juego ejecutable y verificable abriendo `index.html` en el navegador.

## Criterios de aceptación

- [ ] Al rebotar la bola contra cualquier pared (izquierda, derecha, superior) o contra la pala, se escucha `ball-bounce.mp3`.
- [ ] Al destruirse un bloque, se escucha `break-sound.mp3` en el mismo instante en que desaparece.
- [ ] Si dos colisiones ocurren en rápida sucesión, ambos sonidos se reproducen sin cortarse entre sí.
- [ ] El resto del comportamiento de los specs 01 y 02 (física, animaciones, HUD, estados) sigue funcionando sin cambios.

## Decisiones tomadas y descartadas

- **Elemento `Audio` nativo con `cloneNode()` por reproducción:** se elige por simplicidad, sin dependencias, y porque permite solapamiento de sonidos repetidos sin necesidad de gestionar un pool manual ni Web Audio API.
- **Mismo sonido de rebote para paredes y pala:** se unifican porque físicamente ambos son rebotes elásticos, no roturas; evita depender de un tercer archivo de audio inexistente.
- **Sin control de volumen/mute en este spec:** se mantiene acotado a los dos efectos solicitados; un control de audio en el HUD queda como posible spec futuro.
- **Sin lógica especial de pausa:** al detenerse la actualización de física en `'paused'` (spec 01), no se generan nuevos eventos de colisión, por lo que no hace falta silenciar nada explícitamente.
