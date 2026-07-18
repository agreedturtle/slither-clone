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
      multiplier: 0,        // effective multiplier (product of all active boosters)
      boosters: [],         // [[mult, ticks], ...] active booster list
    };

    this.lastFrame = performance.now();
    this.fpsAcc = 0; this.fpsCount = 0; this.fps = 60;
    this.ping = 0;
    this._deathTime = 0;       // performance.now() when death occurred
    this._deathPos = null;     // {x,y} camera position at death
    this._deathScore = 0;
    this._deathRank = 0;
    this._deathScreenShown = false;

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
    this.ui.hideMenu();
    this.ui.hideDeath();
    this.ui.showHud();
  }

  _onSnapshot(snap) {
    const now = performance.now();
    const seen = new Set();
    for (const s of snap.snakes) {
      seen.add(s.id);
      const prev = this.state.snakes.get(s.id);
      const newLen = s.points.length;

      // Convert incoming Int16Array to Float32Array to avoid quantization jitter.
      const nextPts = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) nextPts[i] = s.points[i];

      let prevPts, renderPts;
      if (prev && prev.nextPts && prev.nextPts.length === newLen) {
        // Previous snapshot becomes the "from" state; current becomes "to".
        prevPts = prev.nextPts;
        renderPts = prev.renderPts;
      } else {
        // First sighting or length changed — snap directly to new position.
        prevPts = nextPts;
        renderPts = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) renderPts[i] = nextPts[i];
      }

      const entry = {
        id: s.id,
        skin: s.skin,
        score: s.score,
        name: s.name,
        prevPts,
        nextPts,
        renderPts,
        snapTime: now,
        boosting: s.boosting,
        invuln: s.invuln,
        effectiveMultiplier: s.effectiveMultiplier,
        magnetTicks: s.magnetTicks,
        boosters: s.boosters,
      };
      this.state.snakes.set(s.id, entry);
    }
    // Remove snakes not in this snapshot (left view or died) except keep my own
    // briefly so rendering doesn't pop.
    for (const id of Array.from(this.state.snakes.keys())) {
      if (!seen.has(id) && id !== this.state.myId) this.state.snakes.delete(id);
    }

    // Update my own score/alive flag.
    const me = this.state.snakes.get(this.state.myId);
    if (me) {
      this.state.score = me.score;
      this.state.boosting = me.boosting;
      this.state.multiplier = me.effectiveMultiplier || 1;
      this.state.magnetTicks = me.magnetTicks || 0;
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
    for (const id of ids) this.state.food.delete(id);
  }

  _onDeath(d) {
    this.state.alive = false;
    this._deathTime = performance.now();
    this._deathPos = { x: this.camera.x, y: this.camera.y };
    this._deathScore = d.finalScore;
    this._deathRank = d.finalRank;
    this._deathScreenShown = false;
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
    //    This eliminates jitter from integer-quantized server coordinates.
    const tickMs = 1000 / CONFIG.TICK_HZ; // 50ms at 20Hz
    const me = this.state.snakes.get(this.state.myId);
    for (const s of this.state.snakes.values()) {
      const rp = s.renderPts;
      const pp = s.prevPts;
      const np = s.nextPts;
      if (!pp || !np) continue;
      const n = Math.min(rp.length, pp.length, np.length);

      const elapsed = now - s.snapTime;
      const isMe = s.id === this.state.myId;
      const maxT = isMe ? 1.3 : 1.05;
      const t = Math.min(elapsed / tickMs, maxT);

      for (let i = 0; i < n; i++) {
        rp[i] = pp[i] + (np[i] - pp[i]) * t;
      }
    }

    // 3) Camera follows MY smoothed head (or freezes at death position).
    this.camera.setDt(dt);
    if (me && me.renderPts.length >= 2) {
      this.camera.follow(me.renderPts[0], me.renderPts[1]);
      this.camera.setZoom(zoomFromScore(me.score));
      this.hud.setBoost(me.boosting);
    } else if (!this.state.alive && this._deathPos) {
      // Dead — hold camera at the death spot so the world stays visible.
      this.camera.follow(this._deathPos.x, this._deathPos.y);
      // Freeze zoom — don't call setZoom so it stays at last value.
      // Show death screen after 3-second delay.
      if (!this._deathScreenShown && performance.now() - this._deathTime >= 3000) {
        this._deathScreenShown = true;
        this.ui.showDeath(this._deathScore, this._deathRank);
      }
    } else {
      this.camera.follow(0, 0);
      this.camera.setZoom(1.45);
      this.hud.setBoost(false);
    }

    // 4) Render.
    this.renderer.draw(this.state, this.camera);
    this.hud.setCameraView(this.camera.viewBounds());
    this.hud.drawMinimap(this.state.radar, this.state.myId);
    this.hud.drawMultiplier(this.state.multiplier, this.state.boosters, this.state.magnetTicks);

    requestAnimationFrame((t) => this._loop(t));
  }
}

export default Game;
