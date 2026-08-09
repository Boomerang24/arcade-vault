# 01 - MVP jugable de Arkanoid

**Estado:** Implemented
**Depende de:** Ninguno
**Fecha:** 2026-08-06

**Objetivo:** Construir un MVP de Arkanoid jugable de principio a fin (pantalla de inicio, partida, victoria/derrota y reinicio) usando solo HTML, CSS y JavaScript, sin dependencias externas.

## Alcance

**Incluye:**
- Un único nivel fijo con una tanda de bloques (todos del mismo tipo, se rompen de un golpe).
- Pala controlada por teclado (flechas izquierda/derecha).
- Bola con física de rebote clásica: rebote simétrico contra paredes y bloques, y ángulo variable según el punto de impacto en la pala.
- Sistema de vidas: 3 vidas, se pierde una si la bola cae por debajo de la pala; game over al perder la tercera.
- Puntuación que aumenta al destruir bloques, visible en el HUD junto con las vidas restantes.
- Pausa/reanudación con tecla (P).
- Pantalla inicial con opción de iniciar partida.
- Pantalla final de victoria (todos los bloques destruidos) o de game over, ambas con opción de reiniciar.
- Renderizado mediante `<canvas>`.

**No incluye (fuera de este spec):**
- Múltiples niveles o progresión entre niveles.
- Power-ups o bloques con resistencia/tipos especiales.
- Persistencia de puntuación máxima o progreso entre sesiones.
- Soporte de control por ratón o táctil.
- Sonido/música.
- Ranking o comparación de puntuaciones.

## Modelo de datos

No se introduce persistencia ni estructuras guardadas en disco/localStorage. El estado del juego vive en memoria mientras dura la sesión de la pestaña, dentro de `game.js`:

- `gameState`: `'start' | 'playing' | 'paused' | 'gameover' | 'victory'`
- `paddle`: `{ x, y, width, height, speed }`
- `ball`: `{ x, y, radius, dx, dy, speed }`
- `bricks`: array de `{ x, y, width, height, active }`
- `score`: number
- `lives`: number (inicia en 3)

## Plan de implementación

1. Crear `index.html` con el `<canvas>` del juego, el HUD (score y vidas) y la vinculación a `style.css` y `game.js`. El juego debe cargar y mostrar la pantalla de inicio.
2. Crear `style.css` con estilos básicos: centrado del canvas, tipografía del HUD, y estilos de las pantallas de inicio/game over/victoria.
3. Implementar en `game.js` el bucle de renderizado (`requestAnimationFrame`) y el estado `'start'`: dibuja el título y espera a que el jugador pulse una tecla/botón para pasar a `'playing'`.
4. Implementar la pala: dibujo, movimiento con flechas izquierda/derecha, y límite dentro de los bordes del canvas.
5. Implementar la bola: dibujo, movimiento, rebote contra paredes laterales y superior, y detección de caída por debajo de la pala (resta una vida y reinicia posición de bola/pala, o dispara `'gameover'` si las vidas llegan a 0).
6. Implementar la generación de la tanda de bloques y su dibujo en el canvas.
7. Implementar colisión bola-bloque: al impactar, desactiva el bloque, invierte la componente de velocidad correspondiente de la bola y suma puntos al `score`.
8. Implementar colisión bola-pala con ángulo de rebote variable según el punto de impacto relativo al centro de la pala.
9. Implementar la detección de victoria (todos los bloques con `active: false`) y transición a `'victory'`.
10. Implementar la pausa: tecla P alterna entre `'playing'` y `'paused'`, deteniendo la actualización de física sin detener el `requestAnimationFrame` (para poder seguir dibujando el overlay de pausa).
11. Implementar las pantallas de `'gameover'` y `'victory'` con el score final y una opción (tecla/clic) para reiniciar el estado completo y volver a `'start'` o directamente a `'playing'`.

Cada paso deja el juego en un estado ejecutable y visualmente verificable abriendo `index.html` en el navegador.

## Criterios de aceptación

- [x] Al abrir `index.html`, se muestra una pantalla de inicio antes de que la bola se mueva.
- [x] Al iniciar la partida, la pala se mueve con las flechas izquierda/derecha y no sale de los límites del canvas.
- [x] La bola rebota correctamente contra las paredes laterales y superior.
- [x] La bola rebota contra la pala con un ángulo que varía según el punto de impacto.
- [x] Al golpear un bloque, este desaparece, la bola rebota y el score aumenta.
- [x] Si la bola cae por debajo de la pala, se resta una vida y la partida continúa (si quedan vidas) reposicionando bola y pala.
- [x] Al perder la tercera vida, se muestra la pantalla de game over con el score final y opción de reiniciar.
- [x] Al destruir todos los bloques, se muestra la pantalla de victoria con el score final y opción de reiniciar.
- [x] La tecla P pausa y reanuda la partida en cualquier momento durante `'playing'`.
- [x] El HUD muestra en todo momento el score actual y las vidas restantes durante `'playing'` y `'paused'`.
- [x] Reiniciar tras game over o victoria devuelve el juego a un estado inicial limpio (score 0, 3 vidas, bloques completos).

## Decisiones tomadas y descartadas

- **Canvas vs. DOM/CSS puro:** se elige `<canvas>` por ser el enfoque estándar para juegos 2D con física de colisiones, frente a manipular elementos DOM individuales por bloque/bola (más costoso y complejo de sincronizar).
- **Un solo nivel fijo:** se descarta progresión multinivel para mantener el MVP acotado; queda como posible spec futuro.
- **Bloques de un solo tipo:** se descartan bloques con resistencia o power-ups para no ampliar el alcance del MVP.
- **Sin persistencia:** se descarta localStorage para el MVP inicial; el score máximo entre sesiones queda como posible spec futuro.
- **Solo teclado:** se descarta soporte de ratón/táctil para simplificar el MVP; el control por teclado es suficiente para validar la jugabilidad base.
- **Ángulo de rebote variable en la pala:** se elige por fidelidad al Arkanoid clásico, ya que es el mecanismo principal de control estratégico del jugador, frente a un rebote simétrico que sería menos jugable.
- **3 archivos planos (`index.html`, `style.css`, `game.js`):** se elige por ser un proyecto sin build tooling ni dependencias, consistente con el objetivo del README del proyecto.
