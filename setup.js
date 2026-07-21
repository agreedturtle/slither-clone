import { mkdirSync, existsSync, renameSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
console.log('[setup] Root:', root);
console.log('[setup] Files at root:', readdirSync(root).filter(f => !f.startsWith('.') && f !== 'node_modules'));

function moveSafe(src, dest) {
  try {
    if (existsSync(src) && statSync(src).isFile()) {
      renameSync(src, dest);
      console.log('[setup] Moved:', src, '->', dest);
    }
  } catch (e) {
    console.log('[setup] Move failed:', src, e.message);
  }
}

function mkdirp(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// If src/server already exists and has files, we're good
if (existsSync(join(root, 'src', 'server', 'server.js'))) {
  console.log('[setup] Already set up.');
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

// Check result
console.log('[setup] src/server contents:', existsSync(join(root, 'src', 'server')) ? readdirSync(join(root, 'src', 'server')) : 'MISSING');
