---
name: spec-impl-game
description: Implementa una spec aprobada de un juego siguiendo /spec-impl y, al terminar el plan, encadena @skin-designer y luego @mobile-porter sobre ese juego. Usar en vez de /spec-impl cuando la spec añade un juego nuevo al catálogo.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npm run build:*), Bash(npm run lint:*), mcp__supabase__list_tables, mcp__supabase__execute_sql, mcp__supabase__apply_migration
---

# /spec-impl-game — Implementer de specs de juegos, con skins y táctil incluidos

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Specs de game-jam pendientes de revisión (viven fuera de specs/, no las encuentra /spec-impl):
!`ls -d specs/game-jam/*/ 2>/dev/null || echo "no hay specs de game-jam pendientes"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

Juegos ya con skins registradas:
!`cat references/game-with-themes.md 2>/dev/null | head -40 || echo "sin registro todavía"`

Juegos ya portados a móvil:
!`cat references/mobile-ported-games.md 2>/dev/null | head -40 || echo "sin registro todavía"`

---

## Instructions

Este comando es un envoltorio de `/spec-impl`: no reimplementa su lógica, la ejecuta al pie de la letra y le añade dos fases al final para que un juego nuevo nunca quede a medio terminar (sin skins o sin soporte táctil). Sigue las fases en orden estricto. **No avances de fase si la anterior no terminó correctamente.**

---

### Fase 0 — Delegar en /spec-impl (Fases 1 a 4)

`/spec-impl` tiene `disable-model-invocation: true`, así que no se invoca como skill: se ejecuta por lectura.

1. Lee con la herramienta Read el archivo `.claude/skills/spec-impl/SKILL.md`.
2. Ejecuta sus Fases 1, 2, 3 y 4 **exactamente como están escritas**, usando `$ARGUMENTS` como argumento y el contexto de sesión de arriba (que es el mismo que usa `/spec-impl`, más las tres inyecciones extra). No relajes ni reinterpretes ninguna de sus reglas:
   - Fase 1: localizar la spec en `specs/` (nombre completo, número o slug). Si no la encuentra, mostrar las specs disponibles y las de `specs/game-jam/*/` como pista si el usuario buscaba una de esas, y pedir que corrija.
   - Fase 2: bloqueo duro si el estado no significa "Aprobado" (en cualquier idioma) — mismo mensaje de error estándar, sin ofrecer alternativas.
   - Fase 3: chequeo de working tree sucio antes de tocar git, derivar `spec-NN-slug`, respetar `AutoCreateBranch`, mostrar el resumen de la spec (objetivo, alcance, plan, criterios de aceptación).
   - Fase 4: implementar paso a paso con pausa y confirmación explícita después de cada paso. **Nunca commitear automáticamente.** Ambigüedades → parar y presentar opciones. Pedidos fuera de alcance → recordar que quedan fuera de esta spec.

No sigas a la Fase 5 hasta que el último paso del plan de implementación esté hecho (el punto donde `spec-impl` imprimiría `✅ All steps of the plan are implemented.`).

---

### Fase 5 — Identificar el juego de la spec

Con el plan ya implementado, determina el id del juego que esta spec añadió o modificó, en este orden de preferencia:

1. La línea nueva en `GAME_REGISTRY` dentro de `lib/games/registry.ts` (el id es la clave del objeto).
2. La carpeta `lib/games/<id>/` creada o tocada por esta implementación.
3. El id declarado en la fila insertada/actualizada en la tabla `games` de Supabase (spec o migración).

Si encuentras un id de forma consistente en al menos dos de esas fuentes (o una sola si es inequívoca), muéstraselo al usuario:

```
Juego detectado: <id>
¿Confirmas que lance @skin-designer y luego @mobile-porter sobre este juego?
```

Espera confirmación explícita antes de continuar. Si el usuario corrige el id, usa el que indique.

**Si no encuentras ningún id de juego** (la spec no toca `GAME_REGISTRY`, `lib/games/`, ni la tabla `games`): avisa

```
Esta spec no parece añadir ni modificar un juego del catálogo, así que omito
@skin-designer y @mobile-porter. Implementación terminada normalmente.
```

y ve directo a la Fase 8 (Cierre).

---

### Fase 6 — Skins (@skin-designer)

Lanza el subagente `skin-designer` (herramienta Agent, `subagent_type: "skin-designer"`) con el id de juego confirmado en la Fase 5, pidiéndole explícitamente que garantice las skins `classic`/`neon`/`retro` para ese juego siguiendo su propio flujo.

Espera a que termine por completo antes de seguir. Cuando termine, resume brevemente al usuario qué archivos tocó y qué paletas definió (o que ya existían y no hizo falta cambiar nada).

---

### Fase 7 — Soporte táctil móvil (@mobile-porter)

**Solo después de que la Fase 6 haya terminado por completo.** No lances este subagente en el mismo bloque de tool calls que `@skin-designer`, ni en paralelo con él bajo ningún motivo: ambos subagentes editan el motor del juego (`lib/games/<id>/engine.ts`), `lib/games/registry.ts` y `components/jugar-client.tsx`/`touch-controls.tsx`, y correr los dos a la vez arriesga pisar cambios del otro.

Lanza el subagente `mobile-porter` (`subagent_type: "mobile-porter"`) con el mismo id de juego. Espera a que termine y resume al usuario qué cableó (`touchActions`, entrada en `TOUCH_DIRECTIONS`, `drawHUD()` si hizo falta).

---

### Fase 8 — Cierre

Mensaje final (reemplaza al de `/spec-impl`, que solo cubre la spec):

```
✅ Spec implementada, con skins y soporte táctil incluidos.

  1. Plan de la spec:        implementado paso a paso
  2. Skins (@skin-designer): <hecho / omitido — motivo>
  3. Táctil (@mobile-porter): <hecho / omitido — motivo>

Próximos pasos:
  - Verifica los criterios de aceptación de la spec uno por uno.
  - Corre `npm run build` y un pase en navegador (tarjeta → detalle →
    jugar → HUD → game over → score guardado → leaderboard).
  - Si todo pasa, actualiza el estado de la spec a "Implementado".
  - El commit final es tuyo — yo no committeo automáticamente.
```

---

## Resumen del comportamiento esperado

```
/spec-impl-game 14-frogger-core   (estado: Aprobado, spec de un juego nuevo)

  Fase 0  →  Delega en spec-impl Fases 1-4: rama spec-14-frogger-core,
             implementación paso a paso con pausas
  Fase 5  →  Detecta id "frogger" en GAME_REGISTRY, pide confirmación
  Fase 6  →  @skin-designer frogger — garantiza classic/neon/retro
  Fase 7  →  @mobile-porter frogger — cablea gamepad táctil + HUD
  Fase 8  →  Resumen de cierre con los tres tramos hechos

/spec-impl-game 05-contact-form   (estado: Aprobado, spec que no toca juegos)

  Fase 0  →  Delega en spec-impl Fases 1-4, implementa normalmente
  Fase 5  →  No detecta id de juego → avisa y omite Fases 6 y 7
  Fase 8  →  Resumen de cierre con skins/táctil marcados como omitidos

/spec-impl-game 02-powerups   (estado: Draft / Borrador)

  Fase 0  →  spec-impl Fase 2 detecta estado no-Aprobado → detiene todo
             con el mensaje de error estándar. No se llega a la Fase 5.
```

La creación de rama sigue controlada por `AutoCreateBranch` en `specs/.spec-config.yml`, exactamente igual que en `/spec-impl`.
