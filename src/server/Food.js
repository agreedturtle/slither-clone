// ===========================================================================
// Food.js — pellet store with a spatial grid and lazy maintenance.
//
// Pellets are global (all players see the same pellets; per-client culling of
// *which* pellets get sent is done in Room.broadcast, not here).
//
// Each pellet: { id, x, y, size, colorIdx, value, death(boolean) }
// ===========================================================================

import { CONFIG } from '../shared/constants.js';
import { FOOD_COLORS } from '../shared/colors.js';
import { distFromOrigin, randInDisk } from '../shared/math.js';

let _nextId = 1;
export function resetFoodIds() { _nextId = 1; }

export class Food {
  constructor() {
    this.pellets = new Map();     // id -> pellet
    this.powerups = new Map();    // id -> powerup { id, x, y, mult, born }
    this.removedQueue = [];       // ids removed since last broadcast flush
    this.addedQueue = [];         // pellets added since last broadcast flush
    this.powerupAddQueue = [];    // powerups added since last broadcast
    this.powerupRemoveQueue = []; // powerup ids removed since last broadcast
    this.grid = null;             // rebuilt per tick by Room
  }

  get count() { return this.pellets.size; }

  // Single source of pellet ids. Both spawn paths go through this.
  _newId() { return _nextId++; }

  // Spawn at a specific location with a specific value.
  _spawnAt(x, y, value, death) {
    const colorIdx = death ? FOOD_COLORS.length : (Math.random() * FOOD_COLORS.length) | 0;
    const lifetime = death
      ? (CONFIG.FOOD_DEATH_LIFETIME_MIN + Math.random() * (CONFIG.FOOD_DEATH_LIFETIME_MAX - CONFIG.FOOD_DEATH_LIFETIME_MIN)) | 0
      : (CONFIG.FOOD_LIFETIME_MIN + Math.random() * (CONFIG.FOOD_LIFETIME_MAX - CONFIG.FOOD_LIFETIME_MIN)) | 0;
    const pellet = {
      id: this._newId(),
      x, y,
      size: death ? CONFIG.FOOD_RADIUS_DEATH : CONFIG.FOOD_RADIUS_SMALL,
      colorIdx, value, death: !!death,
      born: Date.now(),
      lifetime,
    };
    this.pellets.set(pellet.id, pellet);
    this.addedQueue.push(pellet);
    return pellet;
  }

  _spawnRandom(value = null) {
    const p = randInDisk(CONFIG.WORLD_RADIUS * 0.98);
    const death = value != null;
    const v = value != null ? value : CONFIG.FOOD_VALUE_SMALL;
    return this._spawnAt(p.x, p.y, v, death);
  }

  // Seed the world to the target pellet count.
  seed() {
    for (let i = this.pellets.size; i < CONFIG.FOOD_TARGET; i++) {
      this._spawnRandom();
    }
  }

  // Keep population near target; called periodically. Spawns pellets uniformly
  // across the entire arena so food is everywhere (no clustering).
  maintain() {
    let need = CONFIG.FOOD_TARGET - this.pellets.size;
    if (need > 300) need = 300; // cap per call to avoid spikes
    for (let i = 0; i < need; i++) this._spawnRandom();
  }

  // Drop high-value food along a dying snake's body. Spreads widely so the
  // trail is visible and rewarding to collect.
  dropFromPath(points, bodyRadius, totalValue) {
    const n = points.length;
    const step = 2;
    const spread = bodyRadius * 3;
    const pellets = [];
    for (let i = 0; i < n; i += step) {
      for (let j = 0; j < 3; j++) {
        const x = points[i] + (Math.random() - 0.5) * spread;
        const y = points[i + 1] + (Math.random() - 0.5) * spread;
        if (distFromOrigin(x, y) <= CONFIG.WORLD_RADIUS) {
          pellets.push({ x, y });
        }
      }
    }
    const count = pellets.length || 1;
    const v = Math.max(1, Math.round(totalValue / count));
    let remaining = totalValue;
    const spawned = [];
    for (const p of pellets) {
      const share = Math.min(v, remaining);
      const pellet = this._spawnAt(p.x, p.y, share, true);
      spawned.push(pellet);
      remaining -= share;
      if (remaining <= 0) break;
    }
    return spawned;
  }

  consume(id) {
    const p = this.pellets.get(id);
    if (!p) return null;
    this.pellets.delete(id);
    this.removedQueue.push(id);
    return p;
  }

  // Remove pellets that have exceeded their lifetime. Death food never expires.
  sweepExpired() {
    const now = Date.now();
    for (const [id, p] of this.pellets) {
      if (p.lifetime > 0 && now - p.born >= p.lifetime) {
        this.pellets.delete(id);
        this.removedQueue.push(id);
      }
    }
  }

  // Drain accumulated deltas for broadcast (caller sends then clears).
  takeAdded() { const a = this.addedQueue; this.addedQueue = []; return a; }
  takeRemoved() { const r = this.removedQueue; this.removedQueue = []; return r; }
  takePowerupAdded() { const a = this.powerupAddQueue; this.powerupAddQueue = []; return a; }
  takePowerupRemoved() { const r = this.powerupRemoveQueue; this.powerupRemoveQueue = []; return r; }

  // --- Powerups (multiplier + magnet) ---
  spawnPowerup() {
    if (this.powerups.size >= CONFIG.POWERUP_SPAWN_MAX) return null;
    const p = randInDisk(CONFIG.WORLD_RADIUS * 0.95);
    // Pool: 2x(3), 5x(2), 10x(1), magnet(2)
    const pool = [2, 2, 2, 5, 5, 10, 'magnet', 'magnet'];
    const type = pool[(Math.random() * pool.length) | 0];
    const powerup = {
      id: this._newId(),
      x: p.x, y: p.y,
      type: typeof type === 'string' ? type : 'mult',
      mult: typeof type === 'number' ? type : 0,
      born: Date.now(),
      lifetime: (CONFIG.POWERUP_LIFETIME_MIN + Math.random() * (CONFIG.POWERUP_LIFETIME_MAX - CONFIG.POWERUP_LIFETIME_MIN)) | 0,
    };
    this.powerups.set(powerup.id, powerup);
    this.powerupAddQueue.push(powerup);
    return powerup;
  }

  consumePowerup(id) {
    const p = this.powerups.get(id);
    if (!p) return null;
    this.powerups.delete(id);
    this.powerupRemoveQueue.push(id);
    return p;
  }

  sweepPowerups() {
    const now = Date.now();
    for (const [id, p] of this.powerups) {
      if (now - p.born >= p.lifetime) {
        this.powerups.delete(id);
        this.powerupRemoveQueue.push(id);
      }
    }
  }
}

export default Food;
