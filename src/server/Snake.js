// ===========================================================================
// Snake.js — the snake entity, shared by human Players and AI Bots.
//
// Body representation: a "path" of recent head positions. We store the path as
// two flat arrays (xs[], ys[]) plus a head index, used as a ring buffer of
// recent head samples. The visual body is built by sampling that path at
// intervals of POINT_DIST so the body length (in points) matches the score.
//
// Movement model (mirrors Slither):
//   - Each tick we steer `angle` toward `targetAngle` by at most TURN_SPEED.
//   - We step the head forward by `speed` along `angle`.
//   - We push the new head sample onto the path ring buffer.
//   - The body length grows/shrinks to match scoreToPoints(score).
//
// Collisions are NOT handled here — Room owns the SpatialGrid and resolves
// head-vs-body / head-vs-head / border deaths. Snake just exposes the body
// points needed for queries and rendering.
// ===========================================================================

import { CONFIG, scoreToPoints, bodyRadiusFromScore } from '../shared/constants.js';
import { TAU, stepAngle, wrapAngle, dist } from '../shared/math.js';

let _nextId = 1;

export class Snake {
  constructor({ name, skin, x, y, angle }) {
    this.id = _nextId++;
    this.name = name;
    this.skin = skin;

    this.score = 0;
    this.angle = wrapAngle(angle);
    this.targetAngle = this.angle;
    this.boosting = false;
    this.autoSpin = false;
    this.dead = false;
    this.invuln = CONFIG.SPAWN_INVULN_TICKS; // counts down to 0
    this.pendingGrowth = 0;                  // score gained but not yet applied to length

    // Food multiplier boosters: Map<mult, ticksRemaining>. Effective mult = product of all keys.
    this.boosters = new Map();
    this.magnetTicks = 0;
    this.speedTicks = 0;
    this.zoomTicks = 0;

    // Path ring buffer of recent head samples (units of raw travel, not the
    // visual point spacing). Grows dynamically as the snake gets bigger.
    this.samples = [];     // flat [x0,y0, x1,y1, ...] oldest->newest
    this.maxSamples = CONFIG.MIN_POINTS * 4 + 8;

    // Prime the path with the spawn point so the snake has a body immediately.
    for (let i = 0; i < this.maxSamples; i++) {
      this.samples.push(x, y);
    }

    // Last boost accounting
    this.boostTickCounter = 0;

    // Body cache (flat xs/ys at POINT_DIST spacing) — rebuilt when dirty.
    this._bodyDirty = true;
    this._bodyX = null;     // Int16Array-ish arrays
    this._bodyY = null;
    this._bodyLen = 0;
  }

  get isBot() { return false; }

  get points() {
    const n = scoreToPoints(this.score);
    return n;
  }

  get bodyRadius() {
    return bodyRadiusFromScore(this.score);
  }

  get headX() { return this.samples[this.samples.length - 2]; }
  get headY() { return this.samples[this.samples.length - 1]; }

  // Steering input (validated/clamped by the caller; here we trust it).
  setTargetAngle(a) {
    this.targetAngle = wrapAngle(a);
  }
  setBoost(b) { this.boosting = !!b; }

  canBoost() {
    return this.boosting && this.score >= CONFIG.BOOST_MIN_SCORE && !this.dead;
  }

  // One simulation tick. `room` is passed so we can drop food while boosting.
  tick(room) {
    if (this.dead) return;
    if (this.invuln > 0) this.invuln--;

    // 1) Steer toward target angle (rate-limited).
    if (this.autoSpin) {
      this.angle = wrapAngle(this.angle + CONFIG.TURN_SPEED);
    } else {
      this.angle = stepAngle(this.angle, this.targetAngle, CONFIG.TURN_SPEED);
    }

    // 2) Determine speed.
    const boosting = this.canBoost();
    let speed = boosting ? CONFIG.BOOST_SPEED : CONFIG.BASE_SPEED;
    if (boosting && this.speedTicks > 0) speed *= 1.3;

    // 3) Step head.
    const nx = this.samples[this.samples.length - 2] + Math.cos(this.angle) * speed;
    const ny = this.samples[this.samples.length - 1] + Math.sin(this.angle) * speed;

    // Push sample onto ring buffer (we keep it a flat array; trim oldest).
    this.samples.push(nx, ny);
    // Grow buffer dynamically if the snake's desired body needs more history.
    // Each body point needs ~POINT_DIST units of travel = POINT_DIST/speed ticks.
    const needSamples = Math.ceil(this.points * CONFIG.POINT_DIST / Math.max(1, speed)) * 2 + 16;
    if (needSamples > this.maxSamples) this.maxSamples = needSamples;
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }

    // 4) Boost cost: every BOOST_COST_TICKS while boosting, lose 1 score and
    //    drop a food pellet at the tail (mass conservation).
    if (boosting) {
      this.boostTickCounter++;
      if (this.boostTickCounter >= CONFIG.BOOST_COST_TICKS) {
        this.boostTickCounter = 0;
        if (this.score > 0) {
          this.score = Math.max(0, this.score - 1);
          this._bodyDirty = true;
          // drop a small food pellet behind the tail
          room.dropBoostFood(this);
        }
      }
    } else {
      this.boostTickCounter = 0;
    }

