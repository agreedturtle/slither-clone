// ===========================================================================
// Player.js — a human connection that wraps a Snake.
//
// One WebSocket == one Player. A player may be "lobby" (connected, not yet
// spawned) or "alive" (has a Snake in the Room). On death they go back to
// "spectating" until they send RESPAWN.
// ===========================================================================

import { Snake } from './Snake.js';
import { CONFIG } from '../shared/constants.js';
import { randInDisk, TAU, wrapAngle } from '../shared/math.js';
import { randomSkinId } from '../shared/colors.js';

export class Player {
  constructor(ws, room) {
    this.ws = ws;
    this.room = room;
    this.id = room.nextPlayerId();
    this.name = '';
    this.skin = 0;
    this.snake = null;       // set when spawned
    this.alive = false;
    this.joined = false;     // sent JOIN
    this.lastInputAt = 0;
    this.lastPingSent = 0;
    this.rtt = 0;
    this.lastSeen = Date.now();

    // Throttling for sending snapshot/food to this client.
    this.pendingFoodAdd = true; // send full food on first snapshot
    this.pendingPowerupAdd = true; // send full powerups on first snapshot
  }

  // Called when C2S.JOIN arrives.
  join({ name, skin }) {
    this.name = name && name.length ? name : 'anon';
    this.skin = skin == null ? randomSkinId() : skin;
    this.joined = true;
    this.spawn();
  }

  // Spawn (or respawn) the snake at a safe location.
  spawn() {
    const pos = this.room.findSpawnPosition();
    const angle = Math.atan2(-pos.y || -0.01, -pos.x || -0.01); // face inward
    this.snake = new Snake({
      name: this.name,
      skin: this.skin,
      x: pos.x,
      y: pos.y,
      angle,
    });
    this.snake.addScore(Math.floor(Math.random() * 13) + 18); // 18-30 start mass
    this.snake.playerRef = this;
    this.alive = true;
    this.room.addSnake(this.snake);
  }

  respawn() {
    if (this.snake) { /* already cleaned up on death */ }
    this.spawn();
  }

  handleInput({ angle, boost, autoSpin }) {
    if (!this.alive || !this.snake) return;
    // Ignore inputs during server lag (snakes keep moving in last direction).
    if (this.room._lagUntil > Date.now()) return;
    // Validate angle to a sane range.
    if (Number.isFinite(angle)) {
      this.snake.setTargetAngle(angle);
    }
    this.snake.setBoost(!!boost);
    this.snake.autoSpin = !!autoSpin;
    this.lastInputAt = Date.now();
  }

  onDeath() {
    this.alive = false;
    this.snake = null;
  }

  touch() { this.lastSeen = Date.now(); }

  send(u8) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(u8);
    }
  }

  close(code = 1000, reason = '') {
    try { this.ws.close(code, reason); } catch (_) { /* ignore */ }
  }
}

export default Player;
