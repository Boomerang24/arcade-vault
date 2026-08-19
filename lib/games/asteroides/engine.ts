// Port de references/started-games/02-asteroids/game.js a TypeScript,
// sin cambios de balance/físicas respecto al original.
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
// ---- skins ----
export type SkinName = "classic" | "neon" | "retro";
type Palette = {
  background: string;
  ship: string;
  thruster: string;
  bullet: string;
  asteroid: string;
  particle: string;
  hud: string;
  overlayTitle: string;
  overlaySub: string;
};
const SKIN_PALETTES: Record<SkinName, Palette> = {
  // `classic` reproduce exactamente los literales originales del port.
  classic: {
    background: "#000000",
    ship: "#ffffff",
    thruster: "#ff8200",
    bullet: "#ffffff",
    asteroid: "#ffffff",
    particle: "#ffffff",
    hud: "#ffffff",
    overlayTitle: "#ffffff",
    overlaySub: "#ffffff",
  },
  neon: {
    background: "#06000f",
    ship: "#00f5ff",
    thruster: "#00ff88",
    bullet: "#f5ff00",
    asteroid: "#ff006e",
    particle: "#f5ff00",
    hud: "#00f5ff",
    overlayTitle: "#ff006e",
    overlaySub: "#00f5ff",
  },
  retro: {
    background: "#0a0600",
    ship: "#ffb000",
    thruster: "#ff7b00",
    bullet: "#ffd280",
    asteroid: "#cc8c00",
    particle: "#ffb000",
    hud: "#ffb000",
    overlayTitle: "#ffb000",
    overlaySub: "#ffb000",
  },
};
// El original dibuja partículas y el subtítulo con alpha; para poder
// paletizarlos sin perder ese fundido, convertimos el hex de la paleta a rgba.
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
// Glow por skin: se aplica dentro de cada primitiva de dibujo.
function applySkinGlow(
  ctx: CanvasRenderingContext2D,
  skin: SkinName,
  color: string,
  blur = 12,
) {
  if (skin === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  } else {
    ctx.shadowBlur = 0;
  }
}
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;
  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }
  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
}
// Todas las balas comparten color y glow: un solo save/shadowBlur/restore para
// el lote en vez de uno por bala. El fill() se mantiene por bala (y no un path
// acumulado) porque acumular varios arcos en un mismo path cambia el
// antialiasing del contorno, y el resultado dejaría de ser idéntico pixel a
// pixel; las balas son pocas, así que el ahorro estaría en el glow, no aquí.
function drawBulletBatch(
  ctx: CanvasRenderingContext2D,
  bullets: Bullet[],
  p: Palette,
  skin: SkinName,
) {
  if (bullets.length === 0) return;
  ctx.save();
  applySkinGlow(ctx, skin, p.bullet, 10);
  ctx.fillStyle = p.bullet;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];