    // 5) Tick down boosters.
    for (const [mult, ticks] of this.boosters) {
      if (ticks <= 1) this.boosters.delete(mult);
      else this.boosters.set(mult, ticks - 1);
    }

    // 6) Tick down magnet, speed, zoom.
    if (this.magnetTicks > 0) this.magnetTicks--;
    if (this.speedTicks > 0) this.speedTicks--;
    if (this.zoomTicks > 0) this.zoomTicks--;

    this._bodyDirty = true;
  }

  get effectiveMultiplier() {
    let m = 1;
    for (const mult of this.boosters.keys()) m *= mult;
    return m;
  }

  // Add score (from eating food). Body length catches up on next rebuild.
  addScore(amount) {
    this.score = Math.min(this.score + amount, 100_000_000_000_000);
    this._bodyDirty = true;
  }

  // Add a booster: stacks multiplicatively with existing boosters.
  addBooster(mult, durationSec) {
    const ticks = durationSec * CONFIG.TICK_HZ;
    const existing = this.boosters.get(mult) || 0;
    this.boosters.set(mult, Math.max(existing, ticks));
  }

  addMagnet(durationSec) {
    const ticks = durationSec * CONFIG.TICK_HZ;
    this.magnetTicks = Math.max(this.magnetTicks, ticks);
  }

  addSpeed(durationSec) {
    const ticks = durationSec * CONFIG.TICK_HZ;
    this.speedTicks = Math.max(this.speedTicks, ticks);
  }

  addZoom(durationSec) {
    const ticks = durationSec * CONFIG.TICK_HZ;
    this.zoomTicks = Math.max(this.zoomTicks, ticks);
  }

  get hasMagnet() { return this.magnetTicks > 0; }

  // Rebuild the visual/collision body points spaced POINT_DIST apart along
  // the path, from head back toward tail. We walk samples newest->oldest and
  // accumulate distance until POINT_DIST, then emit a point.
  rebuildBodyIfNeeded() {
    if (!this._bodyDirty && this._bodyX) return;
    const want = this.points;
    const samples = this.samples;
    const n = samples.length / 2;
    // Grow body cache arrays if needed.
    if (!this._bodyX || this._bodyX.length < want + 4) {
      this._bodyX = new Array(want + 4);
      this._bodyY = new Array(want + 4);
    }
    const xs = this._bodyX;
    const ys = this._bodyY;

    let count = 0;
    xs[count] = samples[(n - 1) * 2];
    ys[count] = samples[(n - 1) * 2 + 1];
    count++;

    let acc = 0;
    let prevX = xs[0];
    let prevY = ys[0];
    for (let i = n - 2; i >= 0 && count < want; i--) {
      const sx = samples[i * 2];
      const sy = samples[i * 2 + 1];
      acc += dist(prevX, prevY, sx, sy);
      // To make spacing roughly POINT_DIST, emit when accumulator crosses.
      while (acc >= CONFIG.POINT_DIST && count < want) {
        // place point at the sample (good enough; spacing is approximate)
        xs[count] = sx;
        ys[count] = sy;
        count++;
        acc -= CONFIG.POINT_DIST;
      }
      prevX = sx;
      prevY = sy;
    }
    // If we ran out of samples before filling `want`, pad with the last point.
    while (count < want) {
      xs[count] = xs[count - 1];
      ys[count] = ys[count - 1];
      count++;
    }
    this._bodyLen = count;
    this._bodyDirty = false;
  }

  // Pack body into a flat Int16Array [x0,y0,x1,y1,...] for networking.
  // When downsampling, interpolates midpoints to keep curves smooth.
  packBody(maxPoints) {
    this.rebuildBodyIfNeeded();
    const len = this._bodyLen;
    if (len <= maxPoints) {
      const out = new Int16Array(len * 2);
      let oi = 0;
      for (let i = 0; i < len; i++) {
        out[oi++] = Math.round(this._bodyX[i]);
        out[oi++] = Math.round(this._bodyY[i]);
      }
      return out;
    }
    // Downsample with midpoint interpolation to preserve curves.
    const out = new Int16Array(maxPoints * 2);
    let oi = 0;
    const ratio = (len - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i++) {
      const srcIdx = i * ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, len - 1);
      const t = srcIdx - lo;
      out[oi++] = Math.round(this._bodyX[lo] + (this._bodyX[hi] - this._bodyX[lo]) * t);
      out[oi++] = Math.round(this._bodyY[lo] + (this._bodyY[hi] - this._bodyY[lo]) * t);
    }
    return out;
  }

  // Returns true if the head is outside the world circle.
  isOutOfBounds() {
    const hx = this.headX;
    const hy = this.headY;
    return (hx * hx + hy * hy) > CONFIG.WORLD_RADIUS * CONFIG.WORLD_RADIUS;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
  }
}

export function resetSnakeIds() { _nextId = 1; }
export default Snake;
