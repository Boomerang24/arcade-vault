# 01 — MVP Arcade Vault: pantallas visuales

**Estado:** Approved
**Depende de:** —
**Fecha:** 2026-08-08

**Objetivo:** Portar las 5 pantallas del template estático (`references/templates/`) a rutas reales de Next.js 16 App Router — biblioteca, detalle de juego, reproductor (simulado), inicio de sesión y salón de la fama — manteniendo la identidad visual retro-arcade, sin implementar lógica de ningún juego real.

## Alcance

**Incluye:**
- 5 pantallas navegables como rutas reales del App Router:
  - `/` — Biblioteca (grid de juegos, buscador, filtro por categoría).
  - `/juego/[id]` — Detalle del juego (info, stats, leaderboard).
  - `/juego/[id]/jugar` — Reproductor: HUD, pantalla CRT animada, simulación visual de partida (puntuación que sube sola, pausa, fin de partida, guardar puntuación). No hay mecánica de juego real ni input del jugador que afecte el resultado.
  - `/iniciar-sesion` — Login / registro (tabs), modo invitado, botones sociales decorativos (sin OAuth real).
  - `/salon-de-la-fama` — Leaderboard global por juego (tabs, podio, tabla), con fila destacada del usuario si hay sesión.
- Navbar persistente (desktop + menú móvil) con estado de sesión.
- Autenticación simulada: cualquier usuario/contraseña inicia sesión; persistencia en `localStorage` (clave `av_user`), sin backend.
- Puntuaciones guardadas en `localStorage` (clave `av_scores`) al terminar una partida simulada.
- Datos de juegos (`GAMES`, `CATS`) y generador de leaderboard de ejemplo (`seededScores`) como datos estáticos mock, portados de `references/templates/data.jsx`.
- Estilos retro-neón (pixel font, glow, CRT, scanlines, grid de fondo) portados de `references/templates/styles.css` a `app/globals.css`, conviviendo con la config CSS-first de Tailwind v4 ya presente.
- Fuentes "Press Start 2P" y "JetBrains Mono" cargadas vía `next/font/google`.
- Responsive según los breakpoints ya definidos en el template (`840px`, `900px`, `720px`).

**No incluye (fuera de alcance):**
- Lógica jugable de ningún juego (Bloque Buster, Caída, Serpentina, etc.). El "reproductor" es una simulación visual de UI, no un juego funcional.
- Backend real, base de datos, autenticación OAuth real o API de puntuaciones.
- Créditos/monedas funcionales (el contador "CRÉDITOS · 03" del nav es decorativo y fijo, igual que en el template).
- Tests automatizados (no hay test runner configurado en el proyecto).
- Cualquier pantalla no presente en `references/templates/` (perfil de usuario, configuración, etc.).

## Modelo de datos

Datos estáticos en cliente, sin base de datos. Estructuras nuevas (TypeScript, portadas de `data.jsx`):

```ts
// lib/data.ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;   // clase CSS del cover generado (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
};

export const GAMES: Game[];
export const CATS: string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[];

export type LeaderboardRow = { rank: number; name: string; score: number; date: string };
export function seededScores(seed: number, count?: number): LeaderboardRow[];
```

Estado de sesión y puntuaciones (cliente, vía `React.Context` + `useContext` + `localStorage`, portado de la lógica que hoy vive en `app.jsx`). Un único `AuthProvider` lee `localStorage` una sola vez y expone el usuario vía contexto; `Nav` y el `Reproductor` (y cualquier otra pantalla) lo consumen con `useContext` en vez de leer `localStorage` cada uno por su cuenta:

```ts
// components/auth-provider.tsx
export type User = { name: string };
export type ScoreEntry = { game: string; score: number; name: string; at: number };

// localStorage keys (mismas que el template): "av_user", "av_scores"
```

## Plan de implementación

1. **Layout base y tipografías.** Crear `app/layout.tsx`: cargar "Press Start 2P" y "JetBrains Mono" vía `next/font/google`, renderizar las capas de fondo (`av-bg`, `av-noise`), envolver la app en `AuthProvider`, montar `Nav` y el `footer`. Portar `references/templates/styles.css` a `app/globals.css`, integrando las variables `--cyan/--magenta/--yellow/...` con el `@theme inline` existente (resolver el choque con `--background`/`--foreground` del scaffold).
2. **Datos mock.** Crear `lib/data.ts` con `GAMES`, `CATS`, `PLAYERS`, `seededScores` y los tipos `Game`/`LeaderboardRow`, portados de `references/templates/data.jsx`.
3. **Sesión y puntuaciones.** Crear `components/auth-provider.tsx`: `React.Context` de cliente con `user`, `login(user)`, `logout()`, `saveScore(entry)`, leyendo/escribiendo `localStorage` (`av_user`, `av_scores`) solo en cliente para evitar desajustes de hidratación. Exponer un hook `useAuth()` (basado en `useContext`) para que `Nav`, el Reproductor y cualquier otra pantalla lean el mismo usuario sin duplicar lecturas de `localStorage`.
4. **Navbar.** Crear `components/nav.tsx` (cliente): logo, links activos según `usePathname` (Biblioteca activo en `/` y `/juego/*`), contador de créditos decorativo, botón de sesión/`iniciar-sesion`, menú móvil con backdrop. Portado de `nav.jsx`.
5. **Biblioteca.** Crear `app/page.tsx` + `components/game-card.tsx`: hero, buscador, chips de categoría, grid de tarjetas con efecto tilt, estado vacío. Portado de `biblioteca.jsx`.
6. **Detalle de juego.** Crear `app/juego/[id]/page.tsx`: cover, tags, descripción, stats, acciones ("Jugar ahora" → `/juego/[id]/jugar`, "Volver al vault" → `/`), leaderboard lateral con `seededScores`. Portado de `detalle.jsx`. Si el `id` no existe en `GAMES`, usar `notFound()`.
7. **Reproductor (simulado).** Crear `app/juego/[id]/jugar/page.tsx` (cliente): HUD (jugador, puntuación, vidas, nivel), pantalla CRT animada con la escena decorativa fija, simulación de puntuación creciente vía `setInterval`, pausa, botón "fin", modal de fin de partida con input de iniciales y `saveScore`. Portado de `reproductor.jsx`.
8. **Inicio de sesión.** Crear `app/iniciar-sesion/page.tsx` (cliente): tabs "Iniciar sesión"/"Crear cuenta", formulario simulado (`login()` acepta cualquier valor), modo invitado, botones sociales decorativos, redirección a `/` tras entrar. Portado de `auth.jsx`.
9. **Salón de la fama.** Crear `app/salon-de-la-fama/page.tsx` (cliente): tabs por juego, podio top 3, tabla de posiciones vía `seededScores`, fila destacada del usuario si hay sesión. Portado de `salon.jsx`.
10. **Revisión final.** Recorrer el flujo completo en el navegador (biblioteca → detalle → jugar → guardar puntuación → salón de la fama, login/logout, menú móvil) verificando estilos, animaciones y responsive en los tres breakpoints del template.

