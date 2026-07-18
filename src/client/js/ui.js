// ===========================================================================
// ui.js — DOM screens: start menu (nickname + skin picker), death, connecting.
// Keeps the Game/Renderer ignorant of HTML details.
// ===========================================================================

import { SKINS, RAINBOW_STOPS } from '../../shared/colors.js';

export class Ui {
  constructor() {
    this.menu = document.getElementById('menu');
    this.death = document.getElementById('death');
    this.connecting = document.getElementById('connecting');
    this.hud = document.getElementById('hud');
    this.nameInput = document.getElementById('nameInput');
    this.playBtn = document.getElementById('playBtn');
    this.respawnBtn = document.getElementById('respawnBtn');
    this.menuBtn = document.getElementById('menuBtn');
    this.deathScore = document.getElementById('deathScore');
    this.deathRank = document.getElementById('deathRank');
    this.boostBtn = document.getElementById('boostBtn');

    // Skins menu
    this.skinsMenu = document.getElementById('skinsMenu');
    this.skinsBtn = document.getElementById('skinsBtn');
    this.skinsBackBtn = document.getElementById('skinsBackBtn');
    this.skinPickerFull = document.getElementById('skinPickerFull');
    this.skinPreview = document.getElementById('skinPreview');

    this.selectedSkin = 0;
    this._previewFrame = 0;
    this._previewAnimId = null;
    this._buildSkinPicker();
    this._startPreviewAnim();
  }

  _buildSkinPicker() {
    this.skinPickerFull.innerHTML = '';
    SKINS.forEach((skin, i) => {
      const sw = document.createElement('div');
      sw.className = 'skin-swatch-full' + (i === this.selectedSkin ? ' selected' : '');
      const isMulti = skin.main === 'rainbow' || skin.main === 'combo';
      if (isMulti && skin.colors) {
        sw.style.background = `linear-gradient(135deg, ${skin.colors.join(', ')})`;
      } else if (isMulti) {
        sw.style.background = `linear-gradient(135deg, ${RAINBOW_STOPS.join(', ')})`;
      } else {
        sw.style.background = `radial-gradient(circle at 35% 35%, ${skin.glow}, ${skin.main} 55%, ${skin.shade})`;
      }
      sw.title = skin.name;
      sw.dataset.idx = i;
      sw.addEventListener('click', () => this._selectSkin(i));
      this.skinPickerFull.appendChild(sw);
    });
  }

  _selectSkin(i) {
    this.selectedSkin = i;
    this.skinPickerFull.querySelectorAll('.skin-swatch-full').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.idx) === i);
    });
    this._drawPreview();
  }

  _startPreviewAnim() {
    if (this._previewAnimId) return;
    const loop = () => {
      if (this.skinsMenu && this.skinsMenu.classList.contains('hidden')) {
        this._previewAnimId = null;
        return;
      }
      this._previewFrame++;
      this._drawPreview();
      this._previewAnimId = requestAnimationFrame(loop);
    };
    this._previewAnimId = requestAnimationFrame(loop);
  }

  _drawPreview() {
    const canvas = this.skinPreview;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const skin = SKINS[this.selectedSkin] || SKINS[0];
    const isMulti = skin.main === 'rainbow' || skin.main === 'combo';
    const skinColors = skin.colors || RAINBOW_STOPS;
    const t = this._previewFrame * 0.015;

    // Animated S-curve: wave phase shifts over time so the snake wiggles
    const pts = [];
    const segs = 28;
    for (let i = 0; i < segs; i++) {
      const f = i / (segs - 1);
      // Head moves forward slowly, body follows with a traveling wave
      const wave = Math.sin(f * Math.PI * 2.5 - t * 3) * (18 + f * 8);
      const x = 20 + f * (W - 40);
      const y = H / 2 + wave;
      pts.push(x, y);
    }

    const lw = 16;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Outer dark stroke
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = lw + 3;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();

    // Main body
    if (isMulti) {
      const chunk = 5;
      for (let start = 0; start + 1 < segs; start += chunk) {
        const end = Math.min(segs - 1, start + chunk);
        ctx.strokeStyle = skinColors[(start / chunk | 0) % skinColors.length];
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(pts[start * 2], pts[start * 2 + 1]);
        for (let i = start + 1; i <= end; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = skin.main;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.stroke();

      // Highlight stripe
      ctx.strokeStyle = skin.glow;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = lw * 0.32;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Head
    const hx = pts[0], hy = pts[1];
    const headR = lw / 2 + 1;
    ctx.fillStyle = isMulti ? '#fff' : skin.glow;
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const ang = Math.atan2(pts[1] - pts[3], pts[0] - pts[2]);
    const eo = headR * 0.45, ef = headR * 0.30, eyeR = headR * 0.34;
    const ex1 = hx + Math.cos(ang) * ef + Math.cos(ang + Math.PI / 2) * eo;
    const ey1 = hy + Math.sin(ang) * ef + Math.sin(ang + Math.PI / 2) * eo;
    const ex2 = hx + Math.cos(ang) * ef + Math.cos(ang - Math.PI / 2) * eo;
    const ey2 = hy + Math.sin(ang) * ef + Math.sin(ang - Math.PI / 2) * eo;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
    const px = Math.cos(ang) * eyeR * 0.4, py = Math.sin(ang) * eyeR * 0.4;
    ctx.fillStyle = '#0b0f14';
    ctx.beginPath(); ctx.arc(ex1 + px, ey1 + py, eyeR * 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2 + px, ey2 + py, eyeR * 0.52, 0, Math.PI * 2); ctx.fill();
    const sx = Math.cos(ang + 0.8) * eyeR * 0.25, sy = Math.sin(ang + 0.8) * eyeR * 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex1 - px * 0.3 + sx, ey1 - py * 0.3 + sy, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2 - px * 0.3 + sx, ey2 - py * 0.3 + sy, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();

    // Skin name
    ctx.fillStyle = 'rgba(230,240,255,0.85)';
    ctx.font = '600 12px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(skin.name, W / 2, H - 6);
  }

  getName() {
    const v = (this.nameInput.value || '').trim();
    return v.length ? v : 'anon';
  }

  getSkin() { return this.selectedSkin; }

  showMenu() { this.menu.classList.remove('hidden'); }
  hideMenu() { this.menu.classList.add('hidden'); }

  showHud() { this.hud.classList.remove('hidden'); }
  hideHud() { this.hud.classList.add('hidden'); }

  showSkins() { this.skinsMenu.classList.remove('hidden'); this._startPreviewAnim(); }
  hideSkins() { this.skinsMenu.classList.add('hidden'); if (this._previewAnimId) { cancelAnimationFrame(this._previewAnimId); this._previewAnimId = null; } }

  showDeath(score, rank) {
    if (this.deathScore) this.deathScore.textContent = Math.floor(score).toLocaleString();
    if (this.deathRank) this.deathRank.textContent = rank > 0 ? `#${rank}` : '—';
    this.death.classList.remove('hidden');
  }
  hideDeath() { this.death.classList.add('hidden'); }

  showConnecting(msg) {
    this.connecting.querySelector('.panel').textContent = msg || 'Connecting…';
    this.connecting.classList.remove('hidden');
  }
  hideConnecting() { this.connecting.classList.add('hidden'); }
}

export default Ui;
