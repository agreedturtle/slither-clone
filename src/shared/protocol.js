// ===========================================================================
// protocol.js — compact binary protocol, shared by client and server.
//
// Every WebSocket message is a single Uint8Array. First byte = opcode.
// We use DataView read/write helpers to pack floats tightly. All multi-byte
// integers are little-endian (DataView default here). Frames are robust: the
// decoder never throws on truncation — it returns null if a frame is malformed,
// so the caller can simply drop it.
//
// Opcodes are split: C2S (client->server) and S2C (server->client).
// ===========================================================================

import { CONFIG } from './constants.js';
import { isClean } from './filter.js';

// --- Client -> Server opcodes ---------------------------------------------
export const C2S = {
  JOIN: 1,     // { name:u8len+utf8, skin:u8 }
  INPUT: 2,    // { angle:f32, boost:u8 }   (boost: 0 or 1)
  RESPAWN: 3,  // {}
  PING: 4,     // { t:u32 }   client clock for RTT
  ADMIN: 5,    // { cmd:u8, password:str, ...args }   admin commands
  MULTIPLIER: 6, // {} request multiplier cycle
  LOGIN: 7,       // { username:str, password:str }
  REGISTER: 8,    // { username:str, password:str }
  AUTH_TOKEN: 9,  // { token:str }   auto-login with saved token
  PROFILE: 10,    // {}   request own stats
  CHAT: 11,       // { message:str }  in-game chat
  LEADERBOARD_ALLTIME: 12, // {} request all-time leaderboard
};

// Admin sub-commands (the `cmd` byte inside an ADMIN frame).
export const ADMIN = {
  GIVE_MASS_SELF: 1,   // amount:u16
  GIVE_MASS_ALL: 2,    // amount:u16
  SPAWN_BOTS: 3,       // count:u8, startMass:u16
  KILL_ALL: 4,         //
  CLEAR_FOOD: 5,       //
  REFILL_FOOD: 6,      //
  SET_SPEED: 7,        // multiplier100:u16  (100 = normal, 200 = 2x)
  SET_BOT_TARGET: 8,   // count:u16
  GOD_MODE: 9,         // toggle:u8 (1=on, 0=off)
  TELEPORT: 10,        // x:i16, y:i16
  SHRINK: 11,          // targetScore:u16
  SPAWN_BOTS_MASS: 12, // count:u8, mass:u16
  GIVE_MULTIPLIER: 13, // mult:u8 (2, 5, or 10)
  GIVE_MAGNET: 14,     // durationSec:u16 (default 40)
  GIVE_SPEED: 15,      // durationSec:u16 (default 40)
  GIVE_ZOOM: 16,       // durationSec:u16 (default 50)
  GIVE_ALL_BOOSTERS: 17, //
};

// --- Server -> Client opcodes ---------------------------------------------
export const S2C = {
  WELCOME: 1,        // { id:u32, worldRadius:f32, viewRadius:f32, tickHz:u16, skins:u8, baseSpeed:f32, boostSpeed:f32 }
  SNAPSHOT: 2,       // tick:u32, playerCount:u16, [snake...] ; snake = id,skin,boosting,invuln,score:u16,name, npts:u16, [f32 x,f32 y]*npts
  FOOD_ADD: 3,       // count:u16, [ id:u32, x:f32, y:f32, size:u8, colorIdx:u8, value:u8 ]*
  FOOD_REMOVE: 4,    // count:u16, [ id:u32 ]*
  LEADERBOARD: 5,    // myRank:u16, n:u8, [ name, score:u16 ]*n  (already top-N sorted)
  DEATH: 6,          // { finalScore:u16, finalRank:u16, killerId:u32 }
  REMOVE_SNAKE: 7,   // { id:u32 }
  PONG: 8,           // { t:u32 }
  ERROR: 9,          // { msg:utf8 }
  RADAR: 10,         // count:u16, [ id:u32, x:i16, y:i16, score:u16, isMe:u8 ]*   (minimap data: ALL alive snakes)
  ADMIN_ACK: 11,     // { ok:u8, msg:utf8 }   result of an admin command
  MULTIPLIER: 12,    // { mult:u8, ticksLeft:u16 }   multiplier state update
  POWERUP_ADD: 13,   // count:u16, [ id:u32, x:f32, y:f32, mult:u8 ]*
  POWERUP_REMOVE: 14, // count:u16, [ id:u32 ]*
  AUTH_RESULT: 15,    // { ok:u8, msg:utf8, token:utf8, username:utf8 }
  PROFILE_DATA: 16,   // { username:utf8, highScore:u32, totalKills:u16, headshots:u16, gamesPlayed:u16, deaths:u16 }
  HEADSHOT: 17,       // { killerName:utf8, victimName:utf8 }   kill notification
  CHAT: 18,           // { senderName:utf8, message:utf8 }
  KILL_FEED: 19,      // { killer:utf8, victim:utf8, isHeadshot:u8 }
  LEADERBOARD_ALLTIME: 20, // count:u16, [ name:str, highScore:u32, totalKills:u16, headshots:u16 ]*n
};

