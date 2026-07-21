import { mkdirSync, existsSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function moveSafe(src, dest) {
  try {
    if (existsSync(src) && statSync(src).isFile()) {
      renameSync(src, dest);
    }
  } catch (_) {}
}

function mkdirp(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// If src/server already exists, we're good
if (existsSync(join(root, 'src', 'server', 'server.js'))) {
  process.exit(0);
}

mkdirp(join(root, 'src', 'server'));
mkdirp(join(root, 'src', 'shared'));
mkdirp(join(root, 'src', 'client', 'css'));
mkdirp(join(root, 'src', 'client', 'js'));

// Server files
for (const f of ['server.js','Room.js','Snake.js','Bot.js','Food.js','Player.js','Database.js','SpatialGrid.js']) {
  moveSafe(join(root, f), join(root, 'src', 'server', f));
}

// Shared files
for (const f of ['colors.js','constants.js','gameConfig.js','math.js','protocol.js','filter.js']) {
  moveSafe(join(root, f), join(root, 'src', 'shared', f));
}

// Client JS files
for (const f of ['main.js','AdminPanel.js','Camera.js','Game.js','Hud.js','Input.js','Net.js','Renderer.js','Shop.js','ui.js']) {
  moveSafe(join(root, f), join(root, 'src', 'client', 'js', f));
}

// Client CSS
moveSafe(join(root, 'style.css'), join(root, 'src', 'client', 'css', 'style.css'));

// Client HTML
moveSafe(join(root, 'index.html'), join(root, 'src', 'client', 'index.html'));

console.log('[setup] Directory structure created.');
