import pg from 'pg';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { filterName } from '../shared/filter.js';

const { Pool } = pg;

export class Database {
  constructor() {
    this.pool = null;
    this.ready = this._init();
    this.tokens = new Map(); // token -> { username, expiresAt }
  }

  async _init() {
    // Check common env var names, plus any var containing 'database' or 'postgres' or 'url'
    let url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL || process.env.DB_URL || process.env.DATABASE_PRIVATE_URL;
    if (!url) {
      // Brute force: find any env var that looks like a postgres connection string
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v === 'string' && v.startsWith('postgres')) {
          url = v;
          console.log(`[db] Found DB in env var: ${k}`);
          break;
        }
      }
    }
    if (!url) {
      console.warn('[db] No DATABASE_URL found. All env vars:', Object.keys(process.env).join(', '));
      console.warn('[db] Stats will not persist.');
      return;
    }
    try {
      this.pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS stats (
          username TEXT PRIMARY KEY REFERENCES users(username),
          high_score BIGINT DEFAULT 0,
          total_kills INTEGER DEFAULT 0,
          headshots INTEGER DEFAULT 0,
          games_played INTEGER DEFAULT 0,
          deaths INTEGER DEFAULT 0,
          coins INTEGER DEFAULT 0,
          unlocked_skins TEXT DEFAULT '0,1,2,3',
          daily_claimed_at BIGINT DEFAULT 0
        )
      `);
      // Migrate old INTEGER high_score columns to BIGINT if needed.
      await this.pool.query(`ALTER TABLE stats ALTER COLUMN high_score TYPE BIGINT`).catch(() => {});
      // Migrate: add coins/unlocked_skins/daily columns if missing
      await this.pool.query(`ALTER TABLE stats ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0`).catch(() => {});
      await this.pool.query(`ALTER TABLE stats ADD COLUMN IF NOT EXISTS unlocked_skins TEXT DEFAULT '0,1,2,3'`).catch(() => {});
      await this.pool.query(`ALTER TABLE stats ADD COLUMN IF NOT EXISTS daily_claimed_at BIGINT DEFAULT 0`).catch(() => {});
      console.log('[db] PostgreSQL connected, tables ready.');
    } catch (e) {
      console.error('[db] Failed to connect:', e.message);
      this.pool = null;
    }
  }

  _q(text, params) {
    if (!this.pool) return Promise.resolve({ rows: [] });
    return this.pool.query(text, params);
  }

  get isReady() { return !!this.pool; }

  register(username, password) {
    if (!this.pool) return Promise.resolve({ ok: false, msg: 'Accounts unavailable — no database configured' });
    const name = filterName(username);
    if (!name) return { ok: false, msg: 'Inappropriate username' };
    if (name.length < 2 || name.length > 16) return { ok: false, msg: 'Name must be 2-16 characters' };
    if (password.length < 4) return { ok: false, msg: 'Password must be 4+ characters' };

    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');

    return this._q('INSERT INTO users (username, password_hash, salt, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [name, hash, salt, Date.now()])
      .then(r => {
        if (r.rowCount === 0) return { ok: false, msg: 'Username already taken' };
        return this._q('INSERT INTO stats (username) VALUES ($1) ON CONFLICT DO NOTHING', [name])
          .then(() => {
            const token = this._createToken(name);
            return { ok: true, token, username: name };
          });
      })
      .catch(e => { console.error('[db] register:', e.message); return { ok: false, msg: 'Database error' }; });
  }

  login(username, password) {
    if (!this.pool) return Promise.resolve({ ok: false, msg: 'Accounts unavailable — no database configured' });
    const name = (username || '').trim().toLowerCase();
    return this._q('SELECT password_hash, salt FROM users WHERE username = $1', [name])
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
      const r = await this._q('SELECT * FROM stats WHERE username = $1', [username]);
      if (r.rows.length === 0) return { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0, coins: 0, unlockedSkins: '0,1,2,3', dailyClaimedAt: 0 };
      const s = r.rows[0];
      return { highScore: s.high_score, totalKills: s.total_kills, headshots: s.headshots, gamesPlayed: s.games_played, deaths: s.deaths, coins: s.coins || 0, unlockedSkins: s.unlocked_skins || '0,1,2,3', dailyClaimedAt: s.daily_claimed_at || 0 };
    } catch { return { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0, coins: 0, unlockedSkins: '0,1,2,3', dailyClaimedAt: 0 }; }
  }

  async recordGame(username) {
    try {
      await this._q('INSERT INTO stats (username, games_played) VALUES ($1, 1) ON CONFLICT (username) DO UPDATE SET games_played = stats.games_played + 1', [username]);
    } catch {}
  }

  async recordDeath(username, score) {
    try {
      await this._q(
        `INSERT INTO stats (username, deaths, high_score) VALUES ($1, 1, $2)
         ON CONFLICT (username) DO UPDATE SET deaths = stats.deaths + 1, high_score = GREATEST(stats.high_score, $2)`,
        [username, Math.round(score)]
      );
    } catch {}
  }

  async recordKill(killerName, isHeadshot) {
    try {
      await this._q(
        `INSERT INTO stats (username, total_kills, headshots) VALUES ($1, 1, $2)
         ON CONFLICT (username) DO UPDATE SET total_kills = stats.total_kills + 1, headshots = stats.headshots + $2`,
        [killerName, isHeadshot ? 1 : 0]
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
      await this._q('UPDATE stats SET coins = coins + $2 WHERE username = $1', [username, amount]);
    } catch {}
  }

  async getCoins(username) {
    try {
      const r = await this._q('SELECT coins FROM stats WHERE username = $1', [username]);
      return r.rows.length > 0 ? (r.rows[0].coins || 0) : 0;
    } catch { return 0; }
  }

  async getUnlockedSkins(username) {
    try {
      const r = await this._q('SELECT unlocked_skins FROM stats WHERE username = $1', [username]);
      return r.rows.length > 0 ? (r.rows[0].unlocked_skins || '0,1,2,3') : '0,1,2,3';
    } catch { return '0,1,2,3'; }
  }

  async buySkin(username, skinId, price) {
    try {
      const r = await this._q('SELECT coins, unlocked_skins FROM stats WHERE username = $1', [username]);
      if (r.rows.length === 0) return { ok: false, msg: 'Account not found' };
      const s = r.rows[0];
      const coins = s.coins || 0;
      const skins = (s.unlocked_skins || '0,1,2,3').split(',').map(Number);
      if (skins.includes(skinId)) return { ok: false, msg: 'Already owned' };
      if (coins < price) return { ok: false, msg: 'Not enough coins' };
      skins.push(skinId);
      await this._q('UPDATE stats SET coins = coins - $2, unlocked_skins = $3 WHERE username = $1', [username, price, skins.join(',')]);
      return { ok: true, coins: coins - price, unlockedSkins: skins.join(',') };
    } catch (e) { console.error('[db] buySkin:', e.message); return { ok: false, msg: 'Database error' }; }
  }

  async claimDaily(username) {
    try {
      const r = await this._q('SELECT daily_claimed_at FROM stats WHERE username = $1', [username]);
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
      await this._q('UPDATE stats SET coins = coins + 50, daily_claimed_at = $2 WHERE username = $1', [username, now]);
      const newCoins = await this.getCoins(username);
      return { ok: true, coins: newCoins };
    } catch (e) { console.error('[db] claimDaily:', e.message); return { ok: false, msg: 'Database error' }; }
  }

  async resetAllShopData() {
    if (!this.pool) return;
    try {
      await this._q('UPDATE stats SET coins = 0, unlocked_skins = \'0,1,2,3\', daily_claimed_at = 0');
    } catch {}
  }
}
