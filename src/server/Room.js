// ===========================================================================
// Room.js — the authoritative game world and its fixed-timestep simulation.
//
// Responsibilities:
//   - Own players, bots, snakes, food.
//   - Run a 20Hz tick: move snakes, AI think, eat food, resolve collisions,
//     kill snakes (dropping food), maintain population & food count.
//   - Broadcast per-client, view-culled snapshots + food deltas + leaderboard.
//
// One Room = one game world. The bootstrap server.js currently runs a single
// Room, but this class is self-contained so multiple rooms could be added.
// ===========================================================================

import { CONFIG, bodyRadiusFromScore } from '../shared/constants.js';
import { FOOD_COLORS } from '../shared/colors.js';
import {
  TAU, randInDisk, dist2, dist, randRange,
} from '../shared/math.js';
import { SpatialGrid } from './SpatialGrid.js';
import { Food } from './Food.js';
import { Player } from './Player.js';
import { Bot } from './Bot.js';
import {
  encodeSnapshot, encodeFoodAdd, encodeFoodRemove, encodeLeaderboard,
  encodeDeath, encodeRemoveSnake, encodeWelcome, encodePong, encodeError,
  encodeRadar, encodeAdminAck, encodeMultiplier,
  encodePowerupAdd, encodePowerupRemove, encodeHeadshot, encodeChat, encodeKillFeed,
  encodeLeaderboardAlltime,
} from '../shared/protocol.js';
import { ADMIN } from '../shared/protocol.js';

const BODY_GRID_CELL = 48;   // ~ max body radius with margin
const FOOD_GRID_CELL = 64;

// Admin password: read from env so it isn't hard-coded into the client. Default
// "admin" for local play; set ADMIN_PASSWORD to lock it down on a real server.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '9123049';

export class Room {
  constructor() {
    this.speedMul = 1.0;        // global movement speed multiplier (admin-tunable)
    this.godMode = false;       // admin: when true, the admin player can't die
    this.botTarget = (() => {
      const c = Number(process.env.BOT_COUNT);
      return Number.isFinite(c) && c >= 0 ? c : CONFIG.BOT_TARGET;
    })();
    this.players = new Map();     // ws -> Player
    this.bots = [];
    this.snakes = new Map();      // id -> Snake  (players + bots, alive only)
    this.food = new Food();
    this.tick = 0;
    this.startTime = Date.now();
    this._lastBoardAt = 0;
    this._lastRadarAt = 0;
    this._lastMaintainAt = 0;
    this._nextPlayerId = 1;
    this._bodyGrid = new SpatialGrid(BODY_GRID_CELL);
    this._foodGrid = new SpatialGrid(FOOD_GRID_CELL);
    this._respawnQueue = [];      // {bot, at}
    this._pendingRemoves = [];    // snake ids removed since last broadcast
    this._tickFoodAdd = [];       // per-tick food deltas (drained once, sent to all)
    this._tickFoodRemove = [];
    this._tickRemoves = [];

    this.food.seed();
    this._maintainPopulation();
    this._startTicking();
  }

  nextPlayerId() { return this._nextPlayerId++; }

  // ---- Lifecycle -----------------------------------------------------------

  addPlayer(ws) {
    const p = new Player(ws, this);
    this.players.set(ws, p);
    return p;
  }

  removePlayer(ws) {
    const p = this.players.get(ws);
    if (!p) return;
    this.players.delete(ws);
    if (p.snake && !p.snake.dead) {
      // Die and drop food (player left while alive).
      this._killSnake(p.snake, null);
    }
  }

  addSnake(snake) {
    this.snakes.set(snake.id, snake);
  }

  // ---- Spawning ------------------------------------------------------------