// We ship the number of skins/colors over the wire too so the client can map
// a server-provided color index. (Static import kept for the food palette size.)
import { FOOD_COLORS, SKINS } from './colors.js';

// ===========================================================================
// Writer — grows a buffer as you append primitives.
// ===========================================================================
export class Writer {
  constructor(initialBytes = 256) {
    this.buf = new ArrayBuffer(initialBytes);
    this.view = new DataView(this.buf);
    this.bytes = new Uint8Array(this.buf);
    this.len = 0;
  }

  _ensure(extra) {
    const need = this.len + extra;
    if (need <= this.buf.byteLength) return;
    let cap = this.buf.byteLength;
    while (cap < need) cap *= 2;
    const next = new ArrayBuffer(cap);
    const nu8 = new Uint8Array(next);
    nu8.set(this.bytes);
    this.buf = next;
    this.view = new DataView(this.buf);
    this.bytes = nu8;
  }

  op(b) { this._ensure(1); this.bytes[this.len++] = b & 0xff; return this; }
  u8(v) { this._ensure(1); this.view.setUint8(this.len, v & 0xff); this.len++; return this; }
  u16(v) { this._ensure(2); this.view.setUint16(this.len, v >>> 0, true); this.len += 2; return this; }
  u32(v) { this._ensure(4); this.view.setUint32(this.len, v >>> 0, true); this.len += 4; return this; }
  i32(v) { this._ensure(4); this.view.setInt32(this.len, v | 0, true); this.len += 4; return this; }
  f32(v) { this._ensure(4); this.view.setFloat32(this.len, Number(v) || 0, true); this.len += 4; return this; }
  i16(v) { this._ensure(2); this.view.setInt16(this.len, v | 0, true); this.len += 2; return this; }

  str(s) {
    // UTF-8 encoded, length-prefixed by a single u8 (max 255 bytes)
    const encoded = textEncoder.encode(String(s == null ? '' : s)).slice(0, 255);
    this.u8(encoded.length);
    this._ensure(encoded.length);
    this.bytes.set(encoded, this.len);
    this.len += encoded.length;
    return this;
  }

  // packed array of int16 coordinates (used for body points) — halves bytes
  i16arr(arr, count) {
    this._ensure(2 * count);
    for (let i = 0; i < count; i++) {
      this.view.setInt16(this.len, arr[i] | 0, true);
      this.len += 2;
    }
    return this;
  }

  rawBytes(arr) {
    this._ensure(arr.length);
    this.bytes.set(arr, this.len);
    this.len += arr.length;
    return this;
  }

  toUint8() {
    return this.bytes.slice(0, this.len);
  }
}

const textEncoder = new TextEncoder();

// ===========================================================================
// Reader — sequential, bounds-checked. Methods return undefined if OOB.
// ===========================================================================
export class Reader {
  constructor(u8) {
    // Store the raw bytes; methods below read from this. We deliberately use
    // a private-ish name so it never collides with the accessor methods.
    this._b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
    this.view = new DataView(this._b.buffer, this._b.byteOffset, this._b.byteLength);
    this.len = 0;
  }

  get remaining() { return this._b.byteLength - this.len; }

  _ok(n) { return this.len + n <= this._b.byteLength; }
  op() { if (!this._ok(1)) return undefined; return this._b[this.len++]; }
  u8() { if (!this._ok(1)) return undefined; return this.view.getUint8(this.len++); }
  u16() { if (!this._ok(2)) return undefined; const v = this.view.getUint16(this.len, true); this.len += 2; return v; }
  u32() { if (!this._ok(4)) return undefined; const v = this.view.getUint32(this.len, true); this.len += 4; return v; }
  i32() { if (!this._ok(4)) return undefined; const v = this.view.getInt32(this.len, true); this.len += 4; return v; }
  f32() { if (!this._ok(4)) return undefined; const v = this.view.getFloat32(this.len, true); this.len += 4; return v; }
  i16() { if (!this._ok(2)) return undefined; const v = this.view.getInt16(this.len, true); this.len += 2; return v; }

