# 02 — Home / Landing page

**Estado:** Implemented
**Depende de:** SPEC 01
**Fecha:** 2026-08-08

**Objetivo:** Portar `home.jsx` del template estático (`references/templates/home-about/`) como la nueva ruta `/`, moviendo la biblioteca actual a `/biblioteca`, dejando fuera de alcance la pantalla `about.jsx` (se implementará en un spec futuro).

## Alcance

**Incluye:**
- Nueva ruta `/` con la landing page portada de `home.jsx`:
  - Hero con siluetas flotantes decorativas (`FloatingSilhouettes`), título, subtítulo y CTAs ("Explorar juegos" → `/biblioteca`, "Crear cuenta" → `/iniciar-sesion`).
  - Sección "¿Por qué Arcade Vault?" con grid de 4 feature cards (íconos pixel-art `FeatureIcon`: GAMEPAD, FREE, TROPHY, ROCKET).
  - Sección "Juegos disponibles ahora": rail de `MiniCard` con los primeros 6 juegos de `GAMES`, cada una navegando a `/juego/[id]`; botón "Ver todos los juegos →" a `/biblioteca`.
  - Sección de stats (`home-stats`) con 3 bloques estáticos ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING").
  - Sección "Actividad en vivo": panel de últimas puntuaciones (ticker) y panel de top jugadores de hoy, ambos con los arrays hardcodeados del template (no generados con `seededScores`); el link "VER SALÓN →" navega a `/salon-de-la-fama`.
  - Sección de precios (`pricing-grid`): card de plan único gratuito + FAQ, con CTA "Empezar gratis →" a `/iniciar-sesion`.
  - CTA final ("¿Listo para jugar?") con botón "Insertar moneda →" a `/biblioteca`.
  - Animación reveal-on-scroll (`useReveal`, IntersectionObserver + clases `.reveal`/`.in`) aplicada a cada sección, portada tal cual del template.
- Mover la biblioteca actual (contenido de `app/page.tsx`) a `app/biblioteca/page.tsx`.
- Actualizar `components/nav.tsx`: agregar link "Inicio" (`/`) antes de "Biblioteca"; el link "Biblioteca" ahora apunta a `/biblioteca`; actualizar la detección de ruta activa (`isBiblioteca` pasa a chequear `/biblioteca` y `/juego/*`; nuevo `isHome` para `/`). Sin link "Acerca de" (fuera de alcance).
- Portar los estilos nuevos de `references/templates/home-about/styles.css` (`.home-hero`, `.home-title`, `.home-ctas`, `.home-silos`, `.home-section`, `.feature-grid`, `.feature-card`, `.mini-rail`, `.mini-card`, `.home-stats`, `.stats-inner`, `.home-final`, `.final-title`, `.final-cta`, `.reveal`/`.reveal.in`, `.activity-grid`, `.activity-card`, `.pricing-grid`, `.pricing-faq`, etc.) a `app/globals.css`, resolviendo colisiones de nombres con lo ya portado en spec 01 si las hubiera.

**No incluye (fuera de alcance):**
- La pantalla `about.jsx` y su ruta `/about` (spec futuro).
- Cualquier link o referencia a "Acerca de" en la navegación.
- Generar los datos de "Actividad en vivo" / "Top jugadores" con `seededScores()`; se mantienen como arrays estáticos hardcodeados igual que en el template.
- Cambios a la lógica de `/biblioteca` más allá de moverla de archivo (el buscador, filtros y grid quedan funcionalmente idénticos).
- Cambios al modelo de datos (`lib/data.ts`), autenticación o puntuaciones — reutiliza lo ya existente de spec 01.

## Modelo de datos

No se introducen estructuras nuevas. La página reutiliza `GAMES` de `lib/data.ts` (spec 01) para el rail de mini-cards y `useAuth()` de `components/auth-provider.tsx` si en el futuro se requiere personalizar el hero (no requerido en esta spec). Los arrays de "actividad reciente" y "top jugadores" son datos literales embebidos en el componente, portados tal cual de `home.jsx` (no se persisten ni se tipan como parte de `lib/data.ts`).

## Plan de implementación

