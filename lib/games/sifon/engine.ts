// SIFÓN — bubble shooter original (spec 19). Motor puro, desacoplado de React.
// Todo el arte es procedural: círculos con gradiente radial, líneas y shadowBlur.
export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};
export type EngineCallbacks = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
const W = 800;
const H = 600;
// ---- geometría del pozo ----
// El área jugable es un pozo vertical central; el resto del canvas son paneles
// de HUD dibujados dentro del propio canvas.
const POOL_LEFT = 166;
const POOL_RIGHT = 634;
const POOL_TOP = 60; // borde inferior mínimo de la prensa / techo del canvas jugable
const POOL_BOTTOM = 600;
const D = 36; // diámetro de burbuja
const R = D / 2; // radio
const ROW_H = 31; // 36·sin(60°) ≈ 31, separación vertical entre filas
const DANGER_Y = 500; // línea de peligro (centro de burbuja por debajo = purga)
const NOZZLE_X = 400;
const NOZZLE_Y = 545;
const MUZZLE_Y = NOZZLE_Y - 14; // punta del caño
// Filas "largas" (offset 0): 13 celdas, centro x = 184 + 36·c  (c = 0..12)
// Filas "cortas" (offset D/2): 12 celdas, centro x = 202 + 36·c (c = 0..11)
const LONG_ROW_X0 = 184;
const SHORT_ROW_X0 = 202;
const LONG_ROW_CELLS = 13;
const SHORT_ROW_CELLS = 12;
// ---- física ----
const SPEED = 620; // px/s del proyectil
const ROT_SPEED = (110 * Math.PI) / 180; // rad/s de la boquilla
const MAX_ANGLE = (75 * Math.PI) / 180; // tope duro ±75° respecto de la vertical
const GRAVITY = 900; // px/s² para las burbujas que caen
const DEAD_SECONDS = 1.2; // duración de la purga
const MAX_SUBSTEP = R; // el proyectil nunca avanza más de D/2 sin re-evaluar colisión
// ---- reglas de nivel ----
const pressureThreshold = (level: number) => Math.max(8 - (level - 1), 4);
const initialRows = (level: number) => Math.min(5 + (level - 1), 8);
// 4 colores de burbuja tomados del sistema neón del sitio.
export type BubbleColor = "cyan" | "magenta" | "yellow" | "green";
const ALL_COLORS: BubbleColor[] = ["cyan", "magenta", "yellow", "green"];
// ---- skins ----
// Todo literal de color del motor vive en una paleta por skin. Los efectos de
// estilo (intensidad de glow, scanlines) también son campos de la paleta, no
// ramas `if (skin === ...)` esparcidas por el archivo: `classic` ya tenía glow
// propio (8/12/18) y había que conservarlo exacto.
export type SkinName = "classic" | "neon" | "retro";
export type Palette = {
  bg: string;
  poolWall: string;
  poolFill: string;
  press: string;
  pressEdge: string;
  pressBolt: string;
  danger: string;
  dangerAlt: string;
  nozzle: string;
  aimGuide: string;
  panelBg: string;
  panelLine: string;
  hud: string;
  hudDim: string;
  gaugeFrame: string;
  gaugeFill: string;
  overlayTitle: string;
  overlaySub: string;
  purgeFlash: string; // hex; el alpha se deriva con withAlpha()
  bubbles: Record<BubbleColor, string>;
  bubbleCore: string; // centro del gradiente radial de la burbuja
  bubbleSpecular: string; // punto de brillo
  bubbleBlur: number;
  nozzleBlur: number;
  overlayBlur: number;
  scanlines: boolean;
};
export const SKIN_PALETTES: Record<SkinName, Palette> = {
  classic: {
    bg: "#050510",
    poolWall: "#3a3a6a",
    poolFill: "rgba(0,245,255,0.04)",
    press: "#5a5a7a",
    pressEdge: "#9a9ac0",
    pressBolt: "#1a1a2e",
    danger: "#ef4444",
    dangerAlt: "#1a1000",
    nozzle: "#00f5ff",
    aimGuide: "rgba(0,245,255,0.6)",
    panelBg: "#0a0a1a",
    panelLine: "rgba(0,245,255,0.15)",
    hud: "#f0f0f0",
    hudDim: "rgba(240,240,240,0.5)",
    gaugeFrame: "#3a3a6a",
    gaugeFill: "#f5ff00",
    overlayTitle: "#00f5ff",
    overlaySub: "rgba(240,240,240,0.7)",
    purgeFlash: "#ef4444",
    bubbles: {
      cyan: "#00f5ff",
      magenta: "#ff006e",
      yellow: "#f5ff00",
      green: "#00ff88",
    },
    bubbleCore: "#ffffff",
    bubbleSpecular: "rgba(255,255,255,0.5)",
    bubbleBlur: 8,
    nozzleBlur: 12,
    overlayBlur: 18,
    scanlines: false,
  },
  neon: {
    bg: "#06000f",
    poolWall: "#c800ff",
    poolFill: "rgba(255,0,110,0.05)",
    press: "#7a00b0",
    pressEdge: "#f5ff00",
    pressBolt: "#12002b",
    danger: "#ff006e",
    dangerAlt: "#12002b",
    nozzle: "#00f5ff",
    aimGuide: "rgba(0,245,255,0.7)",
    panelBg: "#0b0018",
    panelLine: "rgba(200,0,255,0.25)",
    hud: "#00f5ff",
    hudDim: "rgba(0,245,255,0.55)",
    gaugeFrame: "#c800ff",
    gaugeFill: "#f5ff00",
    overlayTitle: "#ff006e",
    overlaySub: "rgba(0,245,255,0.75)",
    purgeFlash: "#ff006e",
    bubbles: {
      cyan: "#00f5ff",
      magenta: "#ff006e",
      yellow: "#f5ff00",
      green: "#00ff88",
    },
    bubbleCore: "#ffffff",
    bubbleSpecular: "rgba(255,255,255,0.6)",
    bubbleBlur: 16,
    nozzleBlur: 20,
    overlayBlur: 26,
    scanlines: false,
  },
  retro: {
    bg: "#0a0600",
    poolWall: "#8a5200",
    poolFill: "rgba(255,176,0,0.04)",
    press: "#8a5200",
    pressEdge: "#ffb000",
    pressBolt: "#1a1000",
    danger: "#ff7b00",
    dangerAlt: "#1a1000",
    nozzle: "#ffb000",
    aimGuide: "rgba(255,176,0,0.6)",
    panelBg: "#140c00",
    panelLine: "rgba(255,176,0,0.15)",
    hud: "#ffb000",
    hudDim: "rgba(255,176,0,0.5)",
    gaugeFrame: "#8a5200",
    gaugeFill: "#ffb000",
    overlayTitle: "#ffb000",
    overlaySub: "rgba(255,176,0,0.7)",
    purgeFlash: "#ff7b00",
    // Ramp de 4 intensidades de ámbar: el color ES la mecánica (emparejado de
    // 3), así que `retro` no puede ser monocromo puro como en otros juegos.
    bubbles: {
      cyan: "#ffe9b0",
      magenta: "#ffb000",
      yellow: "#d18800",
      green: "#7a4400",
    },
    bubbleCore: "rgba(255,232,190,0.6)",
    bubbleSpecular: "rgba(255,232,190,0.35)",
    bubbleBlur: 0,
    nozzleBlur: 0,
    overlayBlur: 0,
    scanlines: true,
  },
};
// Paleta de burbujas de `classic`, conservada como export histórico.
export const BUBBLE_HEX: Record<BubbleColor, string> =
  SKIN_PALETTES.classic.bubbles;