const LARGE_ASTEROID_SHAPES: Array<Array<[number, number]>> = [
  [
    [-0.102, -0.944],
    [0.458, -0.808],
    [0.384, -0.172],
    [0.904, -0.068],
    [0.684, 0.526],
    [0.342, 0.396],
    [0.048, 0.89],
    [-0.63, 0.616],
    [-0.998, 0.048],
    [-0.876, -0.534],
  ],
];
class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: Array<[number, number]>;
  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);
    if (size === 3 && Math.random() < 0.5) {
      const shape =
        LARGE_ASTEROID_SHAPES[randInt(0, LARGE_ASTEROID_SHAPES.length - 1)];
      this.verts = shape.map(([nx, ny]) => [
        nx * this.radius,
        ny * this.radius,
      ]);
    } else {
      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }
  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }
  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }
}
// Un solo save/shadowBlur/restore para todos los asteroides del frame en vez
// de uno por asteroide. La transformación de cada uno se aplica con
// `setTransform()` (equivalente a translate+rotate) en vez de save/restore, y
// el fill/stroke se mantiene por asteroide para que el resultado sea idéntico
// pixel a pixel también cuando dos asteroides se solapan (el relleno es
// translúcido y un path compartido no lo acumularía igual).
function drawAsteroidBatch(
  ctx: CanvasRenderingContext2D,
  asteroids: Asteroid[],
  p: Palette,
  skin: SkinName,
) {
  if (asteroids.length === 0) return;
  ctx.save();
  if (skin === "neon") applySkinGlow(ctx, skin, p.asteroid, 14);
  else ctx.shadowBlur = 0;
  ctx.strokeStyle = p.asteroid;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  // `neon` rellena con glow; `retro` con un tinte fósforo sin glow; `classic` no rellena.
  const fill =
    skin === "neon"
      ? withAlpha(p.asteroid, 0.12)
      : skin === "retro"
        ? withAlpha(p.asteroid, 0.1)
        : null;
  if (fill) ctx.fillStyle = fill;
  for (const a of asteroids) {
    // Se reproduce exactamente la misma secuencia que el código original
    // (identidad -> translate -> rotate) en vez de componer la matriz a mano:
    // así el redondeo en punto flotante es idéntico y no cambia ni un pixel
    // de antialiasing en los bordes.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.beginPath();
    ctx.moveTo(a.verts[0][0], a.verts[0][1]);
    for (let i = 1; i < a.verts.length; i++)
      ctx.lineTo(a.verts[i][0], a.verts[i][1]);
    ctx.closePath();
    if (fill) ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
class Ship {
  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 0;
  shootCooldown = 0;
  dead = false;
  constructor() {
    this.reset();
  }
  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }
  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    const ROT = 3.5;
    const THRUST = 260;
    const DRAG = 0.987;
    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;
    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }
    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }
  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }
  draw(ctx: CanvasRenderingContext2D, p: Palette, skin: SkinName) {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    applySkinGlow(ctx, skin, p.ship, 12);
    ctx.strokeStyle = p.ship;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      applySkinGlow(ctx, skin, p.thruster, 12);
      ctx.strokeStyle = withAlpha(p.thruster, 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }
}
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
}
// Todas las partículas comparten glow y grosor: un solo save/shadowBlur/
// restore para el lote. El `strokeStyle` sí cambia por partícula (cada una
// tiene su propio alpha de fundido), así que se mantiene un stroke() por
// partícula y en el orden original, para no alterar el resultado.
function drawParticleBatch(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  p: Palette,
  skin: SkinName,
) {
  if (particles.length === 0) return;
  ctx.save();
  applySkinGlow(ctx, skin, p.particle, 8);
  ctx.lineWidth = 1;
  for (const q of particles) {
    const alpha = q.ttl / q.life;
    ctx.strokeStyle = withAlpha(p.particle, Number(alpha.toFixed(2)));
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x - q.vx * 0.05, q.y - q.vy * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}
export class AsteroidesEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private ship!: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: "playing" | "dead" | "gameover" = "playing";
  private deadTimer = 0;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private paused = false;
  private currentSkin: SkinName = "classic";
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.initGame();
    this.rafId = requestAnimationFrame(this.loop);
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
    if (this.paused) return;
    this.justPressed[e.code] = !this.keys[e.code];
    this.keys[e.code] = true;
  };
  private handleKeyUp = (e: KeyboardEvent) => {
    if (this.paused) return;
    this.keys[e.code] = false;
  };
  private pressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }
  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }
  private initGame() {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.spawnAsteroids(4);
  }
  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }
  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }
  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
      this.callbacks.onGameOver(this.score);
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }
  private update(dt: number) {
    if (this.state === "gameover") {
      if (this.pressed("Space")) this.initGame();
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      return;
    }
    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt));
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }
    if (this.pressed("Space")) {
      this.bullets.push(...this.ship.tryShoot());
    }
    this.ship.update(dt, this.keys);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }
    if (this.asteroids.length === 0) this.nextLevel();
  }
  private get palette(): Palette {
    return SKIN_PALETTES[this.currentSkin];
  }
  // Los iconos de vida comparten color, glow y transformación de rotación:
  // un solo save/shadowBlur/restore para los N iconos, con `setTransform()`
  // por icono en vez de save/translate/rotate/restore.
  private drawLives() {
    if (this.lives <= 0) return;
    const ctx = this.ctx;
    const hud = this.palette.hud;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, hud, 8);
    ctx.strokeStyle = hud;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    for (let i = 0; i < this.lives; i++) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(W - 16 - i * 22, 18);
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
  private drawHUD() {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, p.hud, 8);
    ctx.fillStyle = p.hud;
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, W / 2, 26);
    ctx.restore();
    this.drawLives();
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.save();
    ctx.textAlign = "center";
    applySkinGlow(ctx, this.currentSkin, p.overlayTitle, 18);
    ctx.fillStyle = p.overlayTitle;
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = "18px monospace";
    applySkinGlow(ctx, this.currentSkin, p.overlaySub, 10);
    ctx.fillStyle = withAlpha(p.overlaySub, 0.65);
    ctx.fillText(sub, W / 2, H / 2 + 22);
    ctx.restore();
  }
  // Buffer offscreen con las scanlines pre-renderizadas: se dibuja una sola
  // vez y luego cada frame solo hace drawImage() del buffer, en vez de repetir
  // 200 fillRect por frame. El patrón no depende de la skin (siempre el mismo),
  // así que se cachea para toda la vida del engine.
  private scanlinesBuffer: HTMLCanvasElement | null = null;
  private getScanlinesBuffer(): HTMLCanvasElement {
    if (this.scanlinesBuffer) return this.scanlinesBuffer;
    const buffer = document.createElement("canvas");
    buffer.width = W;
    buffer.height = H;
    const bctx = buffer.getContext("2d");
    if (bctx) {
      // Las líneas se guardan en negro opaco y el 0.22 se aplica al componer
      // con `globalAlpha`: guardar el alpha dentro del buffer lo cuantizaría a
      // 56/255 y el resultado quedaría 1 nivel por debajo del `fillRect` original.
      bctx.fillStyle = "#000000";
      for (let y = 0; y < H; y += 3) bctx.fillRect(0, y, W, 1);
    }
    this.scanlinesBuffer = buffer;
    return buffer;
  }
  // Textura CRT de la skin `retro`: scanlines horizontales sutiles.
  private drawScanlines() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(this.getScanlinesBuffer(), 0, 0);
    ctx.restore();
  }
  private draw() {
    const ctx = this.ctx;
    const pal = this.palette;
    const skin = this.currentSkin;
    ctx.fillStyle = pal.background;
    ctx.fillRect(0, 0, W, H);
    drawParticleBatch(ctx, this.particles, pal, skin);
    drawAsteroidBatch(ctx, this.asteroids, pal, skin);
    drawBulletBatch(ctx, this.bullets, pal, skin);
    // La nave es instancia única por frame: no hay lote que agrupar.
    this.ship.draw(ctx, pal, skin);
    if (skin === "retro") this.drawScanlines();
    this.drawHUD();
    if (this.state === "gameover") {
      this.drawOverlay(
        "GAME OVER",
        `PUNTAJE: ${this.score}   —   ESPACIO PARA REINICIAR`,
      );
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
  // Redibuja sincrónicamente para que el cambio de skin se vea también en pausa.
  setSkin(skin: SkinName): void {
    this.currentSkin = skin;
    this.draw();
  }
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
    this.initGame();
    if (this.paused) {
      this.paused = false;
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  forceGameOver(): void {
    if (this.state === "gameover") return;
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
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
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