1. **Mover biblioteca a `/biblioteca`.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (buscador, chips, grid). Eliminar el contenido viejo de `app/page.tsx` (se reemplaza en el paso 3).
2. **Estilos de la home.** Portar las reglas relevantes de `references/templates/home-about/styles.css` a `app/globals.css` (secciones listadas en el alcance), verificando que no choquen con clases ya existentes de spec 01.
3. **Componente Home.** Crear `app/page.tsx` (cliente) con el contenido portado de `references/templates/home-about/home.jsx`: `FloatingSilhouettes`, `FeatureIcon`, `MiniCard`, hook `useReveal`, y las 7 secciones (hero, why, games preview, stats, actividad, precios, CTA final). Los `onClick={() => navigate(...)}` del template se traducen a `<Link href="...">` o `useRouter().push(...)` según corresponda (Next.js App Router). `MiniCard` usa los primeros 6 elementos de `GAMES`.
4. **Actualizar Nav.** En `components/nav.tsx`: agregar `<Link href="/">Inicio</Link>` antes de "Biblioteca"; cambiar el `href` de "Biblioteca" a `/biblioteca`; introducir `isHome = pathname === "/"` y ajustar `isBiblioteca = pathname === "/biblioteca" || pathname.startsWith("/juego/")`; replicar los mismos cambios en el panel móvil.
5. **Revisión final.** Recorrer en el navegador: `/` (hero, secciones, animación reveal al hacer scroll, todos los CTAs navegan a su ruta correcta), nav muestra "Inicio" y "Biblioteca" con estado activo correcto en cada ruta, `/biblioteca` conserva buscador y filtros funcionando igual que antes, ningún link roto hacia `/about`.

## Criterios de aceptación

- [ ] `/` muestra la landing page con hero, 4 feature cards, rail de 6 mini-cards de juegos, bloque de stats, actividad en vivo (ticker + top jugadores), pricing/FAQ y CTA final.
- [ ] Las secciones con clase `.reveal` aparecen ocultas hasta que entran en el viewport, momento en el que reciben la clase `.in` y se animan.
- [ ] El botón "Explorar juegos" y "Ver todos los juegos →" navegan a `/biblioteca`.
- [ ] Los botones "Crear cuenta" y "Empezar gratis →" navegan a `/iniciar-sesion`.
- [ ] Cada mini-card del rail navega a `/juego/[id]` del juego correspondiente.
- [ ] El link "VER SALÓN →" navega a `/salon-de-la-fama`.
- [ ] `/biblioteca` muestra el mismo contenido y comportamiento (buscador, chips de categoría, grid) que antes tenía `/`.
- [ ] El nav muestra "Inicio" y "Biblioteca" como links separados; "Inicio" está activo solo en `/`, "Biblioteca" está activo en `/biblioteca` y en `/juego/*`.
- [ ] El nav (desktop y menú móvil) no contiene ningún link "Acerca de".
- [ ] No hay errores de hidratación ni de consola al cargar `/` o `/biblioteca`.
- [ ] No existe ninguna ruta ni link apuntando a `/about`.

## Decisiones tomadas y descartadas

- **Mover la biblioteca a `/biblioteca` en vez de convivir con la home en `/`.** El nav del template trata "Inicio" y "Biblioteca" como secciones distintas; mantenerlas separadas respeta esa navegación y evita una página `/` sobrecargada con hero + grid completo de juegos.
- **Omitir el link "Acerca de" del nav en vez de mostrarlo deshabilitado.** Como `/about` no existe todavía, un link visible (aunque deshabilitado) sería ruido sin función; se agrega en el spec que implemente `about.jsx`.
- **Datos de "Actividad en vivo" y "Top jugadores" como arrays estáticos hardcodeados**, igual que en el template, en vez de generarlos con `seededScores()`. Mantiene el mismo espíritu de mock visual del spec 01 sin invertir en adaptar el formato de `seededScores` (que no incluye nombre de juego ni tiempo relativo).
- **Portar `useReveal` (IntersectionObserver) tal cual del template** para conservar la identidad visual de scroll progresivo, en vez de simplificar a secciones siempre visibles.
