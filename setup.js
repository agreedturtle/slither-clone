import { mkdirSync, existsSync, renameSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function moveSafe(src, dest) {
  try {
    if (existsSync(src) && statSync(src).isFile()) {
      const dir = join(dest, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      renameSync(src, dest);
      console.log('[setup] Moved:', src, '->', dest);
    }
  } catch (e) {
    console.log('[setup] Move failed:', src, e.message);
  }
}

// Check if already set up
if (existsSync(join(root, 'src', 'server', 'server.js'))) {
  console.log('[setup] Already set up.');
  process.exit(0);
}

// The Windows zip creates files with backslash paths like src\server\server.js
// We need to find these and move them to proper directories
const allFiles = readdirSync(root, { withFileTypes: false });

for (const name of allFiles) {
  if (typeof name !== 'string' && !name.name) continue;
  const fileName = typeof name === 'string' ? name : name.name;

  // Check for Windows-style backslash paths
  if (fileName.includes('\\')) {
    const parts = fileName.split('\\');
    const destPath = join(root, ...parts);
    const destDir = join(destPath, '..');
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    moveSafe(join(root, fileName), destPath);
  }
}

// Also try the normal path
if (existsSync(join(root, 'src', 'server', 'server.js'))) {
  console.log('[setup] Setup complete!');
  console.log('[setup] src/server:', readdirSync(join(root, 'src', 'server')));
} else {
  console.log('[setup] src/server/server.js still missing after setup!');
  console.log('[setup] Root contents:', readdirSync(root).filter(f => !f.startsWith('.')));
}
