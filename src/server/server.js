// ===========================================================================
// server.js — bootstrap: HTTP static server + WebSocket gateway.
//
//   npm start  ->  http://localhost:3000
//
// Serves the client from src/client/ and upgrades WebSocket connections to a
// single authoritative Room. Robust: malformed binary frames are dropped (never
// crash), idle connections time out, and disconnects always clean up snakes.
// ===========================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { WebSocketServer } from 'ws';

import { Room } from './Room.js';
import { Database } from './Database.js';
import {
  decodeClientMessage, C2S,
  encodeAuthResult, encodeProfileData,
} from '../shared/protocol.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const SHARED_DIR = path.join(__dirname, '..', 'shared'); // served at /shared/*

const PORT = Number(process.env.PORT) || 3000;
const IDLE_TIMEOUT_MS = 60000; // drop clients we haven't heard from in 60s

// --- MIME types for static serving -----------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

const MIME_FALLBACK = 'application/octet-stream';

function safeJoin(base, target) {
  const p = path.normalize(path.join(base, target));
  // Prevent path traversal outside CLIENT_DIR.
  if (!p.startsWith(base)) return null;
  return p;
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Route by prefix: /shared/* -> src/shared, everything else -> src/client.
  // The browser resolves client-side `../../shared/x.js` imports (from /js/*)
  // to /shared/x.js, so shared modules load correctly without a bundler.
  let baseDir;
  if (urlPath === '/shared' || urlPath.startsWith('/shared/')) {
    baseDir = SHARED_DIR;
    urlPath = urlPath.slice('/shared'.length) || '/';
    if (urlPath === '') urlPath = '/';
  } else {
    baseDir = CLIENT_DIR;
  }

  const filePath = safeJoin(baseDir, urlPath);
  if (!filePath) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || MIME_FALLBACK,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// --- HTTP server ------------------------------------------------------------
const httpServer = http.createServer(serveStatic);

// --- WebSocket server -------------------------------------------------------
const wss = new WebSocketServer({ server: httpServer, path: '/' });
const room = new Room();
const db = new Database();
room.db = db; // attach database to room for stat tracking

const idleTimers = new WeakMap(); // ws -> timer

function bumpIdle(ws) {
  let t = idleTimers.get(ws);
  if (t) clearTimeout(t);
  t = setTimeout(() => {
    try { ws.close(4000, 'idle timeout'); } catch (_) { /* ignore */ }
  }, IDLE_TIMEOUT_MS);
  if (t.unref) t.unref();
  idleTimers.set(ws, t);
}

wss.on('connection', (ws) => {
  const player = room.addPlayer(ws);
  bumpIdle(ws);

  ws.on('message', (data, isBinary) => {
    bumpIdle(ws);
    // Only accept binary Uint8Array messages.
    let u8;
    if (Buffer.isBuffer(data)) u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else if (data instanceof ArrayBuffer) u8 = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else { return; } // ignore strings

    const msg = decodeClientMessage(u8);
    if (!msg) return; // malformed -> silently drop

    player.touch();
    try {
      switch (msg.op) {
        case C2S.JOIN:    room.handleJoin(player, msg); break;
        case C2S.INPUT:   room.handleInput(player, msg); break;
        case C2S.RESPAWN: room.handleRespawn(player); break;
        case C2S.PING:    room.handlePing(player, msg); break;
        case C2S.ADMIN:   room.handleAdmin(player, msg); break;
        case C2S.MULTIPLIER: room.handleMultiplier(player); break;
        case C2S.CHAT:       room.handleChat(player, msg); break;
        case C2S.LEADERBOARD_ALLTIME: room.handleLeaderboardAlltime(player); break;
        case C2S.LOGIN: {
          db.login(msg.username, msg.password).then(result => {
            try {
              const resp = encodeAuthResult(result.ok, result.msg || '', result.token || '', result.username || '');
              ws.send(resp);
            } catch (_) {}
            if (result.ok) {
              player.username = result.username;
              db.getStats(result.username).then(s => { player.stats = s; });
            }
          });
          break;
        }
        case C2S.REGISTER: {
          db.register(msg.username, msg.password).then(result => {
            try {
              const resp = encodeAuthResult(result.ok, result.msg || '', result.token || '', result.username || '');
              ws.send(resp);
            } catch (_) {}
            if (result.ok) {
              player.username = result.username;
              db.getStats(result.username).then(s => { player.stats = s; });
            }
          });
          break;
        }
        case C2S.AUTH_TOKEN: {
          db.validateToken(msg.token).then(username => {
            if (username) {
              player.username = username;
              db.getStats(username).then(s => { player.stats = s; });
              try {
                const resp = encodeAuthResult(true, '', msg.token, username);
                ws.send(resp);
              } catch (_) {}
            } else {
              try {
                const resp = encodeAuthResult(false, 'Invalid or expired token', '', '');
                ws.send(resp);
              } catch (_) {}
            }
          });
          break;
        }
        case C2S.PROFILE: {
          if (player.username) {
            db.getStats(player.username).then(stats => {
              try { ws.send(encodeProfileData({ username: player.username, ...stats })); } catch (_) {}
            });
          }
          break;
        }
        default: break;
      }
    } catch (err) {
      console.error('[ws] handler error:', err);
    }
  });

  ws.on('close', () => {
    const t = idleTimers.get(ws);
    if (t) clearTimeout(t);
    idleTimers.delete(ws);
    room.removePlayer(ws);
  });

  ws.on('error', () => { /* swallow; close handler will clean up */ });
});

// --- Go ---------------------------------------------------------------------
async function start() {
  await db.ready;
  httpServer.listen(PORT, () => {
    console.log(`\n  Slither clone running:\n    http://localhost:${PORT}\n`);
    console.log(`  World: humans + ${botCount()} bots. Open multiple tabs to play together.\n`);
  });
}
start();

function botCount() {
  const c = Number(process.env.BOT_COUNT);
  return Number.isFinite(c) && c > 0 ? c : 28;
}
