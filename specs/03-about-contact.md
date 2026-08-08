# 03 — About / Contacto

**Estado:** Approved
**Depende de:** SPEC 02
**Fecha:** 2026-08-08

**Objetivo:** Portar `about.jsx` del template estático (`references/templates/home-about/`) como la nueva ruta `/about`, con el formulario de contacto enviando correos reales vía Resend a través de una API Route.

## Alcance

**Incluye:**
- Nueva ruta `/about` con la página portada de `about.jsx`:
  - Sección `about-hero`: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", párrafo de misión, y `highlight-row` con 3 tarjetas (`HighlightIcon` HEART/BROWSER/PLANT) con sus colores (magenta/cyan/green).
  - Banner divisor `about-divider` con animación de píxeles, con clase `.reveal`.
  - Sección `about-contact` (`.reveal`) con `contact-grid`: columna de intro/tips a la izquierda, formulario a la derecha.
  - Animación reveal-on-scroll (`useReveal`, mismo patrón `IntersectionObserver` + clases `.reveal`/`.in` que en spec 02) aplicada a `about-divider` y `about-contact`.
- Formulario de contacto (campos: nombre, correo electrónico, mensaje) con:
  - Validación de campos vacíos igual que el template: si falta algo, animación `shake` (sin llamar a la API).
  - Al enviar con datos válidos: `POST` a `app/api/contact/route.ts` con `{ name, email, msg }`.
  - Estado de carga: mientras espera la respuesta, botón deshabilitado con texto "ENVIANDO…".
  - Estado de error: si la API responde error o falla la red, mostrar mensaje de error reusando la animación `shake` del template, permitiendo reintentar sin perder los datos escritos.
  - Estado de éxito: solo se muestra `terminal-success` (con el nombre del remitente) cuando la API confirma el envío; botón "ENVIAR OTRO MENSAJE" resetea el formulario al estado inicial.
- Nueva API Route `app/api/contact/route.ts`:
  - Recibe `POST` con `{ name, email, msg }`.
  - Usa el SDK `resend` con `process.env.RESEND_API_KEY` para enviar el correo:
    - `from`: `"Arcade Vault <onboarding@resend.dev>"` (dominio de pruebas de Resend).
    - `to`: `process.env.CONTACT_TO_EMAIL`.
    - `replyTo`: el correo ingresado en el formulario.
    - `subject`: incluye el nombre del remitente.
    - Cuerpo: incluye nombre, correo y mensaje.
  - Devuelve `200` con `{ ok: true }` en éxito, o `4xx/5xx` con `{ ok: false, error }` si falla la validación o la llamada a Resend.
  - Valida en servidor que `name`, `email` y `msg` no estén vacíos antes de llamar a Resend.
- Nueva dependencia `resend` (paquete npm) agregada a `package.json`.
- Variables de entorno documentadas en `.env.local` (el usuario las completa manualmente después; no se versiona, ya cubierto por `.env*` en `.gitignore`):
  - `RESEND_API_KEY`: API key de Resend.
  - `CONTACT_TO_EMAIL`: correo destino de las notificaciones de contacto (valor a usar: `alx2495dev@gmail.com`).
