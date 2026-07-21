// ===========================================================================
// Game.js — client game loop, snapshot buffering, interpolation, world state.
//
// Holds the authoritative-ish client view:
//   - state.snakes: Map<id, { id, skin, score, name, points(Int16Array),
//                             boosting, invuln, prevPoints? }>
//   - state.food:   Map<id, { id, x, y, size, colorIdx, value }>
//   - state.myId
//
// Snapshot handling: we keep the latest snapshot per snake and interpolate head
// positions toward the newest sample for smoothness (the server already runs at
// 20Hz; we render at 60Hz, so we lerp the head a few frames forward along the
// last-known heading).
// ===========================================================================

import { CONFIG, zoomFromScore } from '../../shared/constants.js';

export class Game {
  constructor({ net, renderer, camera, input, hud, ui }) {
    this.net = net;
    this.renderer = renderer;
    this.camera = camera;
    this.input = input;
    this.hud = hud;
    this.ui = ui;

    this.state = {
      myId: 0,
      snakes: new Map(),
      food: new Map(),
      powerups: new Map(),   // id -> { id, x, y, mult }
      radar: [],            // all alive snakes (head x/y/score) for the minimap
      alive: false,
      score: 0,
      boosting: false,
      multiplier: 0,
      boosters: [],
      magnetTicks: 0,
      speedTicks: 0,
      zoomTicks: 0,
    };

    this.lastFrame = performance.now();
    this.fpsAcc = 0; this.fpsCount = 0; this.fps = 60;
    this.ping = 0;
    this._deathTime = 0;       // performance.now() when death occurred
    this._deathPos = null;     // {x,y} camera position at death
    this._deathScore = 0;
    this._deathRank = 0;
    this._deathScreenShown = false;
    this._deathAlpha = 0;      // 0..0.7 fade overlay

    this._eatParticles = [];   // { x, y, tx, ty, colorIdx, born, dur }

    this._bindNet();
  }

  _bindNet() {
    this.net.on('welcome', (d) => this._onWelcome(d));
    this.net.on('snapshot', (d) => this._onSnapshot(d));
    this.net.on('foodAdd', (items) => this._onFoodAdd(items));
    this.net.on('foodRemove', (ids) => this._onFoodRemove(ids));
    this.net.on('leaderboard', (d) => this.hud.setLeaderboard(d));
    this.net.on('radar', (items) => { this.state.radar = items; });
    this.net.on('death', (d) => this._onDeath(d));
    this.net.on('removeSnake', (id) => this.state.snakes.delete(id));
    this.net.on('pong', (t) => { this.ping = Math.round(performance.now() - t); });
    this.net.on('powerupAdd', (items) => {
      for (const p of items) this.state.powerups.set(p.id, p);
    });
    this.net.on('powerupRemove', (ids) => {
      for (const id of ids) this.state.powerups.delete(id);
    });
    this.net.on('close', () => this.ui.showConnecting('Disconnected. Reconnecting…'));
  }

  // ---- Net handlers ----
  _onWelcome(d) {
    this.state.myId = d.id;
    // The server sends WELCOME both on join and on respawn -> we're (re)alive.
    this.state.alive = true;
    this._deathPos = null;
    this._deathScreenShown = false;
    this._deathAlpha = 0;
    this.ui.hideMenu();
    this.ui.hideDeath();
    this.ui.showHud();
  }