  str() {
    const n = this.u8();
    if (n === undefined || !this._ok(n)) { this.len = this._b.byteLength; return ''; }
    const s = textDecoder.decode(this._b.subarray(this.len, this.len + n));
    this.len += n;
    return s;
  }

  i16arr(count) {
    if (!this._ok(2 * count)) { this.len = this._b.byteLength; return null; }
    const out = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = this.view.getInt16(this.len, true);
      this.len += 2;
    }
    return out;
  }

  seekTo(n) { this.len = n; }
  truncate() { this.len = this._b.byteLength; }
}

const textDecoder = new TextDecoder();

// ===========================================================================
// Convenience encoders (server side). Each returns a Uint8Array ready to send.
// ===========================================================================

export function encodeWelcome(state) {
  const w = new Writer(64);
  return w.op(S2C.WELCOME)
    .u32(state.id)
    .f32(CONFIG.WORLD_RADIUS)
    .f32(CONFIG.VIEW_RADIUS)
    .u16(CONFIG.TICK_HZ)
    .u8(SKINS.length)
    .u8(FOOD_COLORS.length)
    .f32(CONFIG.BASE_SPEED)
    .f32(CONFIG.BOOST_SPEED)
    .toUint8();
}

export function encodePong(t) {
  const w = new Writer(8);
  return w.op(S2C.PONG).u32(t >>> 0).toUint8();
}

export function encodeError(msg) {
  const w = new Writer(64);
  return w.op(S2C.ERROR).str(msg).toUint8();
}

export function encodeDeath(finalScore, finalRank, killerId) {
  const w = new Writer(16);
  return w.op(S2C.DEATH).u32(finalScore).u16(finalRank).u32(killerId >>> 0).toUint8();
}

export function encodeRemoveSnake(id) {
  const w = new Writer(8);
  return w.op(S2C.REMOVE_SNAKE).u32(id >>> 0).toUint8();
}

// Leaderboard entries: name + score (already sorted top->bottom by caller).
export function encodeLeaderboard(entries, myRank) {
  const w = new Writer(256);
  w.op(S2C.LEADERBOARD).u16(myRank >>> 0).u8(entries.length);
  for (const e of entries) w.str(e.name).u32(e.score >>> 0);
  return w.toUint8();
}

// Radar: every alive snake's head position + score + angle, for the minimap.
// entries: [{ id, x, y, score, angle, isMe(boolean) }]
export function encodeRadar(entries) {
  let size = 8;
  for (const e of entries) size += 17 + (e.body ? e.body.length * 4 : 0);
  const w = new Writer(size);
  w.op(S2C.RADAR).u16(entries.length);
  for (const e of entries) {
    w.u32(e.id >>> 0).i16(Math.round(e.x)).i16(Math.round(e.y))
      .u32(e.score >>> 0).f32(e.angle || 0).u8(e.isMe ? 1 : 0);
    const body = e.body || [];
    w.u8(body.length);
    for (const pt of body) {
      w.i16(pt.x).i16(pt.y);
    }
  }
  return w.toUint8();
}

export function decodeRadar(r) {
  const count = r.u16();
  if (count === undefined) return null;
  const items = [];
  for (let i = 0; i < count; i++) {
    const id = r.u32(), x = r.i16(), y = r.i16(), score = r.u32(), angle = r.f32(), isMe = r.u8();
    const bodyLen = r.u8();
    const body = [];
    for (let j = 0; j < bodyLen; j++) {
      body.push({ x: r.i16(), y: r.i16() });
    }
    if (isMe === undefined) return null;
    items.push({ id, x, y, score, angle, isMe: isMe === 1, body });
  }
  return { items };
}

// Food deltas. items: [{id,x,y,size,colorIdx,value}]
export function encodeFoodAdd(items) {
  const w = new Writer(16 + items.length * 16);
  w.op(S2C.FOOD_ADD).u16(items.length);
  for (const f of items) {
    w.u32(f.id >>> 0).f32(f.x).f32(f.y).u8(f.size).u8(f.colorIdx).u8(f.value);
  }
  return w.toUint8();
}

