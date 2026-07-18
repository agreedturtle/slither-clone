// ===========================================================================
// Renderer.js — performance-first Canvas 2D drawing.
//
// Principles (from the plan):
//   - One thick rounded path stroke per snake (no per-segment circles).
//   - Food rendered from a cache of pre-rendered glow sprites (blit, not blur).
//   - Offscreen entities culled before drawing.
//   - No runtime shadowBlur on the hot path (only optionally for heads).
//   - DPR capped at 1.5 for balance.
// ===========================================================================

import { SKINS, RAINBOW_STOPS, FOOD_COLORS, FOOD_DEATH_COLOR } from '../../shared/colors.js';
import { bodyRadiusFromScore, CONFIG } from '../../shared/constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.lowGraphics = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._foodSprites = new Map();     // colorIdx -> canvas
    this._buildFoodSprites();
    this._frame = 0;

    // Reusable screen-space buffer for snake drawing (avoids per-frame alloc).
    this._screenBuf = new Float32Array(8192);
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

  // Pre-render a soft radial-gradient sprite per food color (and one for death).
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

  // ---- Per-frame draw ----
  draw(state, cam) {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;

    // Background.
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    this._drawGrid(ctx, cam, W, H);
    this._drawWorldBorder(ctx, cam, W, H);
    this._drawFood(ctx, state, cam);
    this._drawPowerups(ctx, state, cam);
    this._drawSnakes(ctx, state, cam);
    this._drawVignette(ctx, W, H);

    this._frame++;
  }

  // Soft darkening at the screen edges for depth (cached after first build).
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
    const step = 100; // world units per grid line
    const vb = cam.viewBounds();
    const startX = Math.floor(vb.minX / step) * step;
    const startY = Math.floor(vb.minY / step) * step;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,160,210,0.06)';
    ctx.beginPath();
    for (let x = startX; x <= vb.maxX; x += step) {
      const a = cam.worldToScreen(x, vb.minY);
      const b = cam.worldToScreen(x, vb.maxY);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let y = startY; y <= vb.maxY; y += step) {
      const a = cam.worldToScreen(vb.minX, y);
      const b = cam.worldToScreen(vb.maxX, y);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  _drawWorldBorder(ctx, cam, W, H) {
    const r = CONFIG.WORLD_RADIUS;
    const c = cam.worldToScreen(0, 0);
    const rad = r * cam.zoom;
    ctx.strokeStyle = 'rgba(255,120,120,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    if (!this.lowGraphics) {
      ctx.fillStyle = 'rgba(255,120,120,0.04)';
      ctx.fill();
    }
  }

  _drawFood(ctx, state, cam) {
    const sprites = this._foodSprites;
    const scale = cam.zoom;
    const fallback = sprites.get(FOOD_COLORS.length); // death-yellow sprite
    const pulse = 1 + Math.sin(this._frame * 0.08) * 0.06; // gentle global pulse

    if (this.lowGraphics) {
      // Simplified: draw plain circles, skip off-screen, skip pulse
      const vb = cam.viewBounds();
      const pad = 20;
      for (const f of state.food.values()) {
        if (f.x < vb.minX - pad || f.x > vb.maxX + pad || f.y < vb.minY - pad || f.y > vb.maxY + pad) continue;
        const p = cam.worldToScreen(f.x, f.y);
        const r = Math.max(2, (f.size / 5) * 5 * scale);
        ctx.fillStyle = FOOD_COLORS[f.colorIdx] || FOOD_DEATH_COLOR;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Normal mode: sprites with viewport culling
    const vb = cam.viewBounds();
    const pad = 30;
    for (const f of state.food.values()) {
      if (f.x < vb.minX - pad || f.x > vb.maxX + pad || f.y < vb.minY - pad || f.y > vb.maxY + pad) continue;
      const p = cam.worldToScreen(f.x, f.y);
      const s = (f.size / 5) * 12 * scale * pulse;
      const sprite = sprites.get(f.colorIdx) || fallback;
      if (!sprite) continue;
      ctx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
    }
  }

  _drawPowerups(ctx, state, cam) {
    if (!state.powerups) return;
    const scale = cam.zoom;
    const colors = { 2: '#51cf66', 5: '#ff6b6b', 10: '#ffd43b', magnet: '#4dabf7', speed: '#ff922b', zoom: '#cc5de8' };
    for (const pup of state.powerups.values()) {
      const p = cam.worldToScreen(pup.x, pup.y);
      const r = CONFIG.POWERUP_RADIUS * scale;
      const col = colors[pup.type] || colors[pup.mult] || '#fff';
      if (this.lowGraphics) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const t = this._frame * 0.06;
      const bob = Math.sin(t + pup.id) * r * 0.12;
      const py = p.y + bob;
      // bottle body (round flask)
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(p.x, py + r * 0.2, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // liquid fill (full bottle)
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(p.x, py + r * 0.2, r * 0.78, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(p.x - r * 0.78, py + r * 0.2, r * 1.56, r * 0.55);
      ctx.beginPath();
      ctx.arc(p.x, py + r * 0.75, r * 0.78, Math.PI, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
      // neck
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(p.x - r * 0.18, py - r * 0.7, r * 0.36, r * 0.6);
      // cork
      ctx.fillStyle = '#c09060';
      ctx.fillRect(p.x - r * 0.22, py - r * 0.95, r * 0.44, r * 0.3);
      // glass shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.25, py + r * 0.05, r * 0.12, r * 0.35, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // label
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(9, r * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = pup.type === 'magnet' ? 'M' : pup.type === 'speed' ? 'S' : pup.type === 'zoom' ? 'Z' : (pup.mult + 'x');
      ctx.fillText(label, p.x, py + r * 0.35);
    }
    ctx.globalAlpha = 1;
  }

  _drawSnakes(ctx, state, cam) {
    const me = state.myId;
    // Draw other snakes first, then mine on top.
    const order = [];
    for (const s of state.snakes.values()) {
      if (s.id === me) continue;
      order.push(s);
    }
    const mySnake = state.snakes.get(me);
    for (const s of order) this._drawSnake(ctx, s, cam, s.id === me);
    if (mySnake) this._drawSnake(ctx, mySnake, cam, true);
  }

  _drawSnake(ctx, s, cam, isMe) {
    // Use the smoothed render points (per-point interpolation in Game) so the
    // whole body glides smoothly. Fall back to authoritative points if absent.
    const pts = s.renderPts || s.points;
    const n = pts.length / 2;
    if (n < 2) return;

    const skin = SKINS[s.skin] || SKINS[0];
    const bodyR = bodyRadiusFromScore(s.score) * cam.zoom;
    const lineWidth = bodyR * 2;

    // Viewport culling: find the range of points on-screen to avoid
    // transforming thousands of off-screen points.
    const halfW = (ctx.canvas.clientWidth / 2) / cam.zoom + lineWidth * 3;
    const halfH = (ctx.canvas.clientHeight / 2) / cam.zoom + lineWidth * 3;
    let lo = 0, hi = n - 1;
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 2] - cam.x;
      const dy = pts[i * 2 + 1] - cam.y;
      if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) { lo = i; break; }
      if (i === n - 1) return; // nothing visible
    }
    for (let i = n - 1; i >= lo; i--) {
      const dx = pts[i * 2] - cam.x;
      const dy = pts[i * 2 + 1] - cam.y;
      if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) { hi = i; break; }
    }
    // Pad by 2 on each side for smooth line joins at the viewport edge.
    lo = Math.max(0, lo - 2);
    hi = Math.min(n - 1, hi + 2);
    const count = hi - lo + 1;
    if (count < 2) return;

    // Build only the visible portion in screen space (reuse buffer).
    const needed = count * 2;
    if (needed > this._screenBuf.length) this._screenBuf = new Float32Array(needed + 1024);
    const screen = this._screenBuf;
    for (let i = 0; i < count; i++) {
      const p = cam.worldToScreen(pts[(lo + i) * 2], pts[(lo + i) * 2 + 1]);
      screen[i * 2] = p.x;
      screen[i * 2 + 1] = p.y;
    }

    const isMultiColor = skin.main === 'rainbow' || skin.main === 'combo';
    const isSplit = skin.main === 'split';
    const skinColors = skin.colors || RAINBOW_STOPS;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Subtle body shadow (wide low-opacity stroke behind everything).
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

    // Outer dark stroke.
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = lineWidth + 2;
    ctx.beginPath();
    ctx.moveTo(screen[0], screen[1]);
    for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
    ctx.stroke();

    // Glow for bigger snakes.
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
        const col = skinColors[(((lo + start) / chunk) | 0) % skinColors.length];
        ctx.strokeStyle = col;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(screen[start * 2], screen[start * 2 + 1]);
        for (let i = start + 1; i <= end; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
        ctx.stroke();
      }
    } else if (isSplit) {
      const cols = skin.split || ['#2255CC', '#E8D44D'];
      ctx.strokeStyle = cols[0];
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
      ctx.stroke();
      ctx.strokeStyle = cols[1];
      ctx.lineWidth = lineWidth * 0.5;
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
      ctx.stroke();
    } else {
      ctx.strokeStyle = skin.main;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      for (let i = 1; i < count; i++) ctx.lineTo(screen[i * 2], screen[i * 2 + 1]);
      ctx.stroke();

      // Highlight stripe.
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

    // Head: a slightly bigger filled circle + eyes.
    const hx = screen[0], hy = screen[1];

    ctx.fillStyle = skin.head || skin.glow;
    ctx.beginPath();
    ctx.arc(hx, hy, bodyR, 0, Math.PI * 2);
    ctx.fill();

    if (!this.lowGraphics) {
      // Eyes — bigger with shine dots for a livelier look.
      const ang = count >= 2 ? Math.atan2(screen[1] - screen[3], screen[0] - screen[2]) : 0;
      const eo = bodyR * 0.48;
      const ef = bodyR * 0.30;
      const eyeR = bodyR * 0.34;
      const ex1 = hx + Math.cos(ang) * ef + Math.cos(ang + Math.PI / 2) * eo;
      const ey1 = hy + Math.sin(ang) * ef + Math.sin(ang + Math.PI / 2) * eo;
      const ex2 = hx + Math.cos(ang) * ef + Math.cos(ang - Math.PI / 2) * eo;
      const ey2 = hy + Math.sin(ang) * ef + Math.sin(ang - Math.PI / 2) * eo;
      // White sclera.
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
      // Dark pupils, offset forward.
      const px = Math.cos(ang) * eyeR * 0.4;
      const py = Math.sin(ang) * eyeR * 0.4;
      ctx.fillStyle = '#0b0f14';
      ctx.beginPath(); ctx.arc(ex1 + px, ey1 + py, eyeR * 0.52, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2 + px, ey2 + py, eyeR * 0.52, 0, Math.PI * 2); ctx.fill();
      // Shine dots — small white highlights for a lively, glossy look.
      const sx = Math.cos(ang + 0.8) * eyeR * 0.25;
      const sy = Math.sin(ang + 0.8) * eyeR * 0.25;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex1 - px * 0.3 + sx, ey1 - py * 0.3 + sy, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2 - px * 0.3 + sx, ey2 - py * 0.3 + sy, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();

      // Name label.
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.font = '600 13px -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, hx, hy - bodyR - 10);

      // Spawn-invuln outline.
      if (s.invuln) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, bodyR + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

export default Renderer;