- `.env.template` (versionado, exceptuado en `.gitignore` vía `!.env.template`) con ambas claves sin valores, como referencia para quien clone el repo.
- Actualizar `components/nav.tsx`: agregar `<Link href="/about">Acerca de</Link>` (desktop + panel móvil), entre "Salón de la Fama" y el botón de autenticación; nuevo `isAbout = pathname === "/about"` para el estado activo.
- Portar los estilos nuevos de `references/templates/home-about/styles.css` relacionados a about/contacto (`.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.highlight`, `.hl-icon`, `.hl-text`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`, `.contact-grid`, `.contact-intro`, `.contact-title`, `.contact-sub`, `.contact-tips`, `.contact-form`, `.contact-form.shake`, `.terminal-success`, `.term-bar`, `.term-body`, etc.) a `app/globals.css`, resolviendo colisiones de nombres con lo ya portado en specs 01/02 si las hubiera.

**No incluye (fuera de alcance):**
- Dominio propio verificado en Resend (queda para un spec futuro si se decide comprar/verificar un dominio; por ahora se usa `onboarding@resend.dev`).
- Persistencia de los mensajes de contacto en base de datos o archivo — el mensaje solo se envía por correo, no se guarda en el proyecto.
- Protección anti-spam (honeypot, captcha, rate limiting) — no está en el template ni se pide explícitamente.
- Envío de correo de confirmación automático al remitente del formulario — solo se notifica al destinatario (`alx2495dev@gmail.com`); el `replyTo` permite responder directamente.
- Cambios a otras páginas (`/`, `/biblioteca`, `/salon-de-la-fama`) más allá del link de nav.

## Modelo de datos

No se introducen estructuras de datos persistentes. El payload del formulario (`{ name, email, msg }`) es efímero: viaja del cliente a la API Route y de ahí a Resend, sin guardarse en `lib/data.ts` ni en ningún almacenamiento.

## Plan de implementación

1. **Instalar dependencia.** Agregar `resend` a `package.json` (`npm install resend`).
2. **Variables de entorno.** Crear `.env.template` (versionado) con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=` sin valores. Agregar `.env.local` (no versionado) con `RESEND_API_KEY=` vacío y `CONTACT_TO_EMAIL=alx2495dev@gmail.com`.
3. **API Route.** Crear `app/api/contact/route.ts`: valida `name`/`email`/`msg` no vacíos, instancia `Resend` con `process.env.RESEND_API_KEY`, envía el correo a `process.env.CONTACT_TO_EMAIL` desde `onboarding@resend.dev` con `replyTo` del remitente, devuelve `{ ok: true }` o `{ ok: false, error }` según el resultado.
4. **Estilos de about/contacto.** Portar las reglas relevantes de `references/templates/home-about/styles.css` (listadas en el alcance) a `app/globals.css`, verificando colisiones con clases existentes.
5. **Componente About.** Crear `app/about/page.tsx` (cliente) con el contenido portado de `about.jsx`: `HighlightIcon`, hook `useReveal` (reutilizando el mismo patrón de spec 02), secciones hero/divider/contact. El formulario usa `fetch("/api/contact", { method: "POST", body: JSON.stringify({ name, email, msg }) })` con estados `idle | loading | success | error`.
6. **Actualizar Nav.** En `components/nav.tsx`: agregar `<Link href="/about">Acerca de</Link>` (desktop y móvil) con `isAbout = pathname === "/about"`.
7. **Revisión final.** Recorrer en el navegador: `/about` (hero, highlight-row, divider animado, formulario), enviar formulario con campos vacíos (shake, sin llamada a red), enviar formulario válido (loading → éxito si `RESEND_API_KEY` está configurada, o error visible si no lo está/falla), nav muestra "Acerca de" con estado activo correcto, ningún error de hidratación o consola.

## Criterios de aceptación

- [ ] `/about` muestra el hero (kicker, título, misión, 3 highlight cards), el banner divisor animado, y la sección de contacto (intro + tips + formulario).
- [ ] Las secciones con clase `.reveal` (`about-divider`, `about-contact`) aparecen ocultas hasta entrar en el viewport, momento en el que reciben `.in` y se animan.
- [ ] Enviar el formulario con algún campo vacío dispara la animación `shake` y NO hace ninguna llamada de red.
- [ ] Enviar el formulario con todos los campos completos hace `POST` a `/api/contact` y muestra estado "ENVIANDO…" con el botón deshabilitado mientras espera respuesta.
- [ ] Si `/api/contact` responde éxito, se muestra `terminal-success` con el nombre del remitente en mayúsculas; el botón "ENVIAR OTRO MENSAJE" resetea el formulario.
- [ ] Si `/api/contact` responde error (o falla la red), se muestra un mensaje de error visible (reusando `shake`) y los datos del formulario no se pierden.
- [ ] `app/api/contact/route.ts` rechaza (`4xx`) requests con `name`, `email` o `msg` vacíos sin llamar a Resend.
- [ ] `app/api/contact/route.ts` usa `process.env.RESEND_API_KEY` y `process.env.CONTACT_TO_EMAIL` (ninguno hardcodeado) y envía el correo con `replyTo` igual al correo del formulario.
- [ ] `.env.template` (versionado) documenta `RESEND_API_KEY` y `CONTACT_TO_EMAIL` sin valores; `.env.local` (no versionado) contiene los valores reales.
- [ ] El nav (desktop y menú móvil) muestra "Acerca de" apuntando a `/about`, activo solo en esa ruta.
- [ ] No hay errores de hidratación ni de consola al cargar `/about`.

## Decisiones tomadas y descartadas

- **API Route (`app/api/contact/route.ts`) en vez de Server Action.** Mantiene la API key de Resend estrictamente en servidor y sigue el patrón explícito de fetch desde el cliente, más fácil de depurar (status code, body de error) que una Server Action con `useTransition`.
- **`onboarding@resend.dev` como remitente en vez de dominio propio.** No hay dominio verificado en Resend todavía; permite enviar correos de inmediato sin configurar DNS. Migrar a un dominio propio queda para un spec futuro si se decide.
- **Agregar loading + error real al formulario, en vez de mantener el comportamiento estático del template.** Como ahora el envío es real (vía Resend), el usuario necesita saber si el correo realmente se envió o si falló, a diferencia del template que solo simulaba el éxito.
- **Agregar el link "Acerca de" al nav ahora**, revirtiendo la decisión de spec 02 de omitirlo. En spec 02 `/about` no existía todavía; ahora que se implementa, el link debe ser visible.
- **`RESEND_API_KEY` en `.env.local` sin valor, a completar por el usuario.** El usuario proveerá su propia API key después de la implementación; el código solo debe leer `process.env.RESEND_API_KEY`.
- **`CONTACT_TO_EMAIL` como variable de entorno en vez de hardcodear `alx2495dev@gmail.com` en el código.** Permite cambiar el destinatario sin tocar código y evita versionar la dirección real en `.env.template`; el valor concreto vive solo en `.env.local`.
- **No hay persistencia de mensajes ni protección anti-spam.** Fuera de alcance por ahora: el template no la define y no fue solicitada explícitamente; se puede añadir en un spec futuro si se detecta abuso.

## Riesgos identificados

- **Sin `RESEND_API_KEY` configurada, todo envío fallará.** Mitigado por el estado de error visible en el formulario (paso 5 del plan) — el usuario ve claramente que el envío no se completó, en vez de un fallo silencioso.
- **Modo sandbox de Resend con `onboarding@resend.dev`** solo garantiza entrega al correo verificado de la cuenta de Resend del usuario; si se prueba con otros destinatarios podría no llegar. Aceptado como limitación temporal hasta verificar un dominio propio.
