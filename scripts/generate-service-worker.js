const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Netlify config, export metadata, the legacy kill switch (it must always come
// from the network) and the worker itself are never precached.
const EXCLUDED_FILES = new Set([
  '_headers',
  '_redirects',
  'metadata.json',
  'sw.js',
  'service-worker.js',
]);
const VERSION_MARKER = '__CACHE_VERSION__';
const MANIFEST_MARKER = '/* __PRECACHE_MANIFEST__ */ {}';

const sha256 = data => createHash('sha256').update(data).digest('hex');

// The pathname a browser requests for an exported file. URL parsing encodes it
// exactly like a real request; encodeURIComponent would turn `@` (in
// `@react-navigation` and `icon@2x.png`) into %40, which never matches.
function requestPath(file) {
  const relative = file.split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  return new URL(relative, 'https://x/').pathname;
}

function fill(template, marker, value) {
  if (!template.includes(marker)) {
    throw new Error(`Service worker template is missing ${marker}`);
  }
  return template.replace(marker, () => value);
}

function generateServiceWorker(directory) {
  const manifest = {};
  for (const file of fs.readdirSync(directory, { recursive: true }).sort()) {
    const absolute = path.join(directory, file);
    if (EXCLUDED_FILES.has(file) || !fs.statSync(absolute).isFile()) continue;
    manifest[requestPath(file)] = sha256(fs.readFileSync(absolute));
  }
  if (!manifest['/']) throw new Error('Web export contains no index.html');

  const template = fs.readFileSync(
    path.join(__dirname, 'service-worker.template.js'),
    'utf8',
  );
  const serialized = JSON.stringify(manifest);
  const worker = fill(
    fill(template, VERSION_MARKER, sha256(template + serialized)),
    MANIFEST_MARKER,
    serialized,
  );
  fs.writeFileSync(path.join(directory, 'service-worker.js'), worker);
  return Object.keys(manifest).length;
}

if (require.main === module) {
  const count = generateServiceWorker(path.resolve(process.argv[2] || 'dist'));
  console.log(`Generated service worker to precache ${count} files.`);
}

module.exports = { generateServiceWorker };