  _onSnapshot(snap) {
    const now = performance.now();
    const snakes = snap.snakes;

    // Mark snakes as "seen" by setting a flag, avoid Set allocation.
    // First clear previous flags.
    for (const [, s] of this.state.snakes) s._seen = false;

    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      const prev = this.state.snakes.get(s.id);
      const newLen = s.points.length;

      let nextPts, prevPts, renderPts;
      if (prev && prev.nextPts && prev.nextPts.length === newLen) {
        // Reuse existing buffers — just copy data in with .set()
        nextPts = prev.nextPts;
        prevPts = prev.prevPts;
        renderPts = prev.renderPts;
        nextPts.set(s.points);
      } else {
        nextPts = new Float32Array(newLen);
        for (let j = 0; j < newLen; j++) nextPts[j] = s.points[j];
        if (prev && prev.renderPts && prev.renderPts.length === newLen) {
          prevPts = prev.renderPts;
          renderPts = prev.renderPts;
        } else {
          prevPts = nextPts;
          renderPts = new Float32Array(newLen);
          for (let j = 0; j < newLen; j++) renderPts[j] = nextPts[j];
        }
      }

      if (prev) {
        prev.id = s.id;
        prev.skin = s.skin;
        prev.score = s.score;
        prev.name = s.name;
        prev.prevPts = prevPts;
        prev.nextPts = nextPts;
        prev.renderPts = renderPts;
        prev.snapTime = now;
        prev.boosting = s.boosting;
        prev.invuln = s.invuln;
        prev.effectiveMultiplier = s.effectiveMultiplier;
        prev.magnetTicks = s.magnetTicks;
        prev.speedTicks = s.speedTicks;
        prev.zoomTicks = s.zoomTicks;
        prev.boosters = s.boosters;
        prev._seen = true;
      } else {
        this.state.snakes.set(s.id, {
          id: s.id, skin: s.skin, score: s.score, name: s.name,
          prevPts, nextPts, renderPts, snapTime: now,
          boosting: s.boosting, invuln: s.invuln,
          effectiveMultiplier: s.effectiveMultiplier,
          magnetTicks: s.magnetTicks, speedTicks: s.speedTicks, zoomTicks: s.zoomTicks,
          boosters: s.boosters, _seen: true,
        });
      }
    }

    // Remove snakes not in this snapshot (only when alive — when dead the
    // server centers snapshots at world origin so many snakes fall outside the
    // view and would be incorrectly purged).
    if (this.state.alive) {
      const myId = this.state.myId;
      for (const [id, s] of this.state.snakes) {
        if (!s._seen && id !== myId) this.state.snakes.delete(id);
      }
    }

