# Juego de Arkanoid

Juego de Arkanoid construido con HTML, CSS y JavaScript puro — cero dependencias, sin herramientas de build ni gestor de paquetes.

## Cómo jugar

Abre `index.html` en el navegador. Mueve la pala con el mouse o las flechas del teclado para rebotar la bola y destruir todos los bloques sin dejarla caer.

## Estado

Implementado. El juego incluye:

- Pantalla de inicio, partida jugable, victoria/derrota y reinicio.
- Bloques, pala y bola renderizados con sprites (`assets/spritesheet-breakout.png`), con animación de explosión al destruir un bloque.
- Efectos de sonido de rebote y rotura (`assets/sounds/`).
- 3 niveles progresivos: al limpiar todos los bloques de la pantalla se avanza al siguiente nivel con más filas.
- HUD con Score, Nivel y Vidas, y velocidad de la bola que aumenta progresivamente por nivel.

## Estructura del proyecto

- `index.html` — estructura de la página y el canvas.
- `game.js` — bucle de juego, estado, entrada, colisiones y renderizado.
- `style.css` — estilos de layout y HUD.
- `assets/` — spritesheet y sonidos.
- `specs/` — especificaciones que documentan cada incremento del juego, siguiendo un flujo spec-driven (ver `CLAUDE.md` para el detalle de las skills `/spec` y `/spec-impl`).