export function encodeFoodRemove(ids) {
  const w = new Writer(8 + ids.length * 4);
  w.op(S2C.FOOD_REMOVE).u16(ids.length);
  for (const id of ids) w.u32(id >>> 0);
  return w.toUint8();
}

// A snapshot of all visible snakes for one client.
// snakes: [{ id, skin, boosting, invuln, score, name, points, effectiveMultiplier, boosters }]
export function encodeSnapshot(tick, snakes) {
  // upper-bound size guess
  let totalPts = 0;
  for (const s of snakes) totalPts += (s.points ? s.points.length / 2 : 0);
  const w = new Writer(32 + snakes.length * 40 + totalPts * 2);
  w.op(S2C.SNAPSHOT).u32(tick >>> 0).u16(snakes.length);
  for (const s of snakes) {
    const pts = s.points || [];
    let n = (pts.length / 2) | 0;
    const boosterEntries = s.boosters || [];
    w.u32(s.id >>> 0);
    w.u8(s.skin);
    w.u8((s.boosting ? 1 : 0) | ((s.invuln ? 1 : 0) << 1));
    w.u32(s.score >>> 0);
    w.str(s.name);
    w.u16(s.effectiveMultiplier || 1);
    w.u16(s.magnetTicks || 0);
    w.u16(s.speedTicks || 0);
    w.u16(s.zoomTicks || 0);
    w.u8(boosterEntries.length);
    for (const [mult, ticks] of boosterEntries) {
      w.u8(mult).u16(ticks);
    }
    w.u16(n);
    // pack coordinates into one int16 stream for compactness
    for (let i = 0; i < n; i++) {
      w.i16(Math.round(pts[i * 2]));
      w.i16(Math.round(pts[i * 2 + 1]));
    }
  }
  return w.toUint8();
}

// ===========================================================================
// Client-side decoders. Each returns a plain object or null if malformed.
// ===========================================================================

export function decodeSnapshot(r) {
  const tick = r.u32();
  const count = r.u16();
  if (tick === undefined || count === undefined) return null;
  const snakes = [];
  for (let i = 0; i < count; i++) {
    const id = r.u32();
    const skin = r.u8();
    const flags = r.u8();
    const score = r.u32();
    const name = r.str();
    const effectiveMultiplier = r.u16();
    const magnetTicks = r.u16();
    const speedTicks = r.u16();
    const zoomTicks = r.u16();
    const boosterCount = r.u8();
    const boosters = [];
    for (let j = 0; j < boosterCount; j++) {
      const mult = r.u8();
      const ticks = r.u16();
      if (mult === undefined || ticks === undefined) return null;
      boosters.push([mult, ticks]);
    }
    const n = r.u16();
    if (id === undefined || skin === undefined || flags === undefined ||
        score === undefined || n === undefined) return null;
    const pts = r.i16arr(n * 2);
    if (pts === null) return null;
    snakes.push({
      id, skin, score, name, points: pts,
      boosting: (flags & 1) === 1, invuln: (flags & 2) === 2,
      effectiveMultiplier: effectiveMultiplier || 1,
      magnetTicks: magnetTicks || 0,
      speedTicks: speedTicks || 0,
      zoomTicks: zoomTicks || 0,
      boosters,
    });
  }
  return { tick, snakes };
}

export function decodeWelcome(r) {
  const id = r.u32();
  const worldRadius = r.f32();
  const viewRadius = r.f32();
  const tickHz = r.u16();
  const skins = r.u8();
  const foodColors = r.u8();
  const baseSpeed = r.f32();
  const boostSpeed = r.f32();
  if (boostSpeed === undefined) return null;
  return { id, worldRadius, viewRadius, tickHz, skins, foodColors, baseSpeed, boostSpeed };
}

export function decodeFoodAdd(r) {
  const count = r.u16();
  if (count === undefined) return null;
  const items = [];
  for (let i = 0; i < count; i++) {
    const id = r.u32(), x = r.f32(), y = r.f32(),
      size = r.u8(), colorIdx = r.u8(), value = r.u8();
    if (value === undefined) return null;
    items.push({ id, x, y, size, colorIdx, value });
  }
  return { items };
}

export function decodeFoodRemove(r) {
  const count = r.u16();
  if (count === undefined) return null;
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = r.u32();
    if (id === undefined) return null;
    ids.push(id);
  }
  return { ids };
}

