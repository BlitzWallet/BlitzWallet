const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Netlify config, export metadata, the legacy kill switch (it must always come
// from the network), the worker itself and the release file are never cached.
const EXCLUDED_FILES = new Set([
  '_headers',
  '_redirects',
  'metadata.json',
  'sw.js',
  'service-worker.js',
  'release.json',
]);

const sha256 = data => createHash('sha256').update(data).digest('hex');

// The pathname a browser requests for an exported file. URL parsing encodes it
// exactly like a real request; encodeURIComponent would turn `@` (in
// `@react-navigation` and `icon@2x.png`) into %40, which never matches.
function requestPath(file) {
  const relative = file.split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  return new URL(relative, 'https://x/').pathname;
}

// Writes release.json, the file list public/service-worker.js serves once the
// user installs this release (see app/functions/pwaRelease.web.js).
function generateRelease(directory, appConfig = require('../app.json')) {
  const files = {};
  for (const file of fs.readdirSync(directory, { recursive: true }).sort()) {
    const absolute = path.join(directory, file);
    if (EXCLUDED_FILES.has(file) || !fs.statSync(absolute).isFile()) continue;
    files[requestPath(file)] = sha256(fs.readFileSync(absolute));
  }
  if (!files['/']) throw new Error('Web export contains no index.html');

  const release = {
    id: sha256(JSON.stringify(files)),
    appVersion: appConfig.version,
    // Installs older than this must update before opening the wallet.
    minAppVersion: appConfig.extra?.minWebAppVersion ?? '0.0.0',
    files,
  };
  fs.writeFileSync(
    path.join(directory, 'release.json'),
    JSON.stringify(release),
  );
  return release;
}

if (require.main === module) {
  const release = generateRelease(path.resolve(process.argv[2] || 'dist'));
  console.log(
    `Generated release ${release.appVersion} (${release.id.slice(
      0,
      12,
    )}) with ${Object.keys(release.files).length} files.`,
  );
}

module.exports = { generateRelease };
