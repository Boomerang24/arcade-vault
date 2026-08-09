# 04 - Niveles progresivos

**Estado:** Implemented
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-08-07

**Objetivo:** Al destruir todos los bloques de la pantalla, avanzar a un nuevo nivel con más filas de bloques en vez de mostrar directamente la pantalla de victoria, hasta completar 3 niveles fijos.

## Alcance

**Incluye:**
- 3 niveles predefinidos en orden fijo: nivel 1 (5 filas de bloques, layout actual), nivel 2 (6 filas), nivel 3 (7 filas). Todas las filas van completas (sin huecos), igual que el layout actual.
- Al destruir el último bloque activo de un nivel que no es el final, se pasa a un nuevo estado `'levelup'`: se muestra un mensaje "Nivel N" (el nivel al que se está a punto de entrar) y el juego espera a que el jugador pulse cualquier tecla para continuar.
- Al pulsar una tecla en `'levelup'`, se regeneran los bloques del nuevo nivel, se reposicionan bola y pala como al perder una vida, y se vuelve a `'playing'`.
- Vidas y score se mantienen sin reiniciar entre niveles; solo se resetean los bloques y la posición de bola/pala.
- Al destruir el último bloque del nivel 3 (el final), se muestra la pantalla de `'victory'` existente, igual que hoy.
- El HUD muestra el nivel actual ("Nivel: N") junto al score y las vidas, durante `'playing'`, `'paused'` y `'levelup'`.
- El mapeo de color de fila (`BRICK_ROW_COLORS`) se extiende cíclicamente para niveles con más de 5 filas (la fila 6 reutiliza el color de la fila 1, la fila 7 el de la fila 2, etc.).

**No incluye (fuera de este spec):**
- Dificultad progresiva más allá del layout (velocidad de bola, tamaño de pala, etc. no cambian entre niveles).
- Layouts con huecos o patrones distintos por nivel — todas las filas de todos los niveles van completas.
- Más de 3 niveles o generación procedural de niveles.
- Persistencia del nivel alcanzado entre sesiones.
- Reinicio de vidas por nivel.

## Modelo de datos

No se introduce persistencia. Se añaden/modifican estas estructuras en memoria dentro de `game.js`:

```js
// gameState gana un nuevo valor posible:
// 'start' | 'playing' | 'paused' | 'levelup' | 'gameover' | 'victory'

// Definición de niveles: cada uno indica su número de filas de bloques
const LEVELS = [
  { rows: 5 },
  { rows: 6 },
  { rows: 7 },
];

// Nivel actual (índice 1-based para mostrar en HUD y mensaje "Nivel N")
let currentLevel = 1;
```

`BRICK_ROWS` deja de ser una constante fija de 5 y pasa a leerse de `LEVELS[currentLevel - 1].rows` en `generateBricks()`. El color de cada fila se calcula como `BRICK_ROW_COLORS[row % BRICK_ROW_COLORS.length]`.

## Plan de implementación

1. Añadir la constante `LEVELS` y la variable `currentLevel` (inicializada en 1) en `game.js`.
2. Modificar `generateBricks()` para usar `LEVELS[currentLevel - 1].rows` en vez de la constante `BRICK_ROWS`, y calcular el color de fila con módulo sobre `BRICK_ROW_COLORS`.
3. Añadir el estado `'levelup'` al flujo de `gameState`: en la detección de victoria (donde hoy se comprueba si todos los bloques están `active: false`), distinguir dos casos: si `currentLevel < LEVELS.length`, pasar a `'levelup'`; si `currentLevel === LEVELS.length`, pasar a `'victory'` como hoy.
4. Añadir el manejo de input en `'levelup'`: cualquier tecla incrementa `currentLevel`, llama a `generateBricks()`, reposiciona bola y pala (misma lógica que al perder una vida), y cambia `gameState` a `'playing'`.
5. Añadir el dibujo de la pantalla `'levelup'`: mensaje "Nivel N" (mostrando el nuevo `currentLevel` tras incrementarlo, o el nivel destino antes de incrementar — se muestra el nivel al que se va a entrar) y una indicación de "pulsa una tecla para continuar".
6. Añadir "Nivel: N" al HUD, junto a score y vidas, visible en `'playing'`, `'paused'` y `'levelup'`.
7. Verificar manualmente que se puede completar los 3 niveles en orden y llegar a la pantalla de victoria final.

Cada paso deja el juego ejecutable y verificable abriendo `index.html` en el navegador.

## Criterios de aceptación

- [ ] Al destruir el último bloque del nivel 1, aparece la pantalla "Nivel 2" y el juego espera una tecla antes de continuar.
- [ ] Al pulsar una tecla en la pantalla "Nivel 2", se generan 6 filas de bloques, la bola y la pala se reposicionan, y el juego continúa en `'playing'`.
- [ ] Vidas y score no se reinician al pasar de nivel 1 a nivel 2 ni de nivel 2 a nivel 3.
- [ ] Al destruir el último bloque del nivel 3, se muestra directamente la pantalla de `'victory'` (no aparece pantalla de "Nivel 4").
- [ ] El HUD muestra "Nivel: N" correctamente actualizado durante `'playing'`, `'paused'` y `'levelup'`.
- [ ] Si la bola cae por debajo de la pala durante cualquier nivel, la pérdida de vida funciona igual que en el spec 01 (no interfiere con la lógica de niveles).
- [ ] Reiniciar tras game over o victoria devuelve el juego a nivel 1, con score 0, 3 vidas y bloques completos.

## Decisiones tomadas y descartadas

- **3 niveles fijos con filas crecientes (5, 6, 7) en vez de layouts con huecos:** se elige por simplicidad de diseño y reutilización directa de `generateBricks()`; layouts con patrones distintos por nivel se descartan para no ampliar el alcance de este spec.
- **Sin dificultad progresiva (velocidad/tamaño):** se mantiene el mismo comportamiento de física entre niveles para aislar el cambio a la generación de bloques, consistente con la decisión del usuario.
- **Pantalla `'levelup'` bloqueante con tecla para continuar:** se elige en vez de una transición automática por temporizador, dando control al jugador sobre el ritmo, igual que las pantallas de inicio/game over/victoria existentes.
- **Vidas y score persisten entre niveles:** se elige para que el progreso del jugador tenga continuidad real a través de los 3 niveles, en vez de tratarlos como partidas independientes.
- **Colores de fila cíclicos con módulo:** se elige para reutilizar la paleta de 5 colores ya definida en el spec 02 sin necesitar colores nuevos para las filas 6 y 7.
- **3 niveles fijos, sin generación procedural:** se descarta por mantener el spec acotado; queda como posible spec futuro si se quiere escalar a más niveles.
