import mysql from 'mysql2/promise';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { filterName } from '../shared/filter.js';

export class Database {
  constructor() {
    this.pool = null;
    this.ready = this._init();
    this.tokens = new Map();
  }

  async _init() {
    const config = {
      host: '10.66.0.10',
      port: 3306,
      user: 'u155_4210xdVf0O',
      password: '^ZhEsd5QAM!YjGW1jtXDJ=^h',
      database: 's155_slither',
    };
    try {
      this.pool = await mysql.createPool(config);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(64) PRIMARY KEY,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS stats (
          username VARCHAR(64) PRIMARY KEY,
          high_score BIGINT DEFAULT 0,
          total_kills INT DEFAULT 0,
          headshots INT DEFAULT 0,
          games_played INT DEFAULT 0,
          deaths INT DEFAULT 0,
          coins INT DEFAULT 0,
          unlocked_skins TEXT DEFAULT '0,1,2,3',
          daily_claimed_at BIGINT DEFAULT 0,
          FOREIGN KEY (username) REFERENCES users(username)
        )
      `);
      // Migrate: add columns if missing
      for (const col of [
        ['coins', 'INT DEFAULT 0'],
        ['unlocked_skins', "TEXT DEFAULT '0,1,2,3'"],
        ['daily_claimed_at', 'BIGINT DEFAULT 0']
      ]) {
        await this.pool.query(`ALTER TABLE stats ADD COLUMN ${col[0]} ${col[1]}`).catch(() => {});
      }
      console.log('[db] MySQL connected, tables ready.');
    } catch (e) {
      console.error('[db] Failed to connect:', e.message);
      this.pool = null;
    }
  }

  _q(text, params) {
    if (!this.pool) return Promise.resolve({ rows: [] });
    const mysqlText = text.replace(/\$(\d+)/g, (_, i) => '?');
    return this.pool.query(mysqlText, params).then(([rows]) => ({ rows }));
  }

  get isReady() { return !!this.pool; }

  register(username, password) {
    if (!this.pool) return Promise.resolve({ ok: false, msg: 'Accounts unavailable' });
    const name = filterName(username);
    if (!name) return { ok: false, msg: 'Inappropriate username' };
    if (name.length < 2 || name.length > 16) return { ok: false, msg: 'Name must be 2-16 characters' };
    if (password.length < 4) return { ok: false, msg: 'Password must be 4+ characters' };

    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');

    return this._q('INSERT IGNORE INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)', [name, hash, salt, Date.now()])
      .then(r => {
        if (r.rows.affectedRows === 0) return { ok: false, msg: 'Username already taken' };
        return this._q('INSERT IGNORE INTO stats (username) VALUES (?)', [name])
          .then(() => {
            const token = this._createToken(name);
            return { ok: true, token, username: name };
          });
      })
      .catch(e => { console.error('[db] register:', e.message); return { ok: false, msg: 'Database error' }; });
  }

  login(username, password) {
    if (!this.pool) return Promise.resolve({ ok: false, msg: 'Accounts unavailable' });
    const name = (username || '').trim().toLowerCase();
    return this._q('SELECT password_hash, salt FROM users WHERE username = ?', [name])
      .then(r => {
        if (r.rows.length === 0) return { ok: false, msg: 'Account not found' };
        const { password_hash, salt } = r.rows[0];
        const hash = scryptSync(password, salt, 64).toString('hex');
        const match = timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(password_hash, 'hex'));
        if (!match) return { ok: false, msg: 'Wrong password' };
        const token = this._createToken(name);
        return { ok: true, token, username: name };
      })
      .catch(e => { console.error('[db] login:', e.message); return { ok: false, msg: 'Database error' }; });
  }

  validateToken(token) {
    const session = this.tokens.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.tokens.delete(token);
      return null;
    }
    return session.username;
  }

  _createToken(username) {
    const token = randomBytes(32).toString('hex');
    this.tokens.set(token, { username, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    return token;
  }

  async getStats(username) {
    try {
      const r = await this._q('SELECT * FROM stats WHERE username = ?', [username]);
      if (r.rows.length === 0) return { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0, coins: 0, unlockedSkins: '0,1,2,3', dailyClaimedAt: 0 };
      const s = r.rows[0];
      return { highScore: s.high_score, totalKills: s.total_kills, headshots: s.headshots, gamesPlayed: s.games_played, deaths: s.deaths, coins: s.coins || 0, unlockedSkins: s.unlocked_skins || '0,1,2,3', dailyClaimedAt: s.daily_claimed_at || 0 };
    } catch { return { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0, coins: 0, unlockedSkins: '0,1,2,3', dailyClaimedAt: 0 }; }
  }

  async recordGame(username) {
    try {
      await this._q('INSERT INTO stats (username, games_played) VALUES (?, 1) ON DUPLICATE KEY UPDATE games_played = games_played + 1', [username]);
    } catch {}
  }

  async recordDeath(username, score) {
    try {
      await this._q(
        'INSERT INTO stats (username, deaths, high_score) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE deaths = deaths + 1, high_score = GREATEST(high_score, ?)',
        [username, Math.round(score), Math.round(score)]
      );
    } catch {}
  }

  async recordKill(killerName, isHeadshot) {
    try {
      await this._q(
        'INSERT INTO stats (username, total_kills, headshots) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE total_kills = total_kills + 1, headshots = headshots + ?',
        [killerName, isHeadshot ? 1 : 0, isHeadshot ? 1 : 0]
      );
    } catch {}
  }

  async getLeaderboard() {
    try {
      const r = await this._q('SELECT username AS name, high_score, total_kills, headshots FROM stats ORDER BY high_score DESC LIMIT 100');
      return r.rows.map(s => ({ name: s.name, highScore: s.high_score, totalKills: s.total_kills, headshots: s.headshots }));
    } catch { return []; }
  }

  async resetAllStats() {
    if (!this.pool) return { ok: false, msg: 'No database configured' };
    try {
      await this._q('UPDATE stats SET high_score = 0, total_kills = 0, headshots = 0, games_played = 0, deaths = 0');
      return { ok: true, msg: 'All profiles reset' };
    } catch (e) { console.error('[db] resetAllStats:', e.message); return { ok: false, msg: 'Reset failed' }; }
  }

  async addCoins(username, amount) {
    try {
      await this._q('UPDATE stats SET coins = coins + ? WHERE username = ?', [amount, username]);
    } catch {}
  }

  async getCoins(username) {
    try {
      const r = await this._q('SELECT coins FROM stats WHERE username = ?', [username]);
      return r.rows.length > 0 ? (r.rows[0].coins || 0) : 0;
    } catch { return 0; }
  }

  async getUnlockedSkins(username) {
    try {
      const r = await this._q('SELECT unlocked_skins FROM stats WHERE username = ?', [username]);
      return r.rows.length > 0 ? (r.rows[0].unlocked_skins || '0,1,2,3') : '0,1,2,3';
    } catch { return '0,1,2,3'; }
  }

  async buySkin(username, skinId, price) {
    try {
      const r = await this._q('SELECT coins, unlocked_skins FROM stats WHERE username = ?', [username]);
      if (r.rows.length === 0) return { ok: false, msg: 'Account not found' };
      const s = r.rows[0];
      const coins = s.coins || 0;
      const skins = (s.unlocked_skins || '0,1,2,3').split(',').map(Number);
      if (skins.includes(skinId)) return { ok: false, msg: 'Already owned' };
      if (coins < price) return { ok: false, msg: 'Not enough coins' };
      skins.push(skinId);
      await this._q('UPDATE stats SET coins = coins - ?, unlocked_skins = ? WHERE username = ?', [price, skins.join(','), username]);
      return { ok: true, coins: coins - price, unlockedSkins: skins.join(',') };
    } catch (e) { console.error('[db] buySkin:', e.message); return { ok: false, msg: 'Database error' }; }
  }

  async claimDaily(username) {
    try {
      const r = await this._q('SELECT daily_claimed_at FROM stats WHERE username = ?', [username]);
      if (r.rows.length === 0) return { ok: false, msg: 'Account not found' };
      const lastClaim = r.rows[0].daily_claimed_at || 0;
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      if (now - lastClaim < DAY_MS) {
        const nextClaim = lastClaim + DAY_MS;
        const waitMs = nextClaim - now;
        const hours = Math.floor(waitMs / 3600000);
        const mins = Math.floor((waitMs % 3600000) / 60000);
        return { ok: false, msg: `Next daily in ${hours}h ${mins}m` };
      }
      await this._q('UPDATE stats SET coins = coins + 50, daily_claimed_at = ? WHERE username = ?', [now, username]);
      const newCoins = await this.getCoins(username);
      return { ok: true, coins: newCoins };
    } catch (e) { console.error('[db] claimDaily:', e.message); return { ok: false, msg: 'Database error' }; }
  }

  async resetAllShopData() {
    if (!this.pool) return;
    try {
      await this._q("UPDATE stats SET coins = 0, unlocked_skins = '0,1,2,3', daily_claimed_at = 0");
    } catch {}
  }
}
