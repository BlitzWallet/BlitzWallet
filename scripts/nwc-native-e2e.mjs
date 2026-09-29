// End-to-end check of the native Android NWC handler on a booted emulator /
// device running a DEBUG build (it uses the debug-only NwcDebugPushReceiver).
//
//   node scripts/nwc-native-e2e.mjs "nostr+walletconnect://…" [--js] [--warm] [--pay <bolt11>]
//
// For each NIP-47 request it: kills the app (terminated state), signs + encrypts
// a real request with the connection secret, injects it as the FCM push body the
// backend sends, and waits for the wallet's kind 23195 response on the relay.
// --js routes the same pushes through the previous RNFirebase headless-JS path
// for a before/after comparison. Writes e2e-artifacts/nwc-native/<run>.json and
// the matching logcat, and exits non-zero if any expectation failed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { finalizeEvent, getPublicKey, nip44, Relay } from 'nostr-tools';

const args = process.argv.slice(2);
const flag = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const uri = args.find(a => a.startsWith('nostr+walletconnect://'));
if (!uri) {
  console.error('usage: node scripts/nwc-native-e2e.mjs "nostr+walletconnect://…" [--js] [--warm] [--pay <bolt11>]');
  process.exit(2);
}
const jsPath = args.includes('--js');
const warm = args.includes('--warm');
const payInvoice = flag('--pay');

const parseUri = connection => {
  const url = new URL(connection.replace('nostr+walletconnect://', 'https://'));
  const walletSecret = Buffer.from(url.searchParams.get('secret'), 'hex');
  return {
    walletPubkey: url.hostname,
    relayUrl: url.searchParams.get('relay'),
    secret: walletSecret,
    conversationKey: nip44.getConversationKey(walletSecret, url.hostname),
  };
};
const { walletPubkey, relayUrl, secret, conversationKey } = parseUri(uri);
const clientPubkey = getPublicKey(secret);
const PKG = 'com.blitzwallet';

const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildPush(method, params) {
  const event = finalizeEvent(
    {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', walletPubkey], ['encryption', 'nip44_v2']],
      content: nip44.encrypt(JSON.stringify({ method, params }), conversationKey),
    },
    secret,
  );
  // Same shape NWC-Backend processBulkNotifications forwards.
  const body = JSON.stringify({
    count: 1,
    events: [{
      id: event.id,
      content: event.content,
      kind: event.kind,
      timestamp: Date.now(),
      clientPubKey: event.pubkey,
      pubkey: walletPubkey,
      created_at: event.created_at,
      tags: event.tags,
      sig: event.sig,
    }],
  });
  return { event, body };
}

function inject(body) {
  // A high-priority FCM message puts the app on the temporary allowlist.
  adb('shell', 'cmd', 'deviceidle', 'tempwhitelist', '-d', '30000', PKG);
  adb('shell', 'am', 'broadcast', '-n', `${PKG}/.nwc.NwcDebugPushReceiver`,
    '--es', 'body64', Buffer.from(body).toString('base64'), ...(jsPath ? ['--ez', 'js', 'true'] : []));
}

async function waitForResponse(relay, eventId, timeoutMs) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { sub.close(); resolve(null); }, timeoutMs);
    const sub = relay.subscribe(
      [{ kinds: [23195], authors: [walletPubkey], '#e': [eventId] }],
      {
        onevent(ev) {
          clearTimeout(timer);
          sub.close();
          resolve(JSON.parse(nip44.decrypt(ev.content, conversationKey)));
        },
      },
    );
  });
}

const cases = [
  { method: 'get_info', params: {}, expect: r => r.result?.methods?.includes('get_info') },
  { method: 'get_balance', params: {}, expect: r => Number.isInteger(r.result?.balance) },
  { method: 'make_invoice', params: { amount: 1000, description: 'blitz native nwc e2e' }, expect: r => r.result?.invoice?.startsWith('lnbc') },
  { method: 'lookup_invoice', params: null, expect: r => r.result?.state === 'pending' || r.result?.state === 'settled' },
  { method: 'list_transactions', params: { limit: 3 }, expect: r => Array.isArray(r.result?.transactions) },
  ...(payInvoice ? [{ method: 'pay_invoice', params: { invoice: payInvoice }, expect: r => typeof r.result?.preimage === 'string' }] : []),
];

const runId = `${jsPath ? 'js' : 'native'}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const outDir = path.join('e2e-artifacts', 'nwc-native');
fs.mkdirSync(outDir, { recursive: true });

const relay = await Relay.connect(relayUrl);
adb('logcat', '-c');
const results = [];
let invoice = null;

for (const testCase of cases) {
  if (!warm) {
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
    adb('shell', 'am', 'kill', PKG);
    await sleep(1500);
  }
  const params = testCase.method === 'lookup_invoice' ? { invoice } : testCase.params;
  const { event, body } = buildPush(testCase.method, params);
  const started = Date.now();
  const response = waitForResponse(relay, event.id, 60_000);
  inject(body);
  const result = await response;
  const ms = Date.now() - started;
  if (testCase.method === 'make_invoice') invoice = result?.result?.invoice;
  const ok = !!result && !result.error && testCase.expect(result);
  results.push({ method: testCase.method, ok, ms, response: result });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${testCase.method} ${ms} ms`, result?.error ?? '');

  if (testCase.method === 'get_info') {
    // Duplicate delivery of the same push must not be processed twice.
    const again = waitForResponse(relay, event.id, 15_000);
    await sleep(500);
    inject(body);
    const duplicate = await again;
    const dupOk = duplicate === null;
    results.push({ method: 'get_info (duplicate push)', ok: dupOk, response: duplicate });
    console.log(`${dupOk ? 'PASS' : 'FAIL'} duplicate push ignored`);
  }
}
relay.close();

const logcat = adb('logcat', '-d', '-v', 'time');
fs.writeFileSync(path.join(outDir, `${runId}.logcat.txt`), logcat);
const reactNativeStarted = /ReactNativeJS|HeadlessJsTaskService|ReactNativeFirebaseMessagingHeadlessService/.test(logcat);
const nativeTimings = [...logcat.matchAll(/BlitzNwcNative.*?: (.*(?:ms|ready).*)/g)].map(m => m[1]);
if (!jsPath) {
  results.push({ method: 'React Native never started', ok: !reactNativeStarted });
  console.log(`${reactNativeStarted ? 'FAIL' : 'PASS'} React Native never started`);
}

const summary = {
  runId,
  path: jsPath ? 'js-headless (previous)' : 'native',
  device: adb('shell', 'getprop', 'ro.product.model'),
  results,
  nativeTimings,
  reactNativeStarted,
};
fs.writeFileSync(path.join(outDir, `${runId}.json`), JSON.stringify(summary, null, 2));
console.log(`artifact: ${path.join(outDir, `${runId}.json`)}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
