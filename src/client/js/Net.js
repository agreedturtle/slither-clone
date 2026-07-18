// ===========================================================================
// Net.js — WebSocket connection + message encode/decode for the client.
//
// Exposes a small event-driven API the Game subscribes to:
//   net.on('welcome', cb) / on('snapshot', cb) / on('foodAdd', cb) ...
//   net.connect()          -> opens ws to the page origin
//   net.join(name, skin)
//   net.sendInput(angle, boost)
//   net.respawn()
// ===========================================================================

import { C2S, S2C, Writer, Reader,
  decodeWelcome, decodeSnapshot, decodeFoodAdd, decodeFoodRemove,
  decodeLeaderboard, decodeDeath, decodeRadar, decodeMultiplier,
  decodePowerupAdd, decodePowerupRemove, decodeAuthResult, decodeProfileData,
  decodeChat, decodeKillFeed, decodeLeaderboardAlltime,
  encodeLogin, encodeRegister, encodeAuthToken, encodeProfileRequest,
} from '../../shared/protocol.js';

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.connected = false;
    this.lastInputSent = 0;
    this._lastInput = { angle: 0, boost: 0 };
    this._inputTimer = null;
    this._authToken = null;
  }

  setAuthToken(token) { this._authToken = token; }

  on(evt, fn) {
    let arr = this.handlers.get(evt);
    if (!arr) { arr = []; this.handlers.set(evt, arr); }
    arr.push(fn);
  }
  _emit(evt, payload) {
    const arr = this.handlers.get(evt);
    if (arr) for (const fn of arr) fn(payload);
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('open', () => {
      this.connected = true;
      this._emit('open');
      if (this._authToken) this.sendAuthToken(this._authToken);
    });
    this.ws.addEventListener('close', () => {
      this.connected = false;
      this._emit('close');
    });
    this.ws.addEventListener('error', () => {
      this._emit('error');
    });
    this.ws.addEventListener('message', (ev) => this._onMessage(ev));
  }

  _onMessage(ev) {
    const u8 = new Uint8Array(ev.data);
    const r = new Reader(u8);
    const op = r.op();
    if (op === undefined) return;
    switch (op) {
      case S2C.WELCOME: {
        const d = decodeWelcome(r);
        if (d) this._emit('welcome', d);
        break;
      }
      case S2C.SNAPSHOT: {
        const d = decodeSnapshot(r);
        if (d) this._emit('snapshot', d);
        break;
      }
      case S2C.FOOD_ADD: {
        const d = decodeFoodAdd(r);
        if (d) this._emit('foodAdd', d.items);
        break;
      }
      case S2C.FOOD_REMOVE: {
        const d = decodeFoodRemove(r);
        if (d) this._emit('foodRemove', d.ids);
        break;
      }
      case S2C.LEADERBOARD: {
        const d = decodeLeaderboard(r);
        if (d) this._emit('leaderboard', d);
        break;
      }
      case S2C.RADAR: {
        const d = decodeRadar(r);
        if (d) this._emit('radar', d.items);
        break;
      }
      case S2C.DEATH: {
        const d = decodeDeath(r);
        if (d) this._emit('death', d);
        break;
      }
      case S2C.REMOVE_SNAKE: {
        const id = r.u32();
        if (id !== undefined) this._emit('removeSnake', id);
        break;
      }
      case S2C.PONG: {
        const t = r.u32();
        if (t !== undefined) this._emit('pong', t);
        break;
      }
      case S2C.ERROR: {
        const msg = r.str();
        this._emit('error', msg);
        break;
      }
      case S2C.ADMIN_ACK: {
        const ok = r.u8();
        const msg = r.str();
        this._emit('adminAck', { ok: ok === 1, msg });
        break;
      }
      case S2C.MULTIPLIER: {
        const d = decodeMultiplier(r);
        if (d) this._emit('multiplier', d);
        break;
      }
      case S2C.POWERUP_ADD: {
        const d = decodePowerupAdd(r);
        if (d) this._emit('powerupAdd', d.items);
        break;
      }
      case S2C.POWERUP_REMOVE: {
        const d = decodePowerupRemove(r);
        if (d) this._emit('powerupRemove', d.ids);
        break;
      }
      case S2C.AUTH_RESULT: {
        const d = decodeAuthResult(r);
        if (d) this._emit('authResult', d);
        break;
      }
      case S2C.PROFILE_DATA: {
        const d = decodeProfileData(r);
        if (d) this._emit('profileData', d);
        break;
      }
      case S2C.HEADSHOT: {
        const killer = r.str();
        const victim = r.str();
        if (killer !== undefined) this._emit('headshot', { killer, victim });
        break;
      }
      case S2C.CHAT: {
        const d = decodeChat(r);
        if (d) this._emit('chat', d);
        break;
      }
      case S2C.KILL_FEED: {
        const d = decodeKillFeed(r);
        if (d) this._emit('killFeed', d);
        break;
      }
      case S2C.LEADERBOARD_ALLTIME: {
        const d = decodeLeaderboardAlltime(r);
        if (d) this._emit('leaderboardAlltime', d);
        break;
      }
      default: break;
    }
  }

  // ---- Outbound ----
  _send(u8) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(u8);
    }
  }

  join(name, skin) {
    const w = new Writer();
    w.op(C2S.JOIN).str(name).u8(skin | 0);
    this._send(w.toUint8());
  }

  respawn() {
    const w = new Writer();
    w.op(C2S.RESPAWN);
    this._send(w.toUint8());
  }

  sendInput(angle, boost, autoSpin) {
    const now = performance.now();
    // Send immediately if boost changed; otherwise throttle to ~15Hz.
    const boostChanged = (boost ? 1 : 0) !== this._lastInput.boost;
    const spinChanged = (autoSpin ? 1 : 0) !== this._lastInput.autoSpin;
    if (!boostChanged && !spinChanged && now - this.lastInputSent < 33) return;
    this.lastInputSent = now;
    this._lastInput = { angle, boost: boost ? 1 : 0, autoSpin: autoSpin ? 1 : 0 };
    const flags = (boost ? 1 : 0) | ((autoSpin ? 1 : 0) << 1);
    const w = new Writer();
    w.op(C2S.INPUT).f32(angle).u8(flags);
    this._send(w.toUint8());
  }

  ping(t) {
    const w = new Writer();
    w.op(C2S.PING).u32(t >>> 0);
    this._send(w.toUint8());
  }

  // Admin command. cmd = ADMIN.* constant; arg1/arg2 are command-specific.
  sendAdmin(password, cmd, arg1 = 0, arg2 = 0) {
    const w = new Writer();
    w.op(C2S.ADMIN).u8(cmd).str(password || '').u32(arg1).u32(arg2);
    this._send(w.toUint8());
  }

  sendMultiplier() {
    const w = new Writer();
    w.op(C2S.MULTIPLIER);
    this._send(w.toUint8());
  }

  sendLogin(username, password) {
    this._send(encodeLogin(username, password));
  }

  sendRegister(username, password) {
    this._send(encodeRegister(username, password));
  }

  sendAuthToken(token) {
    this._send(encodeAuthToken(token));
  }

  sendProfileRequest() {
    this._send(encodeProfileRequest());
  }

  sendChat(message) {
    const w = new Writer();
    w.op(C2S.CHAT).str(message);
    this._send(w.toUint8());
  }

  requestLeaderboardAlltime() {
    const w = new Writer();
    w.op(C2S.LEADERBOARD_ALLTIME);
    this._send(w.toUint8());
  }
}

export default Net;