export function decodeLeaderboard(r) {
  const myRank = r.u16();
  const n = r.u8();
  if (n === undefined) return null;
  const entries = [];
  for (let i = 0; i < n; i++) {
    const name = r.str();
    const score = r.u32();
    if (score === undefined) return null;
    entries.push({ name, score });
  }
  return { myRank, entries };
}

export function decodeDeath(r) {
  const finalScore = r.u32();
  const finalRank = r.u16();
  const killerId = r.u32();
  if (killerId === undefined) return null;
  return { finalScore, finalRank, killerId };
}

// Client->server message dispatch. Returns {op, ...payload} or null.
export function decodeClientMessage(u8) {
  const r = new Reader(u8);
  const op = r.op();
  if (op === undefined) return null;
  switch (op) {
    case C2S.JOIN: {
      const name = r.str();
      const skin = r.u8();
      if (skin === undefined) return null;
      return { op, name: sanitizeName(name), skin: Math.min(skin, SKINS.length - 1) };
    }
    case C2S.INPUT: {
      const angle = r.f32();
      const flags = r.u8();
      if (flags === undefined) return null;
      return { op, angle, boost: flags & 1, autoSpin: (flags >> 1) & 1 };
    }
    case C2S.RESPAWN:
      return { op };
    case C2S.PING: {
      const t = r.u32();
      if (t === undefined) return null;
      return { op, t };
    }
    case C2S.ADMIN: {
      const cmd = r.u8();
      const password = r.str();
      const arg1 = r.u32();
      const arg2 = r.u32();
      if (arg2 === undefined) return null; // need all fields present
      return { op, cmd, password, arg1, arg2 };
    }
    case C2S.MULTIPLIER:
      return { op };
    case C2S.LOGIN: {
      const username = r.str();
      const password = r.str();
      if (username === undefined || password === undefined) return null;
      return { op, username: sanitizeName(username), password };
    }
    case C2S.REGISTER: {
      const username = r.str();
      const password = r.str();
      if (username === undefined || password === undefined) return null;
      return { op, username: sanitizeName(username), password };
    }
    case C2S.AUTH_TOKEN: {
      const token = r.str();
      if (token === undefined) return null;
      return { op, token };
    }
    case C2S.PROFILE:
      return { op };
    case C2S.CHAT: {
      const message = r.str();
      if (message === undefined) return null;
      return { op, message: message.slice(0, 80) };
    }
    case C2S.LEADERBOARD_ALLTIME:
      return { op };
    default:
      return null;
  }
}

function sanitizeName(s) {
  const trimmed = (s || '').trim().slice(0, 16);
  if (trimmed.length === 0) return '';
  if (!isClean(trimmed)) return 'anon';
  return trimmed;
}

// Server -> client acknowledgement for an admin command.
export function encodeAdminAck(ok, msg) {
  const w = new Writer(64);
  return w.op(S2C.ADMIN_ACK).u8(ok ? 1 : 0).str(msg).toUint8();
}

// Server -> client multiplier state.
export function encodeMultiplier(mult, ticksLeft) {
  const w = new Writer(8);
  return w.op(S2C.MULTIPLIER).u8(mult).u16(ticksLeft).toUint8();
}

export function decodeMultiplier(r) {
  const mult = r.u8();
  const ticksLeft = r.u16();
  if (mult === undefined || ticksLeft === undefined) return null;
  return { mult, ticksLeft };
}

// Powerup deltas.
export function encodePowerupAdd(items) {
  const w = new Writer(8 + items.length * 10);
  w.op(S2C.POWERUP_ADD).u16(items.length);
  for (const p of items) {
    w.u32(p.id >>> 0).f32(p.x).f32(p.y).u8(p.mult);
    const typeMap = { magnet: 1, speed: 2, zoom: 3 };
    w.u8(typeMap[p.type] || 0);
  }
  return w.toUint8();
}

export function decodePowerupAdd(r) {
  const count = r.u16();
  if (count === undefined) return null;
  const items = [];
  for (let i = 0; i < count; i++) {
    const id = r.u32(), x = r.f32(), y = r.f32(), mult = r.u8(), isMagnet = r.u8();
    if (mult === undefined) return null;
    const typeMap = { 0: 'mult', 1: 'magnet', 2: 'speed', 3: 'zoom' };
    items.push({ id, x, y, mult, type: typeMap[isMagnet] || 'mult' });
  }
  return { items };
}

export function encodePowerupRemove(ids) {
  const w = new Writer(4 + ids.length * 4);
  w.op(S2C.POWERUP_REMOVE).u16(ids.length);
  for (const id of ids) w.u32(id >>> 0);
  return w.toUint8();
}

