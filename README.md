# slither.clone

A from-scratch clone of [Slither.io](http://slither.io) — authoritative Node.js + WebSocket server, Canvas browser client, and AI bots that populate the world so it's always playable.

![arch](https://img.shields.io/badge/arch-node%20%2B%20ws%20%2B%20canvas-blue) ![no build](https://img.shields.io/badge/build-none-success)

## Quick start

```bash
cd slither
npm install      # installs only 'ws'
npm start        # serves the client + game server on http://localhost:3000
```

Open **http://localhost:3000** in one or more browser tabs. Bots auto-populate the
world, so even a single tab is a full game. Open multiple tabs / share the URL
with anyone on your LAN to play together.

## Controls

| Action | Key / Input |
|---|---|
| Steer | Move the **mouse** (snake turns toward the cursor) |
| Boost | Hold **Left Mouse** or **Space** (or **Right Mouse**) |
| Respawn | **Enter** on the death screen, or click *Play Again* |
| Toggle low graphics | **G** |
| Touch | Drag to steer, on-screen **BOOST** button |

Boosting trades length for speed and drops food behind you — you can't boost
when very small.

## How to play

- Eat the glowing food pellets to grow longer and thicker.
- If **your head** touches **another snake's body** (or the red world border),
  you die and your body bursts into high-value food.
- Force other snakes to crash into *you* by cutting across their path — the
  classic Slither kill. Encircling prey is the highest-leverage play.
- Your length and live rank are shown top-left; the top-10 leaderboard and a
  minimap are top-right / bottom-right.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP + WebSocket port |
| `BOT_COUNT` | `28` | Number of AI snakes keeping the world full |

Example: `BOT_COUNT=50 PORT=8080 npm start` (Linux/macOS) or, on Windows cmd,
`set BOT_COUNT=50 && set PORT=8080 && npm start`.

## Features

- Authoritative server simulation at a fixed 20 Hz tick (deterministic, no
  client trust — input is validated/clamped server-side).
- Compact **binary** WebSocket protocol (custom DataView reader/writer, no JSON
  in the hot path). Per-client view culling so bandwidth scales with what's
  on screen, not with world size.
- Mouse-steered turning with a max turn rate; length & thickness scale with
  score; boost costs length and drops food.
- Body-collision, head-to-head, and border death; dead snakes become food.
- **AI bots** with a layered brain: avoid bodies/borders, flee bigger snakes,
  hunt (cut off) smaller ones, seek food clusters, wander. They respawn on
  death, so the world stays alive.
- Circular world with a visible boundary; spawn protection on (re)entry.
- 11 skins (including an animated rainbow snake), nickname entry.
- Live leaderboard (top 10 + your rank), minimap, length/score/FPS/ping HUD.
- Start menu, death/respawn screen, "connecting" banner, low-graphics toggle.
- Performance-first rendering: one thick rounded path-stroke per snake (not
  per-segment circles), pre-rendered cached food sprites, viewport culling,
  capped device-pixel-ratio.
- Resilient server: malformed binary frames are dropped (never crash), idle
  clients time out, disconnects always clean the snake up into food, tick
  errors are caught so the server never tears down.

## Project layout

```
slither/
├── package.json
├── README.md
└── src/
    ├── shared/                 # isomorphic — used by client AND server
    │   ├── constants.js        # all tunables in one place
    │   ├── colors.js           # skins + food palette
    │   ├── math.js             # clamp/lerp/angle/dist helpers
    │   └── protocol.js         # binary encode/decode of every wire frame
    ├── server/
    │   ├── server.js           # HTTP static + WebSocket bootstrap
    │   ├── Room.js             # world: tick loop, collisions, broadcast
    │   ├── Snake.js            # entity: path, growth, boost, death
    │   ├── Player.js           # a human connection wrapping a Snake
    │   ├── Bot.js              # AI snake + brain
    │   ├── Food.js             # pellet store + spatial grid
    │   └── SpatialGrid.js      # uniform-grid spatial hash for O(1) queries
    └── client/
        ├── index.html
        ├── css/style.css
        └── js/
            ├── main.js         # entry: wires UI/Net/Game, key bindings
            ├── Net.js          # WebSocket + message decode
            ├── Game.js         # client loop, snapshot state, interpolation
            ├── Renderer.js     # canvas draw (perf-first)
            ├── Camera.js       # world<->screen + zoom-out with growth
            ├── Input.js        # mouse/touch/keyboard
            ├── Hud.js          # leaderboard, score, FPS, ping, minimap
            └── ui.js           # start menu, skin picker, death screen
```

## Architecture in one paragraph

The browser sends only steering input (desired angle + boost flag); the server
runs the entire authoritative simulation at 20 Hz — moving snakes, running bot
AI, resolving collisions via a spatial grid, killing snakes into food — and
broadcasts per-client, view-culled binary snapshots. The client keeps the latest
state per snake and interpolates the camera and head for smooth 60 fps rendering.
Humans and bots share the exact same code paths, so a bot is indistinguishable
from a player on the wire and in collision logic.

## Tech

- **Server:** Node.js (ES modules), [`ws`](https://github.com/websockets/ws) —
  the only dependency.
- **Client:** vanilla Canvas 2D + ES modules, no bundler, no framework.
- **Protocol:** hand-rolled binary frames over `DataView`.

## License

MIT — do whatever you like.
