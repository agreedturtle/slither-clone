// ===========================================================================
// Renderer.js — performance-first Canvas 2D drawing.
// ===========================================================================

import { SKINS, RAINBOW_STOPS, FOOD_COLORS, FOOD_DEATH_COLOR } from '../../shared/colors.js';
import { bodyRadiusFromScore, CONFIG } from '../../shared/constants.js';

const POWERUP_COLORS = { 2: '#51cf66', 5: '#ff6b6b', 10: '#ffd43b', magnet: '#4dabf7', speed: '#ff922b', zoom: '#cc5de8' };
const NAME_FONT = '600 13px -apple-system, Segoe UI, sans-serif';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.lowGraphics = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._foodSprites = new Map();
    this._buildFoodSprites();
    this._frame = 0;

    this._screenBuf = new Float32Array(8192);
    this._drawOrder = [];      // reusable array for snake draw ordering

    // Cached layout dimensions (updated once per frame).
    this._W = 0;
    this._H = 0;
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  toggleLowGraphics() { this.lowGraphics = !this.lowGraphics; }

  _buildFoodSprites() {
    const size = 24;
    const colors = [...FOOD_COLORS, FOOD_DEATH_COLOR];
    for (let ci = 0; ci < colors.length; ci++) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const cx = size / 2, r = size / 2;
      const grad = g.createRadialGradient(cx, cx, 0, cx, cx, r);
      const col = colors[ci];
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cx, r, 0, Math.PI * 2);
      g.fill();
      this._foodSprites.set(ci, c);
    }
  }

  draw(state, cam, deathAlpha, eatParticles) {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    this._W = W;
    this._H = H;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    this._drawGrid(ctx, cam, W, H);
    this._drawWorldBorder(ctx, cam, W, H);
    this._drawFood(ctx, state, cam);
    this._drawPowerups(ctx, state, cam);
    this._drawSnakes(ctx, state, cam);
    this._drawVignette(ctx, W, H);

    // Eat particles — food flying toward the player's head.
    if (eatParticles && eatParticles.length) {
      const scale = cam.zoom;
      const halfW = W * 0.5, halfH = H * 0.5;
      const camX = cam.x, camY = cam.y;
      const nowMs = performance.now();
      const colors = FOOD_COLORS;
      for (const p of eatParticles) {
        const t = Math.min((nowMs - p.born) / p.dur, 1);
        const alpha = 1 - t * t;
        const px = (p.x - camX) * scale + halfW;
        const py = (p.y - camY) * scale + halfH;
        const r = Math.max(1.5, 4 * scale * (1 - t));
        const col = p.colorIdx < colors.length ? colors[p.colorIdx] : '#fff';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Death fade overlay.
    if (deathAlpha > 0.005) {
      ctx.fillStyle = `rgba(0,0,0,${deathAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    this._frame++;
  }

  _drawVignette(ctx, W, H) {
    if (this.lowGraphics) return;
    if (!this._vignette) {
      const v = document.createElement('canvas');
      v.width = 256; v.height = 256;
      const g = v.getContext('2d');
      const grad = g.createRadialGradient(128, 128, 60, 128, 128, 150);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      this._vignette = v;
    }
    ctx.drawImage(this._vignette, 0, 0, W, H);
  }

  _drawGrid(ctx, cam, W, H) {
    if (this.lowGraphics) return;
    const step = 100;
    const vb = cam.viewBounds();
    const startX = Math.floor(vb.minX / step) * step;
    const startY = Math.floor(vb.minY / step) * step;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,160,210,0.06)';
    const halfW = W * 0.5, halfH = H * 0.5;
    const zoom = cam.zoom;
    ctx.beginPath();
    for (let x = startX; x <= vb.maxX; x += step) {
      const sx = (x - cam.x) * zoom + halfW;
      ctx.moveTo(sx, (vb.minY - cam.y) * zoom + halfH);
      ctx.lineTo(sx, (vb.maxY - cam.y) * zoom + halfH);
    }
    for (let y = startY; y <= vb.maxY; y += step) {
      const sy = (y - cam.y) * zoom + halfH;
      ctx.moveTo((vb.minX - cam.x) * zoom + halfW, sy);
      ctx.lineTo((vb.maxX - cam.x) * zoom + halfW, sy);
    }
    ctx.stroke();
  }

  _drawWorldBorder(ctx, cam, W, H) {
    const r = CONFIG.WORLD_RADIUS;
    const zoom = cam.zoom;
    const cx = (0 - cam.x) * zoom + W * 0.5;
    const cy = (0 - cam.y) * zoom + H * 0.5;
    const rad = r * zoom;
    ctx.strokeStyle = 'rgba(255,120,120,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    if (!this.lowGraphics) {
      ctx.fillStyle = 'rgba(255,120,120,0.04)';
      ctx.fill();
    }
  }

  _drawFood(ctx, state, cam) {
    const sprites = this._foodSprites;
    const scale = cam.zoom;
    const fallback = sprites.get(FOOD_COLORS.length);
    const pulse = 1 + Math.sin(this._frame * 0.08) * 0.06;
    const halfW = this._W * 0.5, halfH = this._H * 0.5;
    const camX = cam.x, camY = cam.y;
    const vb = cam.viewBounds();
    const pad = this.lowGraphics ? 20 : 30;

    if (this.lowGraphics) {
      for (const f of state.food.values()) {
        if (f.colorIdx < FOOD_COLORS.length) continue;
        if (f.x < vb.minX - pad || f.x > vb.maxX + pad || f.y < vb.minY - pad || f.y > vb.maxY + pad) continue;
        const r = Math.max(2, f.size * scale);
        ctx.fillStyle = FOOD_DEATH_COLOR;
        ctx.beginPath();
        ctx.arc((f.x - camX) * scale + halfW, (f.y - camY) * scale + halfH, r, 0, 6.2832);
        ctx.fill();
      }
      return;
    }

    // Normal mode: sprites with viewport culling
    for (const f of state.food.values()) {
      if (f.x < vb.minX - pad || f.x > vb.maxX + pad || f.y < vb.minY - pad || f.y > vb.maxY + pad) continue;
      const sprite = sprites.get(f.colorIdx) || fallback;
      if (!sprite) continue;
      const s = (f.size / 5) * 12 * scale * pulse;
      const px = (f.x - camX) * scale + halfW;
      const py = (f.y - camY) * scale + halfH;
      ctx.drawImage(sprite, px - s, py - s, s * 2, s * 2);
    }
  }

  _drawPowerups(ctx, state, cam) {
    if (!state.powerups) return;
    const scale = cam.zoom;
    const halfW = this._W * 0.5, halfH = this._H * 0.5;
    const camX = cam.x, camY = cam.y;
    const colors = POWERUP_COLORS;

    for (const pup of state.powerups.values()) {
      const px = (pup.x - camX) * scale + halfW;
      const py = (pup.y - camY) * scale + halfH;
      const r = CONFIG.POWERUP_RADIUS * scale;
      const col = colors[pup.type] || colors[pup.mult] || '#fff';
      if (this.lowGraphics) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 6.2832);
        ctx.fill();
        continue;
      }
      const bob = Math.sin(this._frame * 0.06 + pup.id) * r * 0.12;
      const ppy = py + bob;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(px, ppy + r * 0.2, r * 0.85, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(px, ppy + r * 0.2, r * 0.78, 0, 3.1416);
      ctx.fill();
      ctx.fillRect(px - r * 0.78, ppy + r * 0.2, r * 1.56, r * 0.55);
      ctx.beginPath();
      ctx.arc(px, ppy + r * 0.75, r * 0.78, 3.1416, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(px - r * 0.18, ppy - r * 0.7, r * 0.36, r * 0.6);
      ctx.fillStyle = '#c09060';
      ctx.fillRect(px - r * 0.22, ppy - r * 0.95, r * 0.44, r * 0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(px - r * 0.25, ppy + r * 0.05, r * 0.12, r * 0.35, -0.3, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(9, r * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pup.type === 'magnet' ? 'M' : pup.type === 'speed' ? 'S' : pup.type === 'zoom' ? 'Z' : (pup.mult + 'x'), px, ppy + r * 0.35);
    }
    ctx.globalAlpha = 1;
  }

  _drawSnakes(ctx, state, cam) {
    const me = state.myId;
    const order = this._drawOrder;
    order.length = 0;
    for (const s of state.snakes.values()) {
      if (s.id !== me) order.push(s);
    }
    const mySnake = state.snakes.get(me);
    for (const s of order) this._drawSnake(ctx, s, cam, false);
    if (mySnake) this._drawSnake(ctx, mySnake, cam, true);
    order.length = 0;
  }

  _drawSnake(ctx, s, cam, isMe) {
    const pts = s.renderPts || s.points;
    const n = pts.length / 2;
    if (n < 2) return;

    const skin = SKINS[s.skin] || SKINS[0];
    const bodyR = bodyRadiusFromScore(s.score) * cam.zoom;
    const lineWidth = bodyR * 2;

    // Viewport culling.
    const halfW = (this._W * 0.5) / cam.zoom + lineWidth * 3;
    const halfH = (this._H * 0.5) / cam.zoom + lineWidth * 3;
    const camX = cam.x, camY = cam.y;
    let lo = 0, hi = n - 1;
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 2] - camX;
      const dy = pts[i * 2 + 1] - camY;
      if (dx > -halfW && dx < halfW && dy > -halfH && dy < halfH) { lo = i; break; }
      if (i === n - 1) return;
    }
    for (let i = n - 1; i >= lo; i--) {
      const dx = pts[i * 2] - camX;
      const dy = pts[i * 2 + 1] - camY;
      if (dx > -halfW && dx < halfW && dy > -halfH && dy < halfH) { hi = i; break; }
    }
    lo = lo - 2; if (lo < 0) lo = 0;
    hi = hi + 2; if (hi > n - 1) hi = n - 1;
    const count = hi - lo + 1;
    if (count < 2) return;

    const needed = count * 2;
    if (needed > this._screenBuf.length) this._screenBuf = new Float32Array(needed + 1024);
    const screen = this._screenBuf;
    const zoom = cam.zoom;
    const halfCW = this._W * 0.5, halfCH = this._H * 0.5;
    for (let i = 0; i < count; i++) {
      const pIdx = (lo + i) * 2;
      screen[i * 2] = (pts[pIdx] - camX) * zoom + halfCW;
      screen[i * 2 + 1] = (pts[pIdx + 1] - camY) * zoom + halfCH;
    }

    const isMultiColor = !this.lowGraphics && (skin.main === 'rainbow' || skin.main === 'combo');
    const skinColors = skin.colors || RAINBOW_STOPS;
    const skinMain = this.lowGraphics ? (skin.shade || skin.main) : skin.main;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (!this.lowGraphics) {
      ctx.strokeStyle = skin.shade;
      ctx.lineWidth = lineWidth + 10;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = lineWidth + 2;
    ctx.beginPath();
    ctx.moveTo(screen[0], screen[1]);
    for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
    ctx.stroke();

    if (!this.lowGraphics && bodyR > 12) {
      ctx.save();
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = Math.min(30, bodyR * 0.6);
      ctx.strokeStyle = skin.glow;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = lineWidth + 6;
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (isMultiColor) {
      const chunk = 6;
      for (let start = 0; start + 1 < count; start += chunk) {
        const end = Math.min(count - 1, start + chunk);
        ctx.strokeStyle = skinColors[(((lo + start) / chunk) | 0) % skinColors.length];
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(screen[start * 2], screen[start * 2 + 1]);
        for (let i = start + 1; i <= end; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = skinMain;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
      ctx.stroke();

      if (!this.lowGraphics) {
        ctx.strokeStyle = skin.glow;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = lineWidth * 0.32;
        ctx.beginPath();
        ctx.moveTo(screen[0], screen[1]);
        for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    const hx = screen[0], hy = screen[1];

    ctx.fillStyle = skin.head || skin.glow;
    ctx.beginPath();
    ctx.arc(hx, hy, bodyR, 0, 6.2832);
    ctx.fill();

    {
      const ang = count >= 2 ? Math.atan2(screen[1] - screen[3], screen[0] - screen[2]) : 0;
      const eo = bodyR * 0.48;
      const ef = bodyR * 0.30;
      const eyeR = bodyR * 0.34;
      const cosAng = Math.cos(ang), sinAng = Math.sin(ang);
      const cosP90 = Math.cos(ang + 1.5708), sinP90 = Math.sin(ang + 1.5708);
      const cosM90 = Math.cos(ang - 1.5708), sinM90 = Math.sin(ang - 1.5708);
      const ex1 = hx + cosAng * ef + cosP90 * eo;
      const ey1 = hy + sinAng * ef + sinP90 * eo;
      const ex2 = hx + cosAng * ef + cosM90 * eo;
      const ey2 = hy + sinAng * ef + sinM90 * eo;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, 6.2832); ctx.fill();
      const px = cosAng * eyeR * 0.4;
      const py = sinAng * eyeR * 0.4;
      ctx.fillStyle = '#0b0f14';
      ctx.beginPath(); ctx.arc(ex1 + px, ey1 + py, eyeR * 0.52, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2 + px, ey2 + py, eyeR * 0.52, 0, 6.2832); ctx.fill();
      if (!this.lowGraphics) {
        const sx = Math.cos(ang + 0.8) * eyeR * 0.25;
        const sy = Math.sin(ang + 0.8) * eyeR * 0.25;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex1 - px * 0.3 + sx, ey1 - py * 0.3 + sy, eyeR * 0.18, 0, 6.2832); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2 - px * 0.3 + sx, ey2 - py * 0.3 + sy, eyeR * 0.18, 0, 6.2832); ctx.fill();
      }
    }

    if (!this.lowGraphics) {
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.font = NAME_FONT;
      ctx.textAlign = 'center';
      ctx.fillText(s.name, hx, hy - bodyR - 10);

      if (s.invuln) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, bodyR + 4, 0, 6.2832);
        ctx.stroke();
      }
    }
  }
}

export default Renderer;
