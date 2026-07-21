// ===========================================================================
// Hud.js — DOM + minimap canvas for score, FPS, ping, leaderboard, minimap.
// ===========================================================================

import { CONFIG, bodyRadiusFromScore } from '../../shared/constants.js';

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
    const s = 280;
    this.minimap.width = s * this._mmDpr;
    this.minimap.height = s * this._mmDpr;
    this.mctx.setTransform(this._mmDpr, 0, 0, this._mmDpr, 0, 0);
  }

  setScore(s) { if (this.scoreVal) this.scoreVal.textContent = Math.min(Math.floor(s), 100_000_000_000_000).toLocaleString(); }
  setFps(f) { if (this.fpsVal) this.fpsVal.textContent = f; }
  setPing(p) { if (this.pingVal) this.pingVal.textContent = p; }
  setBoost(on) {}

  setLeaderboard({ entries, myRank }) {
    if (!this.lbList) return;
    let html = '';
    entries.forEach((e, i) => {
      const cls = (i + 1 === myRank) ? 'me' : '';
      html += `<li class="${cls}"><span><span class="rank">${i + 1}</span>${escapeHtml(e.name)}</span><span>${Math.min(Math.floor(e.score), 100_000_000_000_000).toLocaleString()}</span></li>`;
    });
    this.lbList.innerHTML = html;
    if (this.myRank) {
      this.myRank.textContent = myRank > 0 ? `Your rank: #${myRank}` : '';
    }
  }

  // Draw the minimap from server radar data (all alive snakes).
  // radar: [{id, x, y, score, angle, isMe, body}]
  drawMinimap(radar, myId) {
    const ctx = this.mctx;
    const S = 280;
    ctx.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, rad = S / 2 - 3;

    // Cache the background as an offscreen canvas
    if (!this._minimapBg || this._minimapBgRad !== rad) {
      const bg = document.createElement('canvas');
      bg.width = bg.height = S;
      const bgCtx = bg.getContext('2d');
      const bcx = S / 2, bcy = S / 2;
      const grad = bgCtx.createRadialGradient(bcx, bcy, 0, bcx, bcy, rad);
      grad.addColorStop(0, 'rgba(14,22,36,0.7)');
      grad.addColorStop(1, 'rgba(6,10,18,0.85)');
      bgCtx.fillStyle = grad;
      bgCtx.beginPath(); bgCtx.arc(bcx, bcy, rad, 0, Math.PI * 2); bgCtx.fill();
      this._minimapBg = bg;
      this._minimapBgRad = rad;
    }
    ctx.drawImage(this._minimapBg, 0, 0);

    const scale = rad / CONFIG.WORLD_RADIUS;

    for (const s of radar) {
      const big = s.isMe || s.id === myId;
      const bRadius = bodyRadiusFromScore(s.score);
      const lineW = Math.max(1.5, Math.min(8, bRadius * 0.08));

      if (big) {
        ctx.strokeStyle = 'rgba(110,232,74,0.95)';
      } else {
        const t = Math.min(1, s.score / 8000);
        const base = Math.round(80 + t * 160);
        ctx.strokeStyle = `rgba(${base},${base + 5},${base + 25},0.9)`;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lineW;

      const body = s.body;
      if (body && body.length > 1) {
        const bx0 = cx + body[0].x * scale;
        const by0 = cy + body[0].y * scale;
        ctx.beginPath();
        ctx.moveTo(bx0, by0);
        if (body.length === 2) {
          ctx.lineTo(cx + body[1].x * scale, cy + body[1].y * scale);
        } else {
          for (let i = 1; i < body.length - 1; i++) {
            const mx = (cx + body[i].x * scale + cx + body[i + 1].x * scale) / 2;
            const my = (cy + body[i].y * scale + cy + body[i + 1].y * scale) / 2;
            ctx.quadraticCurveTo(cx + body[i].x * scale, cy + body[i].y * scale, mx, my);
          }
          const last = body[body.length - 1];
          ctx.lineTo(cx + last.x * scale, cy + last.y * scale);
        }
        ctx.stroke();
      } else {
        // Fallback: no body data, draw head dot only
        const hx = cx + s.x * scale;
        const hy = cy + s.y * scale;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(2, lineW), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Called by Game each frame so the minimap can draw the viewport box.
  setCameraView(viewBounds) { this._camView = viewBounds; }

  // Draw multiplier info: inline badge next to length + right-side detail panel.
  // boosters: [[mult, ticks], ...], effectiveMult: total product, magnetTicks: remaining
  drawMultiplier(effectiveMult, boosters, magnetTicks, speedTicks, zoomTicks) {
    const hasMult = effectiveMult > 1;
    const hasMagnet = magnetTicks > 0;
    const hasSpeed = speedTicks > 0;
    const hasZoom = zoomTicks > 0;

    if (!this._boostPanel) {
      this._boostPanel = document.createElement('div');
      this._boostPanel.style.cssText = 'position:fixed;display:flex;flex-direction:column;gap:6px;' +
        'pointer-events:none;z-index:20;transition:opacity 0.3s ease;opacity:0;' +
        'font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
        'top:56px;left:170px;';
      document.body.appendChild(this._boostPanel);
      this._lastBoostHtml = '';
    }
    const BOOST_COLORS = { 2: '#6ee84a', 4: '#f87171', 8: '#fbbf24' };
    const BOOST_DISPLAY = { 2: '2x', 4: '5x', 8: '10x' };
    const hasAny = (boosters && boosters.length > 0) || hasMagnet || hasSpeed || hasZoom;
    if (hasAny) {
      // Build a simple hash key to detect changes without comparing HTML
      const key = `${effectiveMult}|${magnetTicks}|${speedTicks}|${zoomTicks}|${boosters ? boosters.map(b => b[0]+':'+b[1]).join(',') : ''}`;
      if (key === this._lastBoostKey) return; // no change, skip DOM update
      this._lastBoostKey = key;
      let html = '';
      if (hasMagnet) {
        const secs = Math.ceil(magnetTicks / 20);
        html += `<div style="background:rgba(8,14,26,0.82);border:1px solid rgba(34,211,238,0.35);border-radius:8px;` +
          `padding:6px 14px;display:flex;align-items:center;gap:8px;white-space:nowrap;` +
          `backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,0.3);">` +
          `<span style="color:#22d3ee;font:bold 17px Inter,sans-serif;">MAG</span>` +
          `<span style="color:#94a3b8;font:600 13px Inter,sans-serif;">${secs}s</span></div>`;
      }
      if (hasSpeed) {
        const secs = Math.ceil(speedTicks / 20);
        html += `<div style="background:rgba(8,14,26,0.82);border:1px solid rgba(255,146,43,0.35);border-radius:8px;` +
          `padding:6px 14px;display:flex;align-items:center;gap:8px;white-space:nowrap;` +
          `backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,0.3);">` +
          `<span style="color:#ff922b;font:bold 17px Inter,sans-serif;">SPD</span>` +
          `<span style="color:#94a3b8;font:600 13px Inter,sans-serif;">${secs}s</span></div>`;
      }
      if (hasZoom) {
        const secs = Math.ceil(zoomTicks / 20);
        html += `<div style="background:rgba(8,14,26,0.82);border:1px solid rgba(204,93,232,0.35);border-radius:8px;` +
          `padding:6px 14px;display:flex;align-items:center;gap:8px;white-space:nowrap;` +
          `backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,0.3);">` +
          `<span style="color:#cc5de8;font:bold 17px Inter,sans-serif;">ZOOM</span>` +
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
            `<span style="color:${col};font:bold 17px Inter,sans-serif;">${BOOST_DISPLAY[mult] || mult + 'x'}</span>` +
            `<span style="color:#94a3b8;font:600 13px Inter,sans-serif;">${secs}s</span></div>`;
        }
      }
      this._boostPanel.innerHTML = html;
      this._boostPanel.style.opacity = '1';
    } else {
      if (this._lastBoostKey !== '') {
        this._lastBoostKey = '';
        this._boostPanel.style.opacity = '0';
      }
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export default Hud;