// Activar para verificar la geometría: pinta cada centro de celda y valida el
// ida y vuelta pixel→celda→pixel. Nunca queda activo en producción.
const DEBUG_GRID = false;
// ---- funciones puras de conversión celda <-> píxel ----
// Decisión (ver Riesgos de la spec): la paridad de fila se deriva del índice
// absoluto `r` de la burbuja, no de la posición de la prensa. Así el descenso
// de la prensa es un simple `techoY += ROW_H` y ninguna burbuja cambia de tipo
// de fila (nunca se sale del rango de columnas). No hay `parityFlip`.
export function rowIsShort(r: number): boolean {
  return ((r % 2) + 2) % 2 === 1;
}
export function rowCellCount(r: number): number {
  return rowIsShort(r) ? SHORT_ROW_CELLS : LONG_ROW_CELLS;
}
export function cellToPixel(
  r: number,
  c: number,
  techoY: number,
): { x: number; y: number } {
  const x0 = rowIsShort(r) ? SHORT_ROW_X0 : LONG_ROW_X0;
  return { x: x0 + D * c, y: techoY + R + ROW_H * r };
}
export function pixelToCell(
  x: number,
  y: number,
  techoY: number,
): { r: number; c: number } {
  const r = Math.round((y - techoY - R) / ROW_H);
  const x0 = rowIsShort(r) ? SHORT_ROW_X0 : LONG_ROW_X0;
  const c = Math.round((x - x0) / D);
  return { r, c };
}
export function cellInBounds(r: number, c: number): boolean {
  return r >= 0 && c >= 0 && c < rowCellCount(r);
}
// Vecindario hexagonal de 6 celdas, dependiente de la paridad de la fila.
// Fila corta (desplazada +D/2): las vecinas arriba/abajo caen en c y c+1.
// Fila larga: caen en c-1 y c.
export function hexNeighbors(
  r: number,
  c: number,
): Array<{ r: number; c: number }> {
  const short = rowIsShort(r);
  const a = short ? c : c - 1;
  const b = short ? c + 1 : c;
  return [
    { r, c: c - 1 },
    { r, c: c + 1 },
    { r: r - 1, c: a },
    { r: r - 1, c: b },
    { r: r + 1, c: a },
    { r: r + 1, c: b },
  ];
}
// ---- utilidades de color ----
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r},${g},${b})`;
}
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const key = (r: number, c: number) => `${r},${c}`;
const parseKey = (k: string): { r: number; c: number } => {
  const [r, c] = k.split(",").map(Number);
  return { r, c };
};
type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
};
type Falling = { x: number; y: number; vy: number; color: BubbleColor };
export class SifonEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: "playing" | "dead" | "gameover" = "playing";
  private currentSkin: SkinName = "classic";
  private get palette(): Palette {
    return SKIN_PALETTES[this.currentSkin];
  }
  // Borde inferior de la prensa; arranca en POOL_TOP y baja de a ROW_H.
  private techoY = POOL_TOP;
  private pressure = 0;
  private deadTimer = 0;
  private gameOverFired = false;
  // masa: celdas ocupadas (r,c) -> color. Se dibuja vía un canvas offscreen.
  private mass = new Map<string, BubbleColor>();
  private massCanvas: HTMLCanvasElement;
  private massCtx: CanvasRenderingContext2D;
  private massDirty = true;
  // cañón
  private angle = 0; // 0 = vertical; + hacia la derecha
  private loaded: BubbleColor = "cyan";
  private queue: BubbleColor[] = ["cyan", "cyan"];
  private projectile: Projectile | null = null;
  private falling: Falling[] = [];
  // entrada
  private keys: Record<string, boolean> = {};
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private paused = false;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.massCanvas = document.createElement("canvas");
    this.massCanvas.width = W;
    this.massCanvas.height = H;
    const mctx = this.massCanvas.getContext("2d");
    if (!mctx) throw new Error("No se pudo crear el buffer de la masa");
    this.massCtx = mctx;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.initGame();
    this.rafId = requestAnimationFrame(this.loop);
  }
  // ---- ciclo de vida de la partida ----
  private initGame() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.techoY = POOL_TOP;
    this.pressure = 0;
    this.deadTimer = 0;
    this.gameOverFired = false;
    this.angle = 0;
    this.projectile = null;
    this.falling = [];
    this.generateTank(1);
  }
  // Generación determinista por nivel: bloques horizontales de 2 del mismo
  // color, desplazados una celda por fila y tres por nivel. Garantiza pares
  // (racimo de 3 al primer disparo que encaje) y solapes verticales parciales.
  private generateTank(level: number) {
    this.mass.clear();
    const rows = initialRows(level);
    for (let r = 0; r < rows; r++) {
      const count = rowCellCount(r);
      for (let c = 0; c < count; c++) {
        const idx = Math.floor((c + r + level * 3) / 2) % ALL_COLORS.length;
        this.mass.set(key(r, c), ALL_COLORS[idx]);
      }
    }
    this.massDirty = true;
    this.queue = [this.pickColor(), this.pickColor()];
    this.loaded = this.pickColor();
  }
  // La burbuja cargada y la cola solo usan colores presentes en la masa.
  private pickColor(): BubbleColor {
    const present = Array.from(new Set(this.mass.values()));
    const pool = present.length > 0 ? present : ALL_COLORS;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  private advanceQueue() {
    this.loaded = this.queue[0];
    this.queue = [this.queue[1], this.pickColor()];
  }
  // ---- entrada ----
  private handleKeyDown = (e: KeyboardEvent) => {
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
    if (this.paused) return;
    const firstPress = !this.keys[e.code];
    this.keys[e.code] = true;
    if (!firstPress || this.state !== "playing") return;
    if (e.code === "Space" || e.code === "ArrowUp") this.fire();
    if (e.code === "ArrowDown") {
      const swap = this.loaded;
      this.loaded = this.queue[0];
      this.queue = [swap, this.queue[1]];
    }
  };
  private handleKeyUp = (e: KeyboardEvent) => {
    if (this.paused) return;
    this.keys[e.code] = false;
  };
  private fire() {
    if (this.projectile) return;
    const vx = Math.sin(this.angle) * SPEED;
    const vy = -Math.cos(this.angle) * SPEED;
    this.projectile = {
      x: NOZZLE_X + Math.sin(this.angle) * 20,
      y: MUZZLE_Y - Math.cos(this.angle) * 20,
      vx,
      vy,
      color: this.loaded,
    };
    this.advanceQueue();
    this.pressure += 1;
  }
  // ---- simulación ----
  private update(dt: number) {
    if (this.state === "gameover") {
      this.stepFalling(dt);
      return;
    }
    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.stepFalling(dt);
      if (this.deadTimer <= 0) this.state = "playing";
      return;
    }
    if (this.keys["ArrowLeft"]) this.angle -= ROT_SPEED * dt;
    if (this.keys["ArrowRight"]) this.angle += ROT_SPEED * dt;
    this.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, this.angle));
    this.stepFalling(dt);
    if (this.projectile) this.stepProjectile(dt);
  }
  private stepFalling(dt: number) {
    for (const f of this.falling) {
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
    }
    this.falling = this.falling.filter((f) => f.y < H + 40);
  }
  private stepProjectile(dt: number) {
    let remaining = SPEED * dt;
    while (remaining > 0 && this.projectile) {
      const p = this.projectile;
      const step = Math.min(remaining, MAX_SUBSTEP);
      remaining -= step;
      const inv = step / SPEED;
      p.x += p.vx * inv;
      p.y += p.vy * inv;
      // rebote elástico en las paredes: reflejar posición y velocidad.
      if (p.x < POOL_LEFT + R) {
        p.x = POOL_LEFT + R;
        p.vx = Math.abs(p.vx);
      } else if (p.x > POOL_RIGHT - R) {
        p.x = POOL_RIGHT - R;
        p.vx = -Math.abs(p.vx);
      }
      // contacto con el borde inferior de la prensa
      if (p.y - R <= this.techoY) {
        this.settleProjectile();
        return;
      }
      // colisión círculo-círculo contra la masa
      for (const k of this.mass.keys()) {
        const { r, c } = parseKey(k);
        const cp = cellToPixel(r, c, this.techoY);
        if (Math.hypot(cp.x - p.x, cp.y - p.y) < D) {
          this.settleProjectile();
          return;
        }
      }
    }
  }
  private settleProjectile() {
    const p = this.projectile;
    if (!p) return;
    const color = p.color;
    const target = this.resolveCell(p.x, p.y);
    this.projectile = null;
    this.mass.set(key(target.r, target.c), color);
    this.massDirty = true;
    this.resolveClusters(target.r, target.c);
    this.maybeDescendPress();
    this.checkDanger();
  }
  // Celda destino: la del punto de parada si está libre; si no, la vecina
  // hexagonal vacía más cercana al centro del proyectil.
  private resolveCell(x: number, y: number): { r: number; c: number } {
    const guess = pixelToCell(x, y, this.techoY);
    if (
      guess.r >= 0 &&
      cellInBounds(guess.r, guess.c) &&
      !this.mass.has(key(guess.r, guess.c))
    ) {
      return guess;
    }
    // candidatas: celdas vacías adyacentes a una ocupada, o a la fila 0.
    const cands = new Map<string, { r: number; c: number }>();
    const consider = (r: number, c: number) => {
      if (r < 0 || !cellInBounds(r, c) || this.mass.has(key(r, c))) return;
      cands.set(key(r, c), { r, c });
    };
    if (this.mass.size === 0) {
      for (let c = 0; c < rowCellCount(0); c++) consider(0, c);
    } else {
      for (const k of this.mass.keys()) {
        const { r, c } = parseKey(k);
        for (const n of hexNeighbors(r, c)) consider(n.r, n.c);
      }
    }
    let best: { r: number; c: number } | null = null;
    let bestDist = Infinity;
    for (const cand of cands.values()) {
      const cp = cellToPixel(cand.r, cand.c, this.techoY);
      const d = Math.hypot(cp.x - x, cp.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
      }
    }
    if (best) return best;
    // fallback: clamp de la conjetura al rango válido.
    const r = Math.max(0, guess.r);
    return { r, c: Math.max(0, Math.min(rowCellCount(r) - 1, guess.c)) };
  }
  private floodColor(r0: number, c0: number): string[] {
    const start = this.mass.get(key(r0, c0));
    if (!start) return [];
    const seen = new Set<string>([key(r0, c0)]);
    const stack = [{ r: r0, c: c0 }];
    while (stack.length) {
      const { r, c } = stack.pop()!;
      for (const n of hexNeighbors(r, c)) {
        const nk = key(n.r, n.c);
        if (seen.has(nk)) continue;
        if (this.mass.get(nk) === start) {
          seen.add(nk);
          stack.push(n);
        }
      }
    }
    return Array.from(seen);
  }
  private resolveClusters(r: number, c: number) {
    const cluster = this.floodColor(r, c);
    if (cluster.length >= 3) {
      for (const k of cluster) {
        this.mass.delete(k);
        this.score += 10;
      }
      // desprendimiento: lo que ya no conecta con la prensa (fila 0) cae.
      const anchored = new Set<string>();
      const stack: Array<{ r: number; c: number }> = [];
      for (const k of this.mass.keys()) {
        if (parseKey(k).r === 0) {
          anchored.add(k);
          stack.push(parseKey(k));
        }
      }
      while (stack.length) {
        const cell = stack.pop()!;
        for (const n of hexNeighbors(cell.r, cell.c)) {
          const nk = key(n.r, n.c);
          if (!anchored.has(nk) && this.mass.has(nk)) {
            anchored.add(nk);
            stack.push(n);
          }
        }
      }
      for (const k of Array.from(this.mass.keys())) {
        if (anchored.has(k)) continue;
        const { r: fr, c: fc } = parseKey(k);
        const fp = cellToPixel(fr, fc, this.techoY);
        this.falling.push({
          x: fp.x,
          y: fp.y,
          vy: 0,
          color: this.mass.get(k)!,
        });
        this.mass.delete(k);
        this.score += 20;
      }
      this.massDirty = true;
    }
    if (this.mass.size === 0) {
      this.score += 1000;
      this.level += 1;
      this.techoY = POOL_TOP;
      this.pressure = 0;
      this.generateTank(this.level);
    }
  }
  private maybeDescendPress() {
    if (this.pressure < pressureThreshold(this.level)) return;
    this.techoY += ROW_H;
    this.pressure = 0;
    this.massDirty = true;
  }
  // Línea de peligro: si tras un snap o un descenso alguna burbuja tiene su
  // centro en y ≥ DANGER_Y, se pierde una vida y se purgan las 3 filas de abajo.
  private checkDanger() {
    if (this.state !== "playing" || this.mass.size === 0) return;
    let crossed = false;
    let maxR = -1;
    for (const k of this.mass.keys()) {
      const { r, c } = parseKey(k);
      maxR = Math.max(maxR, r);
      if (cellToPixel(r, c, this.techoY).y >= DANGER_Y) crossed = true;
    }
    if (!crossed) return;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.triggerGameOver();
      return;
    }
    // purga: quitar las 3 filas inferiores, subir la prensa 3 filas.
    for (const k of Array.from(this.mass.keys())) {
      if (parseKey(k).r >= maxR - 2) this.mass.delete(k);
    }
    this.techoY = Math.max(POOL_TOP, this.techoY - 3 * ROW_H);
    this.pressure = 0;
    this.massDirty = true;
    this.state = "dead";
    this.deadTimer = DEAD_SECONDS;
  }
  private triggerGameOver() {
    this.state = "gameover";
    if (!this.gameOverFired) {
      this.gameOverFired = true;
      this.callbacks.onGameOver(this.score);
    }
  }
  // ---- render ----
  private renderMassCache() {
    const ctx = this.massCtx;
    const pal = this.palette;
    ctx.clearRect(0, 0, W, H);
    const byColor = new Map<BubbleColor, Array<{ x: number; y: number }>>();
    for (const [k, color] of this.mass) {
      const { r, c } = parseKey(k);
      const arr = byColor.get(color) ?? [];
      arr.push(cellToPixel(r, c, this.techoY));
      byColor.set(color, arr);
    }
    // Cuerpos: un save/shadowBlur por color, no por burbuja.
    for (const [color, pts] of byColor) {
      const hex = pal.bubbles[color];
      ctx.save();
      ctx.shadowColor = hex;
      ctx.shadowBlur = pal.bubbleBlur;
      for (const pt of pts) {
        const g = ctx.createRadialGradient(
          pt.x - 5,
          pt.y - 5,
          2,
          pt.x,
          pt.y,
          R,
        );
        g.addColorStop(0, pal.bubbleCore);
        g.addColorStop(0.25, hex);
        g.addColorStop(1, shade(hex, 0.55));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, R - 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Brillos especulares: pasada única sin sombra.
    ctx.save();
    ctx.fillStyle = pal.bubbleSpecular;
    for (const pts of byColor.values()) {
      for (const pt of pts) {
        ctx.beginPath();
        ctx.arc(pt.x - 5, pt.y - 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    this.massDirty = false;
  }
  private drawBubbleAt(x: number, y: number, color: BubbleColor) {
    const ctx = this.ctx;
    const pal = this.palette;
    const hex = pal.bubbles[color];
    ctx.save();
    ctx.shadowColor = hex;
    ctx.shadowBlur = pal.bubbleBlur;
    const g = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, R);
    g.addColorStop(0, pal.bubbleCore);
    g.addColorStop(0.25, hex);
    g.addColorStop(1, shade(hex, 0.55));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = pal.bubbleSpecular;
    ctx.beginPath();
    ctx.arc(x - 5, y - 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  private drawWell() {
    const ctx = this.ctx;
    ctx.fillStyle = this.palette.poolFill;
    ctx.fillRect(
      POOL_LEFT,
      POOL_TOP,
      POOL_RIGHT - POOL_LEFT,
      POOL_BOTTOM - POOL_TOP,
    );
    ctx.strokeStyle = this.palette.poolWall;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(POOL_LEFT, POOL_TOP);
    ctx.lineTo(POOL_LEFT, POOL_BOTTOM);
    ctx.moveTo(POOL_RIGHT, POOL_TOP);
    ctx.lineTo(POOL_RIGHT, POOL_BOTTOM);
    ctx.stroke();
  }
  private drawDangerLine() {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(POOL_LEFT, DANGER_Y - 5, POOL_RIGHT - POOL_LEFT, 10);
    ctx.clip();
    ctx.fillStyle = this.palette.dangerAlt;
    ctx.fillRect(POOL_LEFT, DANGER_Y - 5, POOL_RIGHT - POOL_LEFT, 10);
    ctx.fillStyle = this.palette.danger;
    for (let x = POOL_LEFT - 20; x < POOL_RIGHT; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, DANGER_Y + 5);
      ctx.lineTo(x + 10, DANGER_Y + 5);
      ctx.lineTo(x + 20, DANGER_Y - 5);
      ctx.lineTo(x + 10, DANGER_Y - 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  private drawPress() {
    const ctx = this.ctx;
    const pal = this.palette;
    const top = Math.max(0, this.techoY - 26);
    const grad = ctx.createLinearGradient(0, top, 0, this.techoY);
    grad.addColorStop(0, pal.pressBolt);
    grad.addColorStop(1, pal.press);
    ctx.fillStyle = grad;
    ctx.fillRect(POOL_LEFT, top, POOL_RIGHT - POOL_LEFT, this.techoY - top);
    ctx.strokeStyle = pal.pressEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(POOL_LEFT, this.techoY);
    ctx.lineTo(POOL_RIGHT, this.techoY);
    ctx.stroke();
    ctx.fillStyle = pal.pressBolt;
    for (let x = POOL_LEFT + 20; x < POOL_RIGHT; x += 48) {
      ctx.beginPath();
      ctx.arc(x, this.techoY - 13, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  private drawNozzle() {
    const ctx = this.ctx;
    const pal = this.palette;
    // guía de puntería: rayo punteado corto, sin predicción de rebotes.
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = pal.aimGuide;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(NOZZLE_X, MUZZLE_Y);
    ctx.lineTo(
      NOZZLE_X + Math.sin(this.angle) * 90,
      MUZZLE_Y - Math.cos(this.angle) * 90,
    );
    ctx.stroke();
    ctx.restore();
    // burbuja cargada en la punta.
    this.drawBubbleAt(
      NOZZLE_X + Math.sin(this.angle) * 20,
      MUZZLE_Y - Math.cos(this.angle) * 20,
      this.loaded,
    );
    // cuerpo de la boquilla.
    ctx.save();
    ctx.translate(NOZZLE_X, NOZZLE_Y);
    ctx.rotate(this.angle);
    ctx.shadowColor = pal.nozzle;
    ctx.shadowBlur = pal.nozzleBlur;
    ctx.fillStyle = pal.nozzle;
    ctx.beginPath();
    ctx.moveTo(-16, 24);
    ctx.lineTo(16, 24);
    ctx.lineTo(7, 2);
    ctx.lineTo(4, -18);
    ctx.lineTo(-4, -18);
    ctx.lineTo(-7, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  private drawPanels() {
    const ctx = this.ctx;
    const pal = this.palette;
    ctx.fillStyle = pal.panelBg;
    ctx.fillRect(0, 0, POOL_LEFT, H);
    ctx.fillRect(POOL_RIGHT, 0, W - POOL_RIGHT, H);
    ctx.fillRect(0, 0, W, POOL_TOP);
    ctx.strokeStyle = pal.panelLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, POOL_LEFT - 1, H - 1);
    ctx.strokeRect(POOL_RIGHT + 0.5, 0.5, W - POOL_RIGHT - 1, H - 1);
    // franja superior
    ctx.fillStyle = pal.hud;
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.fillText("TANQUE // EMBOTELLADORA", 14, 24);
    ctx.textAlign = "right";
    ctx.fillStyle = pal.hudDim;
    const fila = Math.round((this.techoY - POOL_TOP) / ROW_H);
    ctx.fillText(`PRENSA · FILA ${fila}`, W - 14, 24);
    // panel izquierdo
    ctx.textAlign = "left";
    ctx.fillStyle = pal.hudDim;
    ctx.font = "11px monospace";
    ctx.fillText("PUNTUACIÓN", 16, 90);
    ctx.fillText("NIVEL", 16, 150);
    ctx.fillText("VIDAS", 16, 210);
    ctx.fillStyle = pal.hud;
    ctx.font = "20px monospace";
    ctx.fillText(String(this.score), 16, 114);
    ctx.fillText(String(this.level), 16, 174);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(24 + i * 24, 230, 8, 0, Math.PI * 2);
      if (i < this.lives) {
        ctx.fillStyle = pal.nozzle;
        ctx.fill();
      } else {
        ctx.strokeStyle = pal.hudDim;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // panel derecho: cola + manómetro
    ctx.fillStyle = pal.hudDim;
    ctx.font = "11px monospace";
    ctx.fillText("SIGUIENTE", POOL_RIGHT + 16, 90);
    for (let i = 0; i < 2; i++) {
      this.drawBubbleAt(POOL_RIGHT + 40, 120 + i * 44, this.queue[i]);
    }
    const gx = POOL_RIGHT + 30;
    const gy = 250;
    const gw = 20;
    const gh = 260;
    ctx.fillStyle = pal.hudDim;
    ctx.fillText("PRESIÓN", POOL_RIGHT + 16, gy - 12);
    ctx.strokeStyle = pal.gaugeFrame;
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy, gw, gh);
    const frac = Math.max(
      0,
      Math.min(1, this.pressure / pressureThreshold(this.level)),
    );
    ctx.fillStyle = pal.gaugeFill;
    ctx.fillRect(
      gx + 2,
      gy + gh - gh * frac + 2,
      gw - 4,
      Math.max(0, gh * frac - 4),
    );
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    const pal = this.palette;
    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = pal.overlayTitle;
    ctx.shadowBlur = pal.overlayBlur;
    ctx.fillStyle = pal.overlayTitle;
    ctx.font = "bold 44px monospace";
    ctx.fillText(title, W / 2, H / 2 - 14);
    ctx.shadowBlur = 0;
    ctx.font = "16px monospace";
    ctx.fillStyle = pal.overlaySub;
    ctx.fillText(sub, W / 2, H / 2 + 24);
    ctx.restore();
  }
  private drawDebugGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "8px monospace";
    let worst = 0;
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < rowCellCount(r); c++) {
        const p = cellToPixel(r, c, this.techoY);
        if (p.y > POOL_BOTTOM) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        const back = pixelToCell(p.x, p.y, this.techoY);
        const rt = cellToPixel(back.r, back.c, this.techoY);
        worst = Math.max(worst, Math.hypot(rt.x - p.x, rt.y - p.y));
      }
    }
    ctx.fillStyle = worst < 0.001 ? "#00ff88" : "#ef4444";
    ctx.fillText(
      `roundtrip err: ${worst.toFixed(4)}`,
      POOL_LEFT + 4,
      POOL_BOTTOM - 6,
    );
    ctx.restore();
  }
  // Buffer offscreen con las scanlines pre-renderizadas: se dibuja una sola
  // vez y luego cada frame solo hace drawImage(). El patrón no depende de la
  // skin, así que se cachea para toda la vida del engine.
  private scanlinesBuffer: HTMLCanvasElement | null = null;
  private drawScanlines() {
    if (!this.scanlinesBuffer) {
      const buffer = document.createElement("canvas");
      buffer.width = W;
      buffer.height = H;
      const bctx = buffer.getContext("2d");
      if (bctx) {
        bctx.fillStyle = "rgba(0,0,0,0.22)";
        for (let y = 0; y < H; y += 3) bctx.fillRect(0, y, W, 1);
      }
      this.scanlinesBuffer = buffer;
    }
    this.ctx.drawImage(this.scanlinesBuffer, 0, 0);
  }
  private draw() {
    const ctx = this.ctx;
    const pal = this.palette;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    this.drawWell();
    if (this.massDirty) this.renderMassCache();
    ctx.drawImage(this.massCanvas, 0, 0);
    for (const f of this.falling) this.drawBubbleAt(f.x, f.y, f.color);
    if (this.projectile) {
      this.drawBubbleAt(
        this.projectile.x,
        this.projectile.y,
        this.projectile.color,
      );
    }
    this.drawDangerLine();
    this.drawPress();
    this.drawNozzle();
    // Las scanlines van sobre el pozo pero debajo de los paneles y del
    // overlay, para que el HUD y el texto de fin de partida sigan legibles.
    if (pal.scanlines) this.drawScanlines();
    this.drawPanels();
    if (this.state === "dead") {
      ctx.save();
      ctx.fillStyle = withAlpha(
        pal.purgeFlash,
        0.25 * Math.max(0, this.deadTimer / DEAD_SECONDS),
      );
      ctx.fillRect(
        POOL_LEFT,
        POOL_TOP,
        POOL_RIGHT - POOL_LEFT,
        POOL_BOTTOM - POOL_TOP,
      );
      ctx.restore();
    }
    if (DEBUG_GRID) this.drawDebugGrid();
    if (this.state === "gameover") {
      this.drawOverlay("GAME OVER", `PUNTUACIÓN: ${this.score}`);
    }
  }
  private loop = (ts: number) => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
    });
    if (!this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };
  // ---- control externo ----
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.draw();
    this.drawOverlay("PAUSA", "");
  }
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }
  reset(): void {
    this.initGame();
    this.massDirty = true;
    if (this.paused) {
      this.paused = false;
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  // Cambia la skin activa. Invalida el cache de la masa (donde están horneadas
  // las burbujas ya asentadas) y redibuja sincrónicamente, para que el cambio
  // se vea al instante también en pausa.
  setSkin(skin: SkinName): void {
    if (!(skin in SKIN_PALETTES) || skin === this.currentSkin) return;
    this.currentSkin = skin;
    this.massDirty = true;
    this.draw();
    if (this.paused) this.drawOverlay("PAUSA", "");
  }
  forceGameOver(): void {
    if (this.state === "gameover") return;
    this.lives = 0;
    this.triggerGameOver();
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
    });
  }
  destroy(): void {
    this.pause();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
