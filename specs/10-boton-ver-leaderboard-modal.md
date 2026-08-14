# 10 — Botón "Ver leaderboard" en el modal de fin de partida

**Estado:** Implemented
**Depende de:** SPEC 06
**Fecha:** 2026-08-13

**Objetivo:** Agregar un botón "VER LEADERBOARD" al modal de fin de partida (`components/jugar-client.tsx`) que navegue al salón de la fama global (`/salon-de-la-fama`), pidiendo confirmación solo si la puntuación aún no fue guardada.

## Alcance

**Incluye:**

- Un nuevo botón `VER LEADERBOARD` dentro del bloque `.actions` del modal de fin de partida (`components/jugar-client.tsx`, líneas 173–180), junto a `JUGAR DE NUEVO` y `VOLVER AL VAULT`. Visible siempre que el modal esté abierto (`over === true`), sin importar si la puntuación ya se guardó o no.
- Navega a `/salon-de-la-fama` (el salón de la fama global, no el leaderboard específico del juego en `/juego/[id]`) usando `router.push("/salon-de-la-fama")`, mismo patrón que usan `JUGAR DE NUEVO`/`VOLVER AL VAULT`.
- Si al pulsar el botón la puntuación **no** se ha guardado todavía (`!saved`), se dispara `window.confirm(...)` con un mensaje indicando que se perderá la puntuación sin guardar; si el usuario confirma, navega; si cancela, el modal permanece igual sin ningún efecto secundario. Si la puntuación **ya** se guardó (`saved === true`), navega directo sin confirmación.
- Estilo visual del botón: reutiliza las clases `btn`/`btn ghost` ya existentes en la hoja de estilos global (mismo criterio que `SALIR` en el HUD, línea 90–95 del mismo archivo) — sin CSS nuevo.

**No incluye (fuera de alcance):**

- Botón o navegación hacia el leaderboard específico del juego actual (`/juego/[id]`) — el destino es únicamente el salón de la fama global, decisión explícita del usuario.
- Reemplazar el `window.confirm()` nativo por un modal de confirmación personalizado con estética retro-arcade — se usa el diálogo nativo del navegador por simplicidad, sin nuevo componente.
- Cambios al flujo de guardado (`GUARDAR PUNTUACIÓN`, `saveScore`) o a cualquier otro botón existente del modal o del HUD.
- Cambios a `/salon-de-la-fama` o a `components/salon-client.tsx` — la página de destino ya existe y no se modifica.

## Modelo de datos

Esta spec no introduce ninguna estructura de datos nueva. Reutiliza el estado ya existente en `JugarClient` (`over`, `saved`, `router` de `next/navigation`) definido en `components/jugar-client.tsx`.

## Plan de implementación

1. **Botón y handler.** En `components/jugar-client.tsx`, agregar un botón `VER LEADERBOARD` dentro del `<div className="actions">` (después de `VOLVER AL VAULT`), con un `onClick` que: si `!saved`, llama a `window.confirm("Tu puntuación aún no está guardada. ¿Salir de todas formas?")` (o mensaje equivalente) y solo navega si el resultado es `true`; si `saved`, navega directo. Navegación con `router.push("/salon-de-la-fama")` en ambos casos. Verificación: `npm run build` pasa sin errores de tipos.
2. **Verificación en navegador.** Jugar cualquier juego registrado (p. ej. Snake) hasta game over. Caso A: sin guardar la puntuación, pulsar `VER LEADERBOARD` → aparece el confirm nativo del navegador; cancelar deja el modal intacto; aceptar navega a `/salon-de-la-fama`. Caso B: guardar la puntuación primero (`GUARDAR PUNTUACIÓN`) y luego pulsar `VER LEADERBOARD` → navega directo sin confirm. Confirmar que `JUGAR DE NUEVO` y `VOLVER AL VAULT` siguen funcionando sin regresión.

## Criterios de aceptación

- [ ] El modal de fin de partida muestra un botón `VER LEADERBOARD` junto a `JUGAR DE NUEVO` y `VOLVER AL VAULT`, visible siempre que el modal esté abierto.
- [ ] Si la puntuación no fue guardada y se pulsa `VER LEADERBOARD`, aparece un `window.confirm()` antes de navegar; cancelar el diálogo no navega ni cambia el estado del modal.
- [ ] Si la puntuación ya fue guardada y se pulsa `VER LEADERBOARD`, navega directamente a `/salon-de-la-fama` sin diálogo de confirmación.
- [ ] La navegación aterriza en `/salon-de-la-fama`, nunca en `/juego/[id]`.
- [ ] `JUGAR DE NUEVO`, `VOLVER AL VAULT` y `GUARDAR PUNTUACIÓN` siguen funcionando sin regresión.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Destino: salón de la fama global (`/salon-de-la-fama`), no el leaderboard del juego (`/juego/[id]`).** Decisión explícita del usuario, consistente con el enlace `VER SALÓN →` ya existente en `components/home-client.tsx` que apunta al mismo destino.
- **Botón siempre visible, con confirmación condicional en vez de ocultarlo hasta guardar.** Se consideró mostrar el botón solo después de `GUARDAR PUNTUACIÓN` (sin necesidad de confirmar), pero el usuario prefirió explícitamente que el botón esté siempre disponible y que la confirmación cubra el caso de puntuación no guardada, dando más flexibilidad sin obligar a guardar primero.
- **`window.confirm()` nativo en vez de un modal de confirmación custom.** Evita crear un componente nuevo para una interacción puntual y de bajo riesgo (perder una puntuación no guardada, no un dato crítico irreversible del sistema).
- **Etiqueta `VER LEADERBOARD` en vez de `VER SALÓN DE LA FAMA`.** Decisión explícita del usuario, aunque difiere de la terminología en español usada en el resto de la UI (`SALÓN DE LA FAMA`, `VER SALÓN →`).

## What is **not** in this spec

- Botón hacia el leaderboard específico del juego (`/juego/[id]`).
- Modal de confirmación personalizado con estética retro-arcade.
- Cambios al flujo de guardado de puntuación o a la página `/salon-de-la-fama` en sí.

Cada uno de estos, si se necesita, va en su propia spec.
