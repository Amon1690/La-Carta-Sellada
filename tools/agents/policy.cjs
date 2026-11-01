const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const MAX_FILES = 30;
const MAX_PATCH_BYTES = 300_000;

function allowedPath(file) {
  return typeof file === 'string' && !file.includes('\\') &&
    !file.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('.')) &&
    (file === 'README.md' || /^(src|public|docs)\//.test(file)) &&
    !/(^|\/)AGENTS(?:\.override)?\.md$/i.test(file) &&
    file !== 'docs/agents-workflow.md';
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2_000_000, ...options });
}

function inspectChanges() {
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  for (const file of untracked.filter(allowedPath)) git(['add', '--intent-to-add', '--', file]);
  const files = git(['diff', 'HEAD', '--name-only', '-z', '--no-renames']).split('\0').filter(Boolean);
  if (!files.length) throw new Error('La propuesta no contiene cambios.');
  if (files.length > MAX_FILES) throw new Error(`La propuesta supera ${MAX_FILES} archivos.`);
  for (const file of files) {
    if (!allowedPath(file)) throw new Error(`Archivo fuera de alcance: ${file}`);
    if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) {
      throw new Error(`Solo se admiten archivos normales: ${file}`);
    }
  }
  const patch = git(['diff', 'HEAD', '--no-ext-diff', '--no-renames', '--binary']);
  if (Buffer.byteLength(patch) > MAX_PATCH_BYTES) throw new Error('La propuesta supera 300 kB. Divide la tarea.');
  if (/^GIT binary patch$/m.test(patch) || /^.*mode (?:120000|160000|100755)$/m.test(patch)) {
    throw new Error('El piloto no admite binarios, enlaces ni cambios de modo.');
  }
  return { files, patch };
}

function readReview(file) {
  const review = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!['approve', 'changes_requested'].includes(review.verdict) ||
      typeof review.summary !== 'string' || !Array.isArray(review.findings) ||
      review.findings.some((f) => typeof f.file !== 'string' || !Number.isInteger(f.line) || f.line < 1 || typeof f.message !== 'string')) {
    throw new Error('La revisión no tiene un formato válido.');
  }
  if (review.verdict === 'approve' && review.findings.length) throw new Error('No se admite aprobar con hallazgos pendientes.');
  return review;
}

module.exports = { allowedPath, inspectChanges, readReview };
