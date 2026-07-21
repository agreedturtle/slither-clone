import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Normal path
const normalPath = join(__dirname, 'src', 'server', 'server.js');
if (existsSync(normalPath)) {
  console.log('[index] Found at:', normalPath);
  await import('./src/server/server.js');
} else {
  console.error('[index] server.js not at expected path, searching...');
  console.error('[index] Root listing:', readdirSync(__dirname).filter(f => !f.startsWith('.')));
  process.exit(1);
}
