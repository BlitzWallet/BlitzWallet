const fs = require('node:fs');
const path = require('node:path');
const {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} = require('node:crypto');

// PKCS#8 DER prefix for a raw 32-byte Ed25519 seed.
const ED25519_PKCS8_PREFIX = Buffer.from(
  '302e020100300506032b657004220420',
  'hex',
);

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

// The exact bytes covered by the offline Ed25519 signature. File keys are
// sorted so every signer and verifier builds identical bytes. Keep in sync
// with public/service-worker.js and app/functions/pwaRelease.web.js.
function sortedFiles(files) {
  const sorted = {};
  for (const key of Object.keys(files).sort()) sorted[key] = files[key];
  return sorted;
}

function canonicalReleaseString(release) {
  return JSON.stringify({
    id: release.id,
    appVersion: release.appVersion,
    minAppVersion: release.minAppVersion,
    files: sortedFiles(release.files),
  });
}

function cleanEnvValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

// The private half of SPARK_WEBVIEW_SIGNING_PUBKEY as a 32-byte hex seed. It
// never lives in the repo and is only read here at bundle time.
function readSigningSeed(options) {
  if (options.signingSeed) return Buffer.from(options.signingSeed);
  const hex = cleanEnvValue(process.env.SPARK_WEBVIEW_SIGNING_PRIVATE_KEY);
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('SPARK_WEBVIEW_SIGNING_PRIVATE_KEY must be 32-byte hex');
  }
  return Buffer.from(hex, 'hex');
}

function privateKeyFromSeed(seed) {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(seed)]),
    format: 'der',
    type: 'pkcs8',
  });
}

function publicHexFromSeed(seed) {
  const der = createPublicKey(privateKeyFromSeed(seed)).export({
    format: 'der',
    type: 'spki',
  });
  return Buffer.from(der.subarray(der.length - 32)).toString('hex');
}

// The worker's embedded key must match the public half of the signing key, or
// a same-origin writer could not be told apart from a real release. Fail the
// build on drift when the public key is configured.
function checkWorkerKeyMatches(publicHex) {
  const workerSource = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'service-worker.js'),
    'utf8',
  );
  const match = workerSource.match(
    /RELEASE_SIGNING_PUBKEY\s*=\s*['"]([0-9a-fA-F]+)['"]/,
  );
  if (match?.[1].toLowerCase() !== publicHex) {
    throw new Error(
      'Release signing key does not match RELEASE_SIGNING_PUBKEY in service-worker.js',
    );
  }
}

// Writes release.json, the file list public/service-worker.js serves once the
// user installs this release (see app/functions/pwaRelease.web.js).
function generateRelease(
  directory,
  appConfig = require('../app.json'),
  options = {},
) {
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

  const seed = readSigningSeed(options);
  if (!seed) {
    throw new Error(
      'SPARK_WEBVIEW_SIGNING_PRIVATE_KEY is not set; clients reject unsigned releases',
    );
  }
  // skipKeyChecks is test-only: a test keypair can never match the pinned key.
  if (!options.skipKeyChecks) {
    const publicHex = publicHexFromSeed(seed);
    checkWorkerKeyMatches(publicHex);
    const envPublicHex = cleanEnvValue(
      process.env.SPARK_WEBVIEW_SIGNING_PUBKEY,
    ).toLowerCase();
    if (envPublicHex && envPublicHex !== publicHex) {
      throw new Error(
        'Release signing key does not match SPARK_WEBVIEW_SIGNING_PUBKEY',
      );
    }
  }
  release.signature = sign(
    null,
    Buffer.from(canonicalReleaseString(release), 'utf8'),
    privateKeyFromSeed(seed),
  ).toString('hex');
  fs.writeFileSync(
    path.join(directory, 'release.json'),
    JSON.stringify(release),
  );
  return release;
}

if (require.main === module) {
  // Plain node never reads .env (only the babel build does). Shell values win.
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const release = generateRelease(path.resolve(process.argv[2] || 'dist'));
  console.log(
    `Generated release ${release.appVersion} (${release.id.slice(
      0,
      12,
    )}) with ${Object.keys(release.files).length} files${
      release.signature ? ' (signed)' : ' (UNSIGNED)'
    }.`,
  );
}

module.exports = { generateRelease };
