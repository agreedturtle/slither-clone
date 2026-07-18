// ===========================================================================
// Hud.js — DOM + minimap canvas for score, FPS, ping, leaderboard, minimap.
// ===========================================================================

import { CONFIG, bodyRadiusFromScore, scoreToPoints } from '../../shared/constants.js';

export class Hud {
  constructor() {
    this.scoreVal = document.getElementById('scoreVal');
    this.fpsVal = document.getElementById('fpsVal');
    this.pingVal = document.getElementById('pingVal');
    this.lbList = document.getElementById('leaderboardList');
    this.myRank = document.getElementById('myRank');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.vignette = document.getElementById('boostVignette');
    this._mmDpr = Math.min(window.devicePixelRatio || 1, 2);
    this._sizeMinimap();
    window.addEventListener('resize', () => this._sizeMinimap());
  }

  _sizeMinimap() {
    const s = 200;
    this.minimap.width = s * this._mmDpr;
    this.minimap.height = s * this._mmDpr;
    this.mctx.setTransform(this._mmDpr, 0, 0, this._mmDpr, 0, 0);
  }

  setScore(s) { if (this.scoreVal) this.scoreVal.textContent = Math.floor(s).toLocaleString(); }
  setFps(f) { if (this.fpsVal) this.fpsVal.textContent = f; }
  setPing(p) { if (this.pingVal) this.pingVal.textContent = p; }
  setBoost(on) {}

  setLeaderboard({ entries, myRank }) {
    if (!this.lbList) return;
    let html = '';
    entries.forEach((e, i) => {
      const cls = (i + 1 === myRank) ? 'me' : '';
      html += `<li class="${cls}"><span><span class="rank">${i + 1}</span>${escapeHtml(e.name)}</span><span>${Math.floor(e.score).toLocaleString()}</span></li>`;
    });
    this.lbList.innerHTML = html;
    if (this.myRank) {
      this.myRank.textContent = myRank > 0 ? `Your rank: #${myRank}` : '';
    }
  }

  // Draw the minimap from server radar data (all alive snakes).
  // radar: [{id, x, y, score, angle, isMe}]
  drawMinimap(radar, myId) {
    const ctx = this.mctx;
    const S = 200;
    ctx.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, rad = S / 2 - 3;

    // dark background with subtle radial gradient
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, 'rgba(14,22,36,0.7)');
    grad.addColorStop(1, 'rgba(6,10,18,0.85)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();

    const scale = rad / CONFIG.WORLD_RADIUS;

    for (const s of radar) {
      const hx = cx + s.x * scale;
      const hy = cy + s.y * scale;
      const big = s.isMe || s.id === myId;

      const pts = scoreToPoints(s.score);
      const bRadius = bodyRadiusFromScore(s.score);

      // Length: map body points to minimap pixels (min 4px, max ~50px)
      const bodyLen = Math.max(4, Math.min(50, pts * 0.025));
      // Thickness: map body radius to minimap line width (min 1px, max 6px)
      const lineW = Math.max(1, Math.min(6, bRadius * 0.06));

      const tx = hx - Math.cos(s.angle) * bodyLen;
      const ty = hy - Math.sin(s.angle) * bodyLen;

      ctx.lineCap = 'round';
      ctx.lineWidth = lineW;

      if (big) {
        ctx.strokeStyle = 'rgba(110,232,74,0.9)';
      } else {
        // Greyscale: brighter = bigger score, with slight cool tint
        const t = Math.min(1, s.score / 8000);
        const base = Math.round(60 + t * 140);
        ctx.strokeStyle = `rgba(${base - 5},${base},${base + 15},0.8)`;
      }

      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // head dot — sized by body radius
      const headR = Math.max(1.5, lineW * 1.0);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(hx, hy, headR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Called by Game each frame so the minimap can draw the viewport box.
  setCameraView(viewBounds) { this._camView = viewBounds; }

  // Draw multiplier info: inline badge next to length + right-side detail panel.
  // boosters: [[mult, ticks], ...], effectiveMult: total product, magnetTicks: remaining
  drawMultiplier(effectiveMult, boosters, magnetTicks) {
    const hasMult = effectiveMult > 1;
    const hasMagnet = magnetTicks > 0;

    // Right-side detail panel
    if (!this._boostPanel) {
      this._boostPanel = document.createElement('div');
      this._boostPanel.style.cssText = 'position:fixed;display:flex;flex-direction:column;gap:6px;' +
        'pointer-events:none;z-index:20;transition:opacity 0.3s ease;opacity:0;' +
        'font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
        'top:56px;left:200px;';
      document.body.appendChild(this._boostPanel);
    }
    const BOOST_COLORS = { 2: '#6ee84a', 5: '#f87171', 10: '#fbbf24' };
    const hasAny = (boosters && boosters.length > 0) || hasMagnet;
    if (hasAny) {
      let html = '';
      if (hasMagnet) {
        const secs = Math.ceil(magnetTicks / 20);
        html += `<div style="background:rgba(8,14,26,0.82);border:1px solid rgba(34,211,238,0.35);border-radius:8px;` +
          `padding:6px 14px;display:flex;align-items:center;gap:8px;white-space:nowrap;` +
          `backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,0.3);">` +
          `<span style="color:#22d3ee;font:bold 17px Inter,sans-serif;">MAG</span>` +
          `<span style="color:#94a3b8;font:600 13px Inter,sans-serif;">${secs}s</span></div>`;
      }
      if (boosters) {
        for (const [mult, ticks] of boosters) {
          if (ticks <= 0) continue;
          const secs = Math.ceil(ticks / 20);
          const col = BOOST_COLORS[mult] || '#94a3b8';
          html += `<div style="background:rgba(8,14,26,0.82);border:1px solid ${col}33;border-radius:8px;` +
            `padding:6px 14px;display:flex;align-items:center;gap:8px;white-space:nowrap;` +
            `backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,0.3);">` +
            `<span style="color:${col};font:bold 17px Inter,sans-serif;">${mult}x</span>` +
            `<span style="color:#94a3b8;font:600 13px Inter,sans-serif;">${secs}s</span></div>`;
        }
      }
      this._boostPanel.innerHTML = html;
      this._boostPanel.style.opacity = '1';
    } else {
      this._boostPanel.style.opacity = '0';
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export default Hud;