export function decodePowerupRemove(r) {
  const count = r.u16();
  if (count === undefined) return null;
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = r.u32();
    if (id === undefined) return null;
    ids.push(id);
  }
  return { ids };
}

// --- Auth ---

export function encodeAuthResult(ok, msg, token, username) {
  const w = new Writer(128);
  w.op(S2C.AUTH_RESULT).u8(ok ? 1 : 0).str(msg).str(token || '').str(username || '');
  return w.toUint8();
}

export function decodeAuthResult(r) {
  const ok = r.u8();
  const msg = r.str();
  const token = r.str();
  const username = r.str();
  if (ok === undefined) return null;
  return { ok: ok === 1, msg, token, username };
}

export function encodeProfileData(stats) {
  const w = new Writer(128);
  w.op(S2C.PROFILE_DATA)
    .str(stats.username)
    .u32(stats.highScore >>> 0)
    .u16(Math.min(stats.totalKills, 65535))
    .u16(Math.min(stats.headshots, 65535))
    .u16(Math.min(stats.gamesPlayed, 65535))
    .u16(Math.min(stats.deaths, 65535));
  return w.toUint8();
}

export function decodeProfileData(r) {
  const username = r.str();
  const highScore = r.u32();
  const totalKills = r.u16();
  const headshots = r.u16();
  const gamesPlayed = r.u16();
  const deaths = r.u16();
  if (highScore === undefined) return null;
  return { username, highScore, totalKills, headshots, gamesPlayed, deaths };
}

export function encodeHeadshot(killerName, victimName) {
  const w = new Writer(64);
  w.op(S2C.HEADSHOT).str(killerName).str(victimName);
  return w.toUint8();
}

export function encodeChat(senderName, message) {
  const w = new Writer(128);
  w.op(S2C.CHAT).str(senderName).str(message);
  return w.toUint8();
}

export function decodeChat(r) {
  const senderName = r.str();
  const message = r.str();
  if (senderName === undefined || message === undefined) return null;
  return { senderName, message };
}

export function encodeKillFeed(killer, victim, isHeadshot) {
  const w = new Writer(128);
  w.op(S2C.KILL_FEED).str(killer).str(victim).u8(isHeadshot ? 1 : 0);
  return w.toUint8();
}

export function decodeKillFeed(r) {
  const killer = r.str();
  const victim = r.str();
  const isHeadshot = r.u8();
  if (killer === undefined) return null;
  return { killer, victim, isHeadshot: isHeadshot === 1 };
}

export function encodeLeaderboardAlltime(entries) {
  const w = new Writer(8 + entries.length * 60);
  w.op(S2C.LEADERBOARD_ALLTIME).u16(entries.length);
  for (const e of entries) {
    w.str(e.name).u32(e.highScore >>> 0).u16(Math.min(e.totalKills, 65535)).u16(Math.min(e.headshots || 0, 65535));
  }
  return w.toUint8();
}

export function decodeLeaderboardAlltime(r) {
  const count = r.u16();
  if (count === undefined) return null;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const name = r.str();
    const highScore = r.u32();
    const totalKills = r.u16();
    const headshots = r.u16();
    if (highScore === undefined) return null;
    entries.push({ name, highScore, totalKills, headshots });
  }
  return { entries };
}

// --- Client encoders for auth ---

export function encodeLogin(username, password) {
  const w = new Writer(128);
  w.op(C2S.LOGIN).str(username).str(password);
  return w.toUint8();
}

export function encodeRegister(username, password) {
  const w = new Writer(128);
  w.op(C2S.REGISTER).str(username).str(password);
  return w.toUint8();
}

export function encodeAuthToken(token) {
  const w = new Writer(64);
  w.op(C2S.AUTH_TOKEN).str(token);
  return w.toUint8();
}

export function encodeProfileRequest() {
  const w = new Writer(4);
  w.op(C2S.PROFILE);
  return w.toUint8();
}

// --- Server-side auth decoders ---

export function decodeLogin(r) {
  const username = r.str();
  const password = r.str();
  if (username === undefined || password === undefined) return null;
  return { username, password };
}

export function decodeRegister(r) {
  const username = r.str();
  const password = r.str();
  if (username === undefined || password === undefined) return null;
  return { username, password };
}

export function decodeAuthToken(r) {
  const token = r.str();
  if (token === undefined) return null;
  return { token };
}