## Criterios de aceptación

- [ ] `/` muestra la biblioteca con buscador funcional y filtro por categoría (`TODOS`, `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`).
- [ ] Cada tarjeta de juego navega a `/juego/[id]` con la información correspondiente al `id`.
- [ ] `/juego/[id]` muestra info del juego y un leaderboard de 10 filas generado con `seededScores`.
- [ ] Un `id` inexistente en `/juego/[id]` devuelve la página 404 de Next.js.
- [ ] "Jugar ahora" navega a `/juego/[id]/jugar`, que muestra HUD + pantalla CRT y la puntuación sube sola sin input del usuario.
- [ ] En el reproductor, "Pausa" detiene el incremento de puntuación y "Fin" abre el modal de fin de partida.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores`) y muestra el mensaje de confirmación.
- [ ] `/iniciar-sesion` permite iniciar sesión con cualquier usuario/contraseña, crear cuenta, o entrar como invitado; tras iniciar sesión redirige a `/` y el nav muestra el nombre de usuario.
- [ ] Cerrar sesión desde el nav borra el usuario de `localStorage` y el nav vuelve a mostrar "Iniciar sesión".
- [ ] `/salon-de-la-fama` muestra podio y tabla por juego seleccionado en tabs, con fila destacada del usuario cuando hay sesión iniciada.
- [ ] El menú móvil (hamburguesa) se abre/cierra correctamente por debajo de 840px.
- [ ] No hay errores de hidratación en consola relacionados con `localStorage`/sesión al cargar cualquiera de las 5 rutas.
- [ ] Ningún juego tiene mecánica jugable real: el reproductor es una simulación visual, sin captura de input de juego.

## Decisiones tomadas y descartadas

- **Rutas reales de Next.js en vez de hash routing.** El template original usa una sola página con `location.hash` y un componente `App` monolítico. Se descarta para encajar con el App Router: URLs limpias, navegación nativa del navegador, mejor alineado con Next.js 16.
- **CSS global portado casi literal + Tailwind para utilidades nuevas, en vez de reescribir todo a utilidades Tailwind.** Prioriza fidelidad visual exacta al template (glows, `clip-path`, animaciones CRT) sobre "pureza" de Tailwind; reescribir todo a utilidades habría sido mucho trabajo con alto riesgo de perder detalles finos.
- **Reproductor con simulación visual completa (score automático, pausa, modal, guardado), en vez de una pantalla estática.** "No implementar ningún juego" se interpreta como "sin mecánica jugable real", no como "sin flujo de UI". Mantener la simulación permite demostrar el flujo completo (jugar → guardar puntuación → verla en el salón de la fama), que es el propósito del MVP visual.
- **Auth y puntuaciones 100% mock con `localStorage`, sin backend.** Coincide con "solamente la parte visual"; no se introduce ninguna capa de datos real.
- **Estado de sesión centralizado con `useContext` (`AuthProvider`), en vez de que cada pantalla lea `localStorage` por su cuenta.** `Nav` y el Reproductor necesitan leer el mismo usuario; sin contexto habría lecturas duplicadas de `localStorage` (y riesgo de que queden desincronizadas entre sí, p. ej. tras un login/logout).
- **Slugs de ruta en español** (`/juego/[id]`, `/iniciar-sesion`, `/salon-de-la-fama`), consistente con el idioma de la UI y el contenido del template.
- **Fuentes vía `next/font/google`** en vez de `<link>` a Google Fonts, para auto-hospedaje y mejor rendimiento, alineado con las convenciones de Next.js 16.

## Riesgos identificados

- **Colisión de variables CSS.** El scaffold ya define `--background`/`--foreground` en `app/globals.css` vía `@theme inline`; hay que reconciliarlas con las variables del template (`--bg`, `--ink`, etc.) sin romper ninguna de las dos.
- **Hidratación con `localStorage`.** Leer `av_user`/`av_scores` durante el render inicial puede desincronizar servidor/cliente. Mitigación: leer el estado de sesión solo dentro de `useEffect` en el `AuthProvider` (cliente), no en el render de servidor.
- **Rendimiento de las animaciones CRT/scanlines/pixel** en dispositivos móviles de gama baja, por el volumen de `box-shadow`/`filter` con glow. Se acepta el riesgo por ser fiel al template; revisar en el paso de revisión final si hace falta simplificar.