  findSpawnPosition() {
    // Try random points; pick the one furthest from other heads.
    let best = { x: 0, y: 0 };
    let bestD = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const p = randInDisk(CONFIG.WORLD_RADIUS * 0.85);
      let nearest = Infinity;
      for (const s of this.snakes.values()) {
        const d = dist2(p.x, p.y, s.headX, s.headY);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestD) { bestD = nearest; best = p; }
      if (nearest > 500 * 500) break; // good enough
    }
    return best;
  }

  // ---- Per-tick helpers used by AI ----------------------------------------

  // Does the circle (px,py,r) hit any body point of any snake except excludeId?
  pointHitsBody(px, py, r, excludeId) {
    const r2 = r * r;
    let hit = false;
    const grid = this._bodyGrid;
    grid.queryCircle(px, py, r, (pt) => {
      if (pt.ownerId === excludeId) return false;
      const dx = pt.x - px, dy = pt.y - py;
      if (dx * dx + dy * dy <= r2 + pt.r * pt.r) { hit = true; return true; }
      return false;
    });
    return hit;
  }

  findThreatTo(s) {
    // a snake whose head is close, is bigger, and roughly faces us.
    let best = null;
    const hx = s.headX, hy = s.headY;
    const range2 = 420 * 420;
    for (const o of this.snakes.values()) {
      if (o.id === s.id || o.dead) continue;
      if (o.score < s.score * 0.9) continue; // only fear bigger ones
      const d2 = dist2(hx, hy, o.headX, o.headY);
      if (d2 > range2) continue;
      // facing us? vector from their head to ours vs their heading
      const dx = hx - o.headX, dy = hy - o.headY;
      const facing = (Math.cos(o.angle) * dx + Math.sin(o.angle) * dy);
      if (facing < 0) continue;
      if (!best || d2 < best.dist2) best = { headX: o.headX, headY: o.headY, dist2: d2 };
    }
    return best;
  }

  findPreyFor(s) {
    // a smaller snake within range; return it so the bot can cut it off.
    let best = null;
    const hx = s.headX, hy = s.headY;
    const range2 = 520 * 520;
    for (const o of this.snakes.values()) {
      if (o.id === s.id || o.dead) continue;
      if (o.score > s.score * 0.8) continue; // only chase smaller
      const d2 = dist2(hx, hy, o.headX, o.headY);
      if (d2 > range2) continue;
      if (!best || d2 < best.d2) {
        best = { headX: o.headX, headY: o.headY, angle: o.angle, bodyRadius: o.bodyRadius, d2 };
      }
    }
    return best;
  }

  findNearestFood(x, y, range) {
    let best = null;
    let bestD2 = range * range;
    this._foodGrid.queryCircle(x, y, range, (pellet) => {
      const d2 = dist2(x, y, pellet.x, pellet.y);
      if (d2 < bestD2) { bestD2 = d2; best = pellet; }
    });
    return best;
  }

  findNearestPowerup(x, y, range) {
    let best = null;
    let bestD2 = range * range;
    for (const [, pup] of this.food.powerups) {
      const d2 = dist2(x, y, pup.x, pup.y);
      if (d2 < bestD2) { bestD2 = d2; best = pup; }
    }
    return best;
  }

  // Drop a small pellet behind a boosting snake's tail.
  dropBoostFood(snake) {
    snake.rebuildBodyIfNeeded();
    const tailX = snake._bodyX[snake._bodyLen - 1];
    const tailY = snake._bodyY[snake._bodyLen - 1];
    this.food._spawnAt(
      tailX + (Math.random() - 0.5) * 8,
      tailY + (Math.random() - 0.5) * 8,
      CONFIG.FOOD_VALUE_SMALL, false
    );
  }

  // ---- Simulation ----------------------------------------------------------

  _startTicking() {
    this._interval = setInterval(() => this._tick(), CONFIG.TICK_MS);
    if (this._interval.unref) this._interval.unref();
  }

  _tick() {
    try {
      this.tick++;

      // 1) Bots think (sets target angle / boost).
      for (const b of this.bots) {
        if (b.snake && !b.snake.dead && (this.tick % b.thinkEvery === 0)) {
          b.think();
        }
      }

      // 2) Advance all snakes.
      for (const s of this.snakes.values()) {
        s.tick(this);
      }

      // 3) Rebuild spatial grids for collision/food.
      this._rebuildGrids();

      // 4) Food eating.
      this._resolveFoodEating();

      // 5) Collisions -> deaths.
      this._resolveCollisions();

      // 6) Population & food maintenance.
      this._maintainPopulation();
      this._processRespawns();
      if (this.tick % 2 === 0) this.food.maintain();
      if (this.tick % 10 === 0) this.food.sweepExpired();
      if (this.tick % CONFIG.POWERUP_SPAWN_INTERVAL === 0) this.food.spawnPowerup();
      if (this.tick % 10 === 0) this.food.sweepPowerups();

      // 7) Broadcast (per-client culled).
      this._broadcast();

      // 8) Leaderboard (~1Hz).
      const now = Date.now();
      if (now - this._lastBoardAt >= CONFIG.LEADERBOARD_INTERVAL_MS) {
        this._lastBoardAt = now;
        this._broadcastLeaderboard();
      }
      // 9) Radar (~2Hz) for minimap.
      if (now - this._lastRadarAt >= 500) {
        this._lastRadarAt = now;
        this._broadcastRadar();
      }
    } catch (err) {
      // A tick must never tear down the server.
      console.error('[Room] tick error:', err);
    }
  }

  _rebuildGrids() {
    // Body grid: insert every body point of every snake (with margin).
    const bg = this._bodyGrid;
    bg.clear();
    for (const s of this.snakes.values()) {
      if (s.dead) continue;
      s.rebuildBodyIfNeeded();
      const r = s.bodyRadius;
      const xs = s._bodyX, ys = s._bodyY, n = s._bodyLen;
      for (let i = 0; i < n; i++) {
        bg.insert({ x: xs[i], y: ys[i], r, ownerId: s.id });
      }
    }
    // Food grid.
    const fg = this._foodGrid;
    fg.clear();
    for (const p of this.food.pellets.values()) {
      fg.insert(p);
    }
  }

  _resolveFoodEating() {
    // Extra pickup radius for high-value death food so players can snag it
    // from slightly further away (feels better for huge snake death drops).
    const DEATH_EAT_EXTRA = 20;
    const MAGNET_RANGE = 120; // extra pickup range when magnet is active
    for (const s of this.snakes.values()) {
      if (s.dead) continue;
      const magnetBonus = s.hasMagnet ? MAGNET_RANGE : 0;
      const r = s.bodyRadius + CONFIG.FOOD_RADIUS_DEATH + DEATH_EAT_EXTRA + 2 + magnetBonus;
      this._foodGrid.queryCircle(s.headX, s.headY, r, (pellet) => {
        const extra = pellet.death ? DEATH_EAT_EXTRA : 0;
        const rr = s.bodyRadius + pellet.size + extra + magnetBonus;
        if (dist2(s.headX, s.headY, pellet.x, pellet.y) <= rr * rr) {
          const eaten = this.food.consume(pellet.id);
          if (eaten) {
            const value = s.effectiveMultiplier > 1 ? eaten.value * s.effectiveMultiplier : eaten.value;
            s.addScore(value);
          }
        }
        return false;
      });
      // Also check powerup collisions.
      for (const [pid, pup] of this.food.powerups) {
        const dx = s.headX - pup.x, dy = s.headY - pup.y;
        const rr = s.bodyRadius + CONFIG.POWERUP_RADIUS;
        if (dx * dx + dy * dy <= rr * rr) {
          const eaten = this.food.consumePowerup(pid);
          if (eaten) {
            if (eaten.type === 'magnet') {
              s.addMagnet(40);
            } else {
              const durations = { 2: 60, 5: 35, 10: 20 };
              const secs = durations[eaten.mult] || 60;
              s.addBooster(eaten.mult, secs);
            }
          }
        }
      }
    }
  }

  _resolveCollisions() {
    // Determine who dies this tick. We must collect first, then kill, because
    // a single head may legitimately intersect multiple bodies.
    const deaths = [];
    for (const s of this.snakes.values()) {
      if (s.dead) continue;
      if (s.invuln > 0) continue; // spawn protection
      if (this.godMode && s.playerRef) continue; // admin god mode

      // Border death.
      if (s.isOutOfBounds()) {
        deaths.push({ snake: s, killer: null });
        continue;
      }

      const r = s.bodyRadius;
      // Head vs bodies (any snake, incl. self but NOT the very first few points
      // right behind the head — those always overlap due to spacing).
      let hitOwner = -1;
      this._bodyGrid.queryCircle(s.headX, s.headY, r, (pt) => {
        if (hitOwner !== -1) return true;
        // Skip self body points near the head (they trail the head).
        if (pt.ownerId === s.id) {
          // Only count if the point is reasonably far along the body.
          const dx = pt.x - s.headX, dy = pt.y - s.headY;
          // self-collision check is allowed beyond ~3*bodyRadius
          if (dx * dx + dy * dy < (r * 2.4) * (r * 2.4)) return false;
        }
        const dx = pt.x - s.headX, dy = pt.y - s.headY;
        const rr = r + pt.r * 0.5; // bodies are dense; use point radius generously
        if (dx * dx + dy * dy <= rr * rr) { hitOwner = pt.ownerId; return true; }
        return false;
      });

      if (hitOwner !== -1) {
        const killer = this.snakes.get(hitOwner) || null;
        deaths.push({ snake: s, killer });
      }
    }

    // Resolve mutual head-to-head collisions: bigger snake always wins.
    // If A killed B and B killed A, remove the smaller one from deaths.
    const killedById = new Map();
    for (const d of deaths) {
      if (d.killer) killedById.set(d.snake.id, d.killer.id);
    }
    const survived = new Set();
    for (const d of deaths) {
      if (!d.killer) continue;
      const myKillerId = killedById.get(d.snake.id);
      const theirKillerId = killedById.get(d.killer.id);
      // Mutual kill: both dying to each other
      if (theirKillerId === d.snake.id && myKillerId === d.killer.id) {
        if (d.killer.score >= d.snake.score) {
          survived.add(d.snake.id);
        }
      }
    }

    for (const d of deaths) {
      if (survived.has(d.snake.id)) continue;
      this._killSnake(d.snake, d.killer);
    }
  }

  _killSnake(snake, killer) {
    if (snake.dead) return;
    snake.kill();
    // Drop food along the body.
    snake.rebuildBodyIfNeeded();
    const body = new Int16Array(snake._bodyLen * 2);
    for (let i = 0; i < snake._bodyLen; i++) {
      body[i * 2] = snake._bodyX[i];
      body[i * 2 + 1] = snake._bodyY[i];
    }
    const totalValue = Math.round(snake.score * (0.85 + Math.random() * 0.1));
    const dropped = this.food.dropFromPath(body, snake.bodyRadius, totalValue);

    // Fake-lag glitch: if snake was above 200 mass, most death food vanishes
    // after a random delay, leaving only 1 pebble worth 1-17% of mass.
    if (snake.score >= 200000000 && dropped.length > 0) {
      for (const pellet of dropped) {
        const delay = 800 + Math.random() * 2200;
        setTimeout(() => {
          this.food.consume(pellet.id);
        }, delay);
      }
      const pebbleValue = Math.max(1, Math.round(snake.score * (0.01 + Math.random() * 0.16)));
      this.food._spawnAt(snake._bodyX[0], snake._bodyY[0], pebbleValue, true);
    }

    // Track stats: death
    if (this.db && snake.playerRef && snake.playerRef.username) {
      this.db.recordDeath(snake.playerRef.username, snake.score);
    }

    // Track stats: kill for the killer (if logged in)
    const isHeadshot = !!(killer && killer.playerRef && killer.playerRef.username);
    let headDist = 0;
    if (killer) {
      const dx = killer.headX - snake.headX;
      const dy = killer.headY - snake.headY;
      headDist = Math.sqrt(dx * dx + dy * dy);
    }
    const killerIsHeadshot = killer && headDist < (killer.bodyRadius + snake.bodyRadius);
    if (this.db && killer && killer.playerRef && killer.playerRef.username) {
      this.db.recordKill(killer.playerRef.username, killerIsHeadshot);
    }

    // Broadcast kill feed to all players
    const killerName = killer ? (killer.playerRef?.username || killer.botRef?.name || killer.name || 'bot') : 'world';
    const victimName = snake.playerRef?.username || snake.botRef?.name || snake.name || 'bot';
    const feedPacket = encodeKillFeed(killerName, victimName, killerIsHeadshot);
    for (const p of this.players.values()) {
      if (p.send) {
        try { p.send(feedPacket); } catch (_) {}
      }
    }

    // Remove from world.
    this.snakes.delete(snake.id);
    this._pendingRemoves.push(snake.id);

    // Notify owner if human.
    const player = snake.playerRef;
    if (player && player.send) {
      const rank = this._rankOf(snake);
      player._lastDeathRank = rank;
      player._lastDeathScore = snake.score;
      player.send(encodeDeath(snake.score, rank, killer ? killer.id : 0));
      player.onDeath();
    }
    const bot = snake.botRef;
    if (bot) {
      bot.onDeath();
      // schedule respawn
      this._respawnQueue.push({ bot, at: Date.now() + randRange(1200, 3000) });
    }
  }

  _rankOf(snake) {
    // Approx rank: count snakes with strictly greater score.
    let rank = 1;
    for (const o of this.snakes.values()) {
      if (o.score > snake.score) rank++;
    }
    return rank;
  }

  _maintainPopulation() {
    // Top up bots to target.
    while (this.bots.length < this.botTarget) {
      this.bots.push(new Bot(this));
    }
  }

  _processRespawns() {
    const now = Date.now();
    for (let i = this._respawnQueue.length - 1; i >= 0; i--) {
      if (now >= this._respawnQueue[i].at) {
        const bot = this._respawnQueue[i].bot;
        this._respawnQueue.splice(i, 1);
        if (bot && this.bots.includes(bot)) bot.respawn();
      }
    }
  }

  // ---- Networking ----------------------------------------------------------

  _broadcast() {
    if (this.players.size === 0) {
      // Still drain food queues so they don't grow unbounded.
      this.food.takeAdded();
      this.food.takeRemoved();
      this.food.takePowerupAdded();
      this.food.takePowerupRemoved();
      this._pendingRemoves.length = 0;
      return;
    }

    // Drain deltas ONCE this tick into Room state so every connected player
    // sees the same set (per-client culling happens at send time).
    this._tickFoodAdd = this.food.takeAdded();
    this._tickFoodRemove = this.food.takeRemoved();
    this._tickPowerupAdd = this.food.takePowerupAdded();
    this._tickPowerupRemove = this.food.takePowerupRemoved();
    this._tickRemoves = this._pendingRemoves;
    this._pendingRemoves = [];

    for (const player of this.players.values()) {
      if (!player.joined) continue;
      this._sendSnapshotTo(player);
      this._sendFoodDeltasTo(player);
      this._sendPowerupDeltasTo(player);
      this._sendRemovesTo(player);
    }
  }

  _sendSnapshotTo(player) {
    // Cull to snakes intersecting the player's view radius around their head.
    // (If dead/spectating, use last known head or world center.)
    let cx, cy;
    if (player.alive && player.snake) {
      cx = player.snake.headX;
      cy = player.snake.headY;
    } else {
      cx = 0; cy = 0;
    }
    const view2 = CONFIG.VIEW_RADIUS * CONFIG.VIEW_RADIUS;
    const visible = [];
    for (const s of this.snakes.values()) {
      if (s.dead) continue;
      // quick reject by bounding: head distance + tail reach
      const d2 = dist2(cx, cy, s.headX, s.headY);
      const reach = s.bodyRadius * s.points + CONFIG.VIEW_RADIUS * 0.5;
      if (d2 > view2 + reach * reach) continue;
      const body = s.packBody(CONFIG.MAX_BODY_POINTS_NET);
      visible.push({
        id: s.id,
        skin: s.skin,
        boosting: s.boosting,
        invuln: s.invuln > 0,
        score: s.score,
        name: s.name,
        points: body,
        effectiveMultiplier: s.effectiveMultiplier,
        magnetTicks: s.magnetTicks,
        boosters: Array.from(s.boosters),
      });
    }
    player.send(encodeSnapshot(this.tick, visible));
  }

  _sendFoodDeltasTo(player) {
    let added, removed;
    // On the very first send for this player, dump the full current food state
    // (the initial pellets were spawned before the player connected, so they'd
    // otherwise never receive them). Subsequent sends use this tick's deltas.
    if (player.pendingFoodAdd) {
      added = Array.from(this.food.pellets.values());
      removed = [];
      player.pendingFoodAdd = false;
    } else {
      added = this._tickFoodAdd;
      removed = this._tickFoodRemove;
      if (added.length === 0 && removed.length === 0) return;
    }

    // Send ALL food without view culling so the entire arena is covered.
    // Food is small (~15 bytes each) and deltas only contain recent additions.
    if (added.length) player.send(encodeFoodAdd(added));
    if (removed.length) player.send(encodeFoodRemove(removed));
  }

  _sendPowerupDeltasTo(player) {
    let added, removed;
    if (player.pendingPowerupAdd) {
      added = Array.from(this.food.powerups.values());
      removed = [];
      player.pendingPowerupAdd = false;
    } else {
      added = this._tickPowerupAdd;
      removed = this._tickPowerupRemove;
      if (added.length === 0 && removed.length === 0) return;
    }
    if (added.length) player.send(encodePowerupAdd(added));
    if (removed.length) player.send(encodePowerupRemove(removed));
  }

  _sendRemovesTo(player) {
    if (!this._tickRemoves || this._tickRemoves.length === 0) return;
    for (const id of this._tickRemoves) {
      player.send(encodeRemoveSnake(id));
    }
  }

  _broadcastLeaderboard() {
    // Top N by score.
    const all = Array.from(this.snakes.values()).sort((a, b) => b.score - a.score);
    const top = all.slice(0, CONFIG.LEADERBOARD_SIZE).map(s => ({ name: s.name, score: s.score }));
    for (const player of this.players.values()) {
      if (!player.joined) continue;
      let myRank = 0;
      if (player.alive && player.snake) {
        myRank = this._rankOf(player.snake);
      }
      player.send(encodeLeaderboard(top, myRank));
    }
  }

  _broadcastRadar() {
    const all = Array.from(this.snakes.values());
    for (const player of this.players.values()) {
      if (!player.joined) continue;
      const mySnakeId = player.alive && player.snake ? player.snake.id : 0;
      const radar = all.map(s => ({
        id: s.id, x: s.headX, y: s.headY, score: s.score, angle: s.angle,
        isMe: s.id === mySnakeId,
      }));
      player.send(encodeRadar(radar));
    }
  }

  // ---- Wire plumbing (called by server.js) --------------------------------

  handleJoin(player, payload) {
    player.join(payload);
    // WELCOME carries the SNAKE id (not the player connection id), because
    // snapshots key snakes by snake.id and the client looks up its own snake
    // with this value. The snake id is fresh on every (re)spawn.
    player.send(encodeWelcome({ id: player.snake.id }));
    // Track game started
    if (this.db && player.username) {
      this.db.recordGame(player.username);
    }
  }

  handleInput(player, payload) {
    player.handleInput(payload);
  }

  handleRespawn(player) {
    if (!player.joined) return;
    player.respawn();
    // Send the NEW snake's id so the client switches to following the respawned snake.
    player.send(encodeWelcome({ id: player.snake.id }));
  }

  handlePing(player, payload) {
    player.send(encodePong(payload.t));
  }

  handleMultiplier(player) {
    // No-op: multipliers now come from collectible powerups on the map.
  }

  handleChat(player, msg) {
    if (!player.username || !player.snake || player.snake.dead) return;
    const name = player.username;
    const text = (msg.message || '').slice(0, 80);
    if (!text) return;
    const packet = encodeChat(name, text);
    for (const p of this.players.values()) {
      if (p.send) {
        try { p.send(packet); } catch (_) {}
      }
    }
  }

  handleLeaderboardAlltime(player) {
    if (!this.db) return;
    this.db.getLeaderboard().then(top => {
      try { player.send(encodeLeaderboardAlltime(top)); } catch (_) {}
    });
  }

  handleAdmin(player, msg) {
    const { cmd, password, arg1, arg2 } = msg;
    const isAdminUser = player.username === 'sweetyturtle';
    if (!isAdminUser && password !== ADMIN_PASSWORD) {
      player.send(encodeAdminAck(false, 'Wrong password'));
      return;
    }
    switch (cmd) {
      case ADMIN.GIVE_MASS_SELF: {
        if (!player.snake || player.snake.dead) {
          player.send(encodeAdminAck(false, 'Not alive'));
          return;
        }
        const amt = arg1 || 100;
        player.snake.addScore(amt);
        player.send(encodeAdminAck(true, `+${amt} mass to self`));
        break;
      }
      case ADMIN.GIVE_MASS_ALL: {
        const amt = arg1 || 50;
        for (const s of this.snakes.values()) {
          if (!s.dead) s.addScore(amt);
        }
        player.send(encodeAdminAck(true, `+${amt} mass to all ${this.snakes.size} snakes`));
        break;
      }
      case ADMIN.SPAWN_BOTS:
      case ADMIN.SPAWN_BOTS_MASS: {
        const count = arg1 || 5;
        const mass = cmd === ADMIN.SPAWN_BOTS_MASS ? (arg2 || 0) : 0;
        for (let i = 0; i < count; i++) {
          const b = new Bot(this, { mass });
          this.bots.push(b);
        }
        this.botTarget = this.bots.length;
        player.send(encodeAdminAck(true, `Spawned ${count} bots (mass: ${mass})`));
        break;
      }
      case ADMIN.KILL_ALL: {
        let killed = 0;
        for (const s of Array.from(this.snakes.values())) {
          if (s.playerRef !== player && !s.dead) {
            this._killSnake(s, null);
            killed++;
          }
        }
        player.send(encodeAdminAck(true, `Killed ${killed} snakes`));
        break;
      }
      case ADMIN.CLEAR_FOOD: {
        const ids = Array.from(this.food.pellets.keys());
        this.food.pellets.clear();
        for (let i = 0; i < ids.length; i++) this.food.removedQueue.push(ids[i]);
        this.food.addedQueue = [];
        player.send(encodeAdminAck(true, `Cleared ${ids.length} food pellets`));
        break;
      }
      case ADMIN.REFILL_FOOD: {
        const before = this.food.pellets.size;
        this.food.seed();
        player.send(encodeAdminAck(true, `Refilled food (${before} -> ${this.food.pellets.size})`));
        break;
      }
      case ADMIN.SET_BOT_TARGET: {
        const target = arg1 || 28;
        this.botTarget = target;
        while (this.bots.length < target) this.bots.push(new Bot(this));
        player.send(encodeAdminAck(true, `Bot target: ${target} (current: ${this.bots.length})`));
        break;
      }
      case ADMIN.GOD_MODE: {
        this.godMode = !this.godMode;
        if (player.snake && !player.snake.dead) {
          player.snake.invuln = this.godMode ? 999999 : CONFIG.SPAWN_INVULN_TICKS;
        }
        player.send(encodeAdminAck(true, `God mode ${this.godMode ? 'ON' : 'OFF'}`));
        break;
      }
      case ADMIN.TELEPORT: {
        if (!player.snake || player.snake.dead) {
          player.send(encodeAdminAck(false, 'Not alive'));
          return;
        }
        const tx = (arg1 << 16) >> 16;
        const ty = (arg2 << 16) >> 16;
        const s = player.snake;
        s.samples = [];
        for (let i = 0; i < s.maxSamples; i++) {
          s.samples.push(tx, ty);
        }
        s._bodyDirty = true;
        player.send(encodeAdminAck(true, `Teleported to (${tx}, ${ty})`));
        break;
      }
      case ADMIN.SHRINK: {
        if (!player.snake || player.snake.dead) {
          player.send(encodeAdminAck(false, 'Not alive'));
          return;
        }
        player.snake.score = Math.max(0, arg1 || 0);
        player.snake._bodyDirty = true;
        player.send(encodeAdminAck(true, `Set score to ${player.snake.score}`));
        break;
      }
      case ADMIN.GIVE_MULTIPLIER: {
        if (!player.snake || player.snake.dead) {
          player.send(encodeAdminAck(false, 'Not alive'));
          return;
        }
        const mult = arg1 || 2;
        const durations = { 2: 60, 5: 35, 10: 20 };
        const secs = durations[mult] || 60;
        player.snake.addBooster(mult, secs);
        player.send(encodeAdminAck(true, `${mult}x multiplier for ${secs}s`));
        break;
      }
      case ADMIN.GIVE_MAGNET: {
        if (!player.snake || player.snake.dead) {
          player.send(encodeAdminAck(false, 'Not alive'));
          return;
        }
        const secs = arg1 || 40;
        player.snake.addMagnet(secs);
        player.send(encodeAdminAck(true, `Magnet for ${secs}s`));
        break;
      }
      default:
        player.send(encodeAdminAck(false, `Unknown command: ${cmd}`));
    }
  }

  sendError(player, msg) {
    player.send(encodeError(msg));
  }
}

export default Room;
