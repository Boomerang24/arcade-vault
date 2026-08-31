// SIFÓN — bubble shooter original (spec 19). Motor puro, desacoplado de React.
// Todo el arte es procedural: círculos con gradiente radial, líneas y shadowBlur.
// Paso 1: geometría de la rejilla hexagonal + render estático del tanque vacío.
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
// Filas "largas" (offset 0): 13 celdas, centro x = 184 + 36·c  (c = 0..12)
// Filas "cortas" (offset D/2): 12 celdas, centro x = 202 + 36·c (c = 0..11)
const LONG_ROW_X0 = 184;
const SHORT_ROW_X0 = 202;
const LONG_ROW_CELLS = 13;
const SHORT_ROW_CELLS = 12;
// ---- colores (sistema visual del sitio; @skin-designer los paletiza luego) ----
const COLORS = {
  bg: "#050510",
  poolWall: "#3a3a6a",
  poolFill: "rgba(0,245,255,0.04)",
  press: "#5a5a7a",
  pressEdge: "#9a9ac0",
  pressBolt: "#1a1a2e",
  danger: "#ef4444",
  dangerAlt: "#1a1000",
  nozzle: "#00f5ff",
  panelBg: "#0a0a1a",
  panelLine: "rgba(0,245,255,0.15)",
  hud: "#f0f0f0",
  hudDim: "rgba(240,240,240,0.5)",
  gaugeFrame: "#3a3a6a",
  gaugeFill: "#f5ff00",
  overlayTitle: "#00f5ff",
  overlaySub: "rgba(240,240,240,0.65)",
} as const;
// 4 colores de burbuja tomados del sistema neón del sitio.
export type BubbleColor = "cyan" | "magenta" | "yellow" | "green";
export const BUBBLE_HEX: Record<BubbleColor, string> = {
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
};
// Activar para verificar la geometría: pinta cada centro de celda y valida el
// ida y vuelta pixel→celda→pixel. Nunca queda activo en producción.
const DEBUG_GRID = false;
// ---- funciones puras de conversión celda <-> píxel ----
// La paridad de una fila puede invertirse globalmente cuando baja la prensa;
// `parityFlip` (0 ó 1) captura esa inversión y viaja a todas las conversiones.
export function rowIsShort(r: number, parityFlip: number): boolean {
  return (((r + parityFlip) % 2) + 2) % 2 === 1;
}
export function rowCellCount(r: number, parityFlip: number): number {
  return rowIsShort(r, parityFlip) ? SHORT_ROW_CELLS : LONG_ROW_CELLS;
}
export function cellToPixel(
  r: number,
  c: number,
  techoY: number,
  parityFlip: number,
): { x: number; y: number } {
  const x0 = rowIsShort(r, parityFlip) ? SHORT_ROW_X0 : LONG_ROW_X0;
  return { x: x0 + D * c, y: techoY + R + ROW_H * r };
}
export function pixelToCell(
  x: number,
  y: number,
  techoY: number,
  parityFlip: number,
): { r: number; c: number } {
  const r = Math.round((y - techoY - R) / ROW_H);
  const x0 = rowIsShort(r, parityFlip) ? SHORT_ROW_X0 : LONG_ROW_X0;
  const c = Math.round((x - x0) / D);
  return { r, c };
}
export function cellInBounds(
  r: number,
  c: number,
  parityFlip: number,
): boolean {
  return r >= 0 && c >= 0 && c < rowCellCount(r, parityFlip);
}
// Vecindario hexagonal de 6 celdas, dependiente de la paridad de la fila.
// Fila corta (desplazada +D/2): las vecinas arriba/abajo caen en c y c+1.
// Fila larga: caen en c-1 y c.
export function hexNeighbors(
  r: number,
  c: number,
  parityFlip: number,
): Array<{ r: number; c: number }> {
  const short = rowIsShort(r, parityFlip);
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
export class SifonEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: "playing" | "dead" | "gameover" = "playing";
  // Borde inferior de la prensa; arranca en POOL_TOP y baja de a ROW_H.
  private techoY = POOL_TOP;
  private parityFlip = 0;
  private pressure = 0;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private paused = false;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.rafId = requestAnimationFrame(this.loop);
  }
  // ---- update ----
  private update(_dt: number) {
    // Paso 1: sin mecánica todavía. Los pasos 3-7 llenan esto.
  }
  // ---- render ----
  private drawPanels() {
    const ctx = this.ctx;
    // Fondos de los tres paneles (izq, der, franja superior).
    ctx.fillStyle = COLORS.panelBg;
    ctx.fillRect(0, 0, POOL_LEFT, H);
    ctx.fillRect(POOL_RIGHT, 0, W - POOL_RIGHT, H);
    ctx.fillRect(0, 0, W, POOL_TOP);
    ctx.strokeStyle = COLORS.panelLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, POOL_LEFT - 1, H - 1);
    ctx.strokeRect(POOL_RIGHT + 0.5, 0.5, W - POOL_RIGHT - 1, H - 1);
    // Franja superior: rótulo del tanque + posición de la prensa.
    ctx.fillStyle = COLORS.hud;
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.fillText("TANQUE // EMBOTELLADORA", 14, 24);
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.hudDim;
    const fila = Math.round((this.techoY - POOL_TOP) / ROW_H);
    ctx.fillText(`PRENSA · FILA ${fila}`, W - 14, 24);
    // Panel izquierdo: puntuación, nivel, vidas.
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = "11px monospace";
    ctx.fillText("PUNTUACIÓN", 16, 90);
    ctx.fillText("NIVEL", 16, 150);
    ctx.fillText("VIDAS", 16, 210);
    ctx.fillStyle = COLORS.hud;
    ctx.font = "20px monospace";
    ctx.fillText(String(this.score), 16, 114);
    ctx.fillText(String(this.level), 16, 174);
    // Vidas como círculos.
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(24 + i * 24, 230, 8, 0, Math.PI * 2);
      if (i < this.lives) {
        ctx.fillStyle = COLORS.nozzle;
        ctx.fill();
      } else {
        ctx.strokeStyle = COLORS.hudDim;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // Panel derecho: cola de las 2 próximas + manómetro.
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SIGUIENTE", POOL_RIGHT + 16, 90);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(POOL_RIGHT + 40, 120 + i * 44, R, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.panelLine;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Manómetro vertical.
    const gx = POOL_RIGHT + 30;
    const gy = 250;
    const gw = 20;
    const gh = 260;
    ctx.fillStyle = COLORS.hudDim;
    ctx.fillText("PRESIÓN", POOL_RIGHT + 16, gy - 12);
    ctx.strokeStyle = COLORS.gaugeFrame;
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy, gw, gh);
    const frac = Math.max(0, Math.min(1, this.pressure));
    ctx.fillStyle = COLORS.gaugeFill;
    ctx.fillRect(gx + 2, gy + gh - gh * frac + 2, gw - 4, gh * frac - 4);
  }
  private drawWell() {
    const ctx = this.ctx;
    // Relleno tenue del pozo.
    ctx.fillStyle = COLORS.poolFill;
    ctx.fillRect(
      POOL_LEFT,
      POOL_TOP,
      POOL_RIGHT - POOL_LEFT,
      POOL_BOTTOM - POOL_TOP,
    );
    // Paredes laterales.
    ctx.strokeStyle = COLORS.poolWall;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(POOL_LEFT, POOL_TOP);
    ctx.lineTo(POOL_LEFT, POOL_BOTTOM);
    ctx.moveTo(POOL_RIGHT, POOL_TOP);
    ctx.lineTo(POOL_RIGHT, POOL_BOTTOM);
    ctx.stroke();
  }
  private drawPress() {
    const ctx = this.ctx;
    const top = Math.max(0, this.techoY - 26);
    // Cuerpo de la prensa desde arriba del canvas hasta techoY.
    const grad = ctx.createLinearGradient(0, top, 0, this.techoY);
    grad.addColorStop(0, COLORS.pressBolt);
    grad.addColorStop(1, COLORS.press);
    ctx.fillStyle = grad;
    ctx.fillRect(POOL_LEFT, top, POOL_RIGHT - POOL_LEFT, this.techoY - top);
    // Borde inferior brillante (la cara que aplasta).
    ctx.strokeStyle = COLORS.pressEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(POOL_LEFT, this.techoY);
    ctx.lineTo(POOL_RIGHT, this.techoY);
    ctx.stroke();
    // Remaches.
    ctx.fillStyle = COLORS.pressBolt;
    for (let x = POOL_LEFT + 20; x < POOL_RIGHT; x += 48) {
      ctx.beginPath();
      ctx.arc(x, this.techoY - 13, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  private drawDangerLine() {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(POOL_LEFT, DANGER_Y - 5, POOL_RIGHT - POOL_LEFT, 10);
    ctx.clip();
    ctx.fillStyle = COLORS.dangerAlt;
    ctx.fillRect(POOL_LEFT, DANGER_Y - 5, POOL_RIGHT - POOL_LEFT, 10);
    ctx.fillStyle = COLORS.danger;
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
  private drawNozzle() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(NOZZLE_X, NOZZLE_Y);
    ctx.shadowColor = COLORS.nozzle;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.nozzle;
    // Boquilla: base ancha y caño estrecho apuntando arriba (ángulo 0 = vertical).
    ctx.beginPath();
    ctx.moveTo(-16, 24);
    ctx.lineTo(16, 24);
    ctx.lineTo(7, 2);
    ctx.lineTo(4, -14);
    ctx.lineTo(-4, -14);
    ctx.lineTo(-7, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  private drawDebugGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "8px monospace";
    let worst = 0;
    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < rowCellCount(r, this.parityFlip); c++) {
        const p = cellToPixel(r, c, this.techoY, this.parityFlip);
        if (p.y > POOL_BOTTOM) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        const back = pixelToCell(p.x, p.y, this.techoY, this.parityFlip);
        const rt = cellToPixel(back.r, back.c, this.techoY, this.parityFlip);
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
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this.drawWell();
    this.drawDangerLine();
    this.drawPress();
    this.drawNozzle();
    this.drawPanels();
    if (DEBUG_GRID) this.drawDebugGrid();
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
  }
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }
  reset(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.techoY = POOL_TOP;
    this.parityFlip = 0;
    this.pressure = 0;
    if (this.paused) {
      this.paused = false;
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  forceGameOver(): void {
    if (this.state === "gameover") return;
    this.lives = 0;
    this.state = "gameover";
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
    });
    this.callbacks.onGameOver(this.score);
  }
  destroy(): void {
    this.pause();
  }
}
