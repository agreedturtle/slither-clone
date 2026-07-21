import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try the normal path first
const normalPath = join(__dirname, 'src', 'server', 'server.js');
if (existsSync(normalPath)) {
  await import('./src/server/server.js');
} else {
  // Search for server.js recursively
  function findServer(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory() && entry !== 'node_modules' && entry !== '.git') {
          const result = findServer(full);
          if (result) return result;
        } else if (entry === 'server.js' && full.includes('server')) {
          return full;
        }
      } catch (_) {}
    }
    return null;
  }
  const found = findServer(__dirname);
  if (found) {
    console.log('[index] Found server at:', found);
    await import('file://' + found);
  } else {
    console.error('[index] Could not find server.js anywhere!');
    console.error('[index] Directory listing:', readdirSync(__dirname));
    process.exit(1);
  }
}