    // Update my own score/alive flag.
    const me = this.state.snakes.get(this.state.myId);
    if (me) {
      this.state.score = me.score;
      this.state.boosting = me.boosting;
      this.state.multiplier = me.effectiveMultiplier || 1;
      this.state.magnetTicks = me.magnetTicks || 0;
      this.state.speedTicks = me.speedTicks || 0;
      this.state.zoomTicks = me.zoomTicks || 0;
      this.state.boosters = me.boosters || [];
      this.hud.setScore(me.score);
    }
    this.hud.setPing(this.ping);
  }

  _onFoodAdd(items) {
    for (const f of items) {
      this.state.food.set(f.id, f);
    }
  }

  _onFoodRemove(ids) {
    // Only create eat particles for food near OUR head (food we personally ate).
    const me = this.state.snakes.get(this.state.myId);
    if (this.state.alive && me && me.renderPts && me.renderPts.length >= 2) {
      const hx = me.renderPts[0], hy = me.renderPts[1];
      const eatR = (me.score > 0 ? 20 + Math.sqrt(me.score) * 0.7 : 30);
      const eatR2 = eatR * eatR;
      for (const id of ids) {
        const f = this.state.food.get(id);
        if (f) {
          const dx = f.x - hx, dy = f.y - hy;
          if (dx * dx + dy * dy < eatR2) {
            this._eatParticles.push({
              x: f.x, y: f.y, sx: f.x, sy: f.y,
              tx: hx, ty: hy,
              colorIdx: f.colorIdx, born: performance.now(), dur: 220,
            });
          }
        }
      }
    }
    for (const id of ids) this.state.food.delete(id);
  }

  _onDeath(d) {
    this.state.alive = false;
    this._deathTime = performance.now();
    this._deathPos = { x: this.camera.x, y: this.camera.y };
    this._deathScore = d.finalScore;
    this._deathRank = d.finalRank;
    this._deathScreenShown = false;
    this._deathAlpha = 0;
    // Mark snake dead but keep it visible so it doesn't just vanish.
    const me = this.state.snakes.get(this.state.myId);
    if (me) { me._dead = true; me._deadAt = performance.now(); }
  }

  // ---- Public API ----
  start() {
    this.net.connect();
    requestAnimationFrame((t) => this._loop(t));
    // Ping every second for RTT display.
    setInterval(() => {
      if (this.net.connected) this.net.ping(performance.now() >>> 0);
    }, 1000);
  }

  join(name, skin) {
    this.net.join(name, skin);
  }

  respawn() {
    // Optimistically clear my snake so the renderer waits for fresh data.
    this.state.snakes.delete(this.state.myId);
    this.net.respawn();
  }

  // ---- Main loop ----
  _loop(now) {
    const dt = Math.min(now - this.lastFrame, 50); // cap to avoid spiral on tab-switch
    this.lastFrame = now;

    // FPS smoothing.
    this.fpsAcc += dt; this.fpsCount++;
    if (this.fpsAcc >= 500) {
      this.fps = Math.round(1000 / (this.fpsAcc / this.fpsCount));
      this.fpsAcc = 0; this.fpsCount = 0;
      this.hud.setFps(this.fps);
    }

    // 1) Gather input.
    this.input.update();
    if (this.state.alive) {
      this.net.sendInput(this.input.angle, this.input.boost, this.input.autoSpin);
    }

    // 2) Interpolate body points between previous and next snapshot positions.
    const tickMs = 50; // 1000 / CONFIG.TICK_HZ
    const myId = this.state.myId;
    for (const s of this.state.snakes.values()) {
      const rp = s.renderPts;
      const pp = s.prevPts;
      const np = s.nextPts;
      if (!pp || !np) continue;
      const len = Math.min(rp.length, pp.length, np.length);
      const elapsed = now - s.snapTime;
      const maxT = s.id === myId ? 1.3 : 1.05;
      const t = Math.min(elapsed / tickMs, maxT);
      for (let i = 0; i < len; i++) {
        rp[i] = pp[i] + (np[i] - pp[i]) * t;
      }
    }

    // 3) Camera follows MY smoothed head (or freezes at death position).
    this.camera.setDt(dt);
    const meNow = this.state.snakes.get(this.state.myId);
    if (!this.state.alive && this._deathPos) {
      // Dead — camera stays at death spot, slowly zooms out.
      this.camera.follow(this._deathPos.x, this._deathPos.y);
      const elapsed = performance.now() - this._deathTime;
      const targetZoom = Math.max(0.35, this.camera._targetZoom * Math.pow(0.997, elapsed / 16));
      this.camera.setZoom(targetZoom);
      this._deathAlpha = 0;
      // Show death screen after 3-second delay.
      if (!this._deathScreenShown && performance.now() - this._deathTime >= 3000) {
        this._deathScreenShown = true;
        this.ui.showDeath(this._deathScore, this._deathRank);
      }
    } else if (meNow && meNow.renderPts.length >= 2) {
      this.camera.follow(meNow.renderPts[0], meNow.renderPts[1]);
      let zoom = zoomFromScore(meNow.score);
      if (meNow.zoomTicks > 0) zoom *= 0.5;
      this.camera.setZoom(zoom);
      this.hud.setBoost(meNow.boosting);
    }
    // else: snake not yet in map (brief moment after join), keep camera where it is.

    // 4) Advance eat particles (fly toward my head, then vanish).
    const headX = meNow && meNow.renderPts ? meNow.renderPts[0] : 0;
    const headY = meNow && meNow.renderPts ? meNow.renderPts[1] : 0;
    const nowMs = performance.now();
    const ep = this._eatParticles;
    for (let i = ep.length - 1; i >= 0; i--) {
      const p = ep[i];
      p.tx = headX; p.ty = headY;
      const t = Math.min((nowMs - p.born) / p.dur, 1);
      if (t >= 1) { ep.splice(i, 1); continue; }
      // Ease-in: accelerates toward head
      const ease = t * t;
      p.x = p.sx + (p.tx - p.sx) * ease;
      p.y = p.sy + (p.ty - p.sy) * ease;
    }

    // 5) Render.
    this.renderer.draw(this.state, this.camera, this._deathAlpha, this._eatParticles);
    this.hud.setCameraView(this.camera.viewBounds());
    this.hud.drawMinimap(this.state.radar, this.state.myId);
    this.hud.drawMultiplier(this.state.multiplier, this.state.boosters, this.state.magnetTicks, this.state.speedTicks, this.state.zoomTicks);

    requestAnimationFrame((t) => this._loop(t));
  }
}

export default Game;
