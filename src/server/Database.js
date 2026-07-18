import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { filterName } from '../shared/filter.js';

const DATA_DIR = join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const STATS_FILE = join(DATA_DIR, 'stats.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJSON(file, data) {
  ensureDataDir();
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export class Database {
  constructor() {
    ensureDataDir();
    this.users = loadJSON(USERS_FILE, {});   // username -> { passwordHash, salt, createdAt }
    this.stats = loadJSON(STATS_FILE, {});   // username -> { highScore, totalKills, headshots, gamesPlayed, deaths }
    this.tokens = new Map();                  // token -> { username, expiresAt }
  }

  _saveUsers() { saveJSON(USERS_FILE, this.users); }
  _saveStats() { saveJSON(STATS_FILE, this.stats); }

  register(username, password) {
    const name = filterName(username);
    if (!name) return { ok: false, msg: 'Inappropriate username' };
    if (name.length < 2 || name.length > 16) return { ok: false, msg: 'Name must be 2-16 characters' };
    if (password.length < 4) return { ok: false, msg: 'Password must be 4+ characters' };
    if (this.users[name]) return { ok: false, msg: 'Username already taken' };

    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    this.users[name] = { passwordHash: hash, salt, createdAt: Date.now() };
    this.stats[name] = { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0 };
    this._saveUsers();
    this._saveStats();

    const token = this._createToken(name);
    return { ok: true, token, username: name };
  }

  login(username, password) {
    const name = username.trim().toLowerCase();
    const user = this.users[name];
    if (!user) return { ok: false, msg: 'Account not found' };

    const hash = scryptSync(password, user.salt, 64).toString('hex');
    const match = timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
    if (!match) return { ok: false, msg: 'Wrong password' };

    const token = this._createToken(name);
    return { ok: true, token, username: name };
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
    this.tokens.set(token, { username, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }); // 30 days
    return token;
  }

  getStats(username) {
    return this.stats[username] || { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0 };
  }

  recordGame(username) {
    if (!this.stats[username]) this.stats[username] = { highScore: 0, totalKills: 0, headshots: 0, gamesPlayed: 0, deaths: 0 };
    this.stats[username].gamesPlayed++;
    this._saveStats();
  }

  recordDeath(username, score) {
    if (!this.stats[username]) return;
    this.stats[username].deaths++;
    if (score > this.stats[username].highScore) {
      this.stats[username].highScore = score;
    }
    this._saveStats();
  }

  recordKill(killerName, isHeadshot) {
    if (!this.stats[killerName]) return;
    this.stats[killerName].totalKills++;
    if (isHeadshot) this.stats[killerName].headshots++;
    this._saveStats();
  }

  getLeaderboard() {
    return Object.entries(this.stats)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.highScore - a.highScore)
      .slice(0, 50);
  }
}
