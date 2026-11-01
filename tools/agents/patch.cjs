const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectChanges } = require('./policy.cjs');

const [mode, directory] = process.argv.slice(2);
if (!directory || !['export', 'apply'].includes(mode)) throw new Error('Uso: patch.cjs export|apply DIRECTORIO');
const patchFile = path.join(directory, 'changes.patch');
if (mode === 'apply') {
  if (fs.statSync(patchFile).size > 300_000) throw new Error('Parche demasiado grande.');
  execFileSync('git', ['apply', '--check', patchFile], { stdio: 'inherit' });
  execFileSync('git', ['apply', patchFile], { stdio: 'inherit' });
  inspectChanges();
} else {
  const { patch } = inspectChanges();
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(patchFile, patch);
}
