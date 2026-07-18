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

    // Auth
    this.loginBtn = document.getElementById('loginBtn');
    this.profileBtn = document.getElementById('profileBtn');
    this.loginScreen = document.getElementById('loginScreen');
    this.authLoginTab = document.getElementById('authLoginTab');
    this.authRegisterTab = document.getElementById('authRegisterTab');
    this.authUsername = document.getElementById('authUsername');
    this.authPassword = document.getElementById('authPassword');
    this.authSubmitBtn = document.getElementById('authSubmitBtn');
    this.authBackBtn = document.getElementById('authBackBtn');
    this.authGuestBtn = document.getElementById('authGuestBtn');
    this.authError = document.getElementById('authError');
    this.authSuccess = document.getElementById('authSuccess');
    this.authModeLabel = document.getElementById('authModeLabel');

    // Profile
    this.profileScreen = document.getElementById('profileScreen');
    this.profileUsername = document.getElementById('profileUsername');
    this.profileHighScore = document.getElementById('profileHighScore');
    this.profileKills = document.getElementById('profileKills');
    this.profileHeadshots = document.getElementById('profileHeadshots');
    this.profileGames = document.getElementById('profileGames');
    this.profileDeaths = document.getElementById('profileDeaths');
    this.profileBackBtn = document.getElementById('profileBackBtn');
    this.profileLogoutBtn = document.getElementById('profileLogoutBtn');

    // All-time leaderboard
    this.alltimeScreen = document.getElementById('alltimeScreen');
    this.alltimeBtn = document.getElementById('alltimeBtn');
    this.alltimeBackBtn = document.getElementById('alltimeBackBtn');
    this.alltimeList = document.getElementById('alltimeList');

    this.selectedSkin = 0;
    this._previewFrame = 0;
    this._previewAnimId = null;
    this._wormFrame = 0;
    this._wormAnimId = null;
    this._buildSkinPicker();
    this._startPreviewAnim();
    this._startWormAnim();
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
    ctx.fillStyle = isMulti ? '#fff' : (skin.head || skin.glow);
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

  // ---- Auth ----
  showLoginScreen() {
    this.loginScreen.classList.remove('hidden');
    this.authError.classList.add('hidden');
    this.authSuccess.classList.add('hidden');
    this.authUsername.value = '';
    this.authPassword.value = '';
  }
  hideLoginScreen() { this.loginScreen.classList.add('hidden'); }

  showProfile() { this.profileScreen.classList.remove('hidden'); }
  hideProfile() { this.profileScreen.classList.add('hidden'); }

  setAuthMode(mode) {
    this.authLoginTab.classList.toggle('active', mode === 'login');
    this.authRegisterTab.classList.toggle('active', mode === 'register');
    this.authSubmitBtn.textContent = mode === 'login' ? 'Login' : 'Register';
    this.authModeLabel.textContent = mode === 'login' ? 'Log in to track stats' : 'Create an account';
    this.authError.classList.add('hidden');
    this.authSuccess.classList.add('hidden');
  }

  showAuthError(msg) {
    this.authError.textContent = msg;
    this.authError.classList.remove('hidden');
    this.authSuccess.classList.add('hidden');
  }

  showAuthSuccess(msg) {
    this.authSuccess.textContent = msg;
    this.authSuccess.classList.remove('hidden');
    this.authError.classList.add('hidden');
  }

  showLoggedIn(username) {
    this.loginBtn.classList.add('hidden');
    this.profileBtn.classList.remove('hidden');
    this.profileBtn.textContent = username;
  }

  showLoggedOut() {
    this.loginBtn.classList.remove('hidden');
    this.profileBtn.classList.add('hidden');
  }

  updateProfile(d) {
    if (this.profileUsername) this.profileUsername.textContent = d.username || '—';
    if (this.profileHighScore) this.profileHighScore.textContent = (d.highScore || 0).toLocaleString();
    if (this.profileKills) this.profileKills.textContent = (d.totalKills || 0).toLocaleString();
    if (this.profileHeadshots) this.profileHeadshots.textContent = (d.headshots || 0).toLocaleString();
    if (this.profileGames) this.profileGames.textContent = (d.gamesPlayed || 0).toLocaleString();
    if (this.profileDeaths) this.profileDeaths.textContent = (d.deaths || 0).toLocaleString();
  }

  // ---- All-time leaderboard ----
  showAlltime() { this.alltimeScreen.classList.remove('hidden'); }
  hideAlltime() { this.alltimeScreen.classList.add('hidden'); }

  updateAlltime(entries, sortBy, myName) {
    if (!this.alltimeList) return;
    if (!entries || entries.length === 0) {
      this.alltimeList.innerHTML = '<div class="alltime-empty">No players yet</div>';
      return;
    }
    const sorted = sortBy === 'kills'
      ? [...entries].sort((a, b) => b.totalKills - a.totalKills)
      : [...entries].sort((a, b) => b.highScore - a.highScore);

    this.alltimeList.innerHTML = '';
    sorted.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'alltime-row' + (e.name === myName ? ' me' : '');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const val = sortBy === 'kills' ? e.totalKills.toLocaleString() : e.highScore.toLocaleString();
      const extra = sortBy === 'kills'
        ? `<span class="alltime-val headshots">${e.headshots || 0} HS</span>`
        : `<span class="alltime-val kills">${e.totalKills || 0} kills</span>`;
      row.innerHTML = `
        <span class="alltime-rank">${medal || (i + 1)}</span>
        <span class="alltime-name">${this._esc(e.name)}</span>
        <span class="alltime-val">${val}</span>
        ${extra}
      `;
      this.alltimeList.appendChild(row);
    });
  }

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- Menu worm animation ----
  _startWormAnim() {
    const canvas = document.getElementById('wormCanvas');
    if (!canvas) return;
    const loop = () => {
      if (this.menu && this.menu.classList.contains('hidden')) {
        this._wormAnimId = null;
        return;
      }
      this._wormFrame++;
      this._drawWorm(canvas);
      this._wormAnimId = requestAnimationFrame(loop);
    };
    this._wormAnimId = requestAnimationFrame(loop);
  }

  _drawWorm(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const t = this._wormFrame * 0.025;
    const segs = 30;
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const f = i / (segs - 1);
      const wave = Math.sin(f * Math.PI * 3 - t * 2.5) * (12 + f * 6);
      const x = 10 + f * (W - 20);
      const y = H / 2 + wave;
      pts.push(x, y);
    }

    const lw = 12;
    const skins = [
      { main: '#6ee84a', shade: '#3cb61e', glow: '#a0ff70' },
      { main: '#22d3ee', shade: '#0ea5e9', glow: '#67e8f9' },
      { main: '#f87171', shade: '#dc2626', glow: '#fca5a5' },
      { main: '#fbbf24', shade: '#d97706', glow: '#fde68a' },
    ];
    const skin = skins[(this._wormFrame / 120 | 0) % skins.length];

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = lw + 3;
    ctx.beginPath();
    ctx.moveTo(pts[0] + 2, pts[1] + 3);
    for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2] + 2, pts[i * 2 + 1] + 3);
    ctx.stroke();

    // Outer
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = lw + 3;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();

    // Body
    ctx.strokeStyle = skin.main;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = skin.glow;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = lw * 0.3;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < segs; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Head
    const hx = pts[0], hy = pts[1];
    const headR = lw / 2 + 1;
    ctx.fillStyle = skin.head || skin.glow;
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const ang = Math.atan2(pts[1] - pts[3], pts[0] - pts[2]);
    const eo = headR * 0.42, ef = headR * 0.3, eyeR = headR * 0.32;
    for (const side of [-1, 1]) {
      const ex = hx + Math.cos(ang) * ef + Math.cos(ang + Math.PI / 2) * eo * side;
      const ey = hy + Math.sin(ang) * ef + Math.sin(ang + Math.PI / 2) * eo * side;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
      const px = Math.cos(ang) * eyeR * 0.4, py = Math.sin(ang) * eyeR * 0.4;
      ctx.fillStyle = '#0b0f14';
      ctx.beginPath(); ctx.arc(ex + px, ey + py, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - px * 0.3, ey - py * 0.3, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export default Ui;
