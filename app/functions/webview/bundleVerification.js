import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import {
  randomBytes,
  verify,
  createPublicKey,
  createHash,
} from 'react-native-quick-crypto';

// Fixed ASN.1 SPKI header for a raw-32-byte Ed25519 public key (no secret).
const ED25519_SPKI_PREFIX = '302a300506032b6570032100';

// Integrity failures (bad/missing signature, nonce injection) are tamper: they
// justify persisting the FORCE_REACT_NATIVE kill-switch. Transient IO errors
// (disk read/write) are NOT tamper and must never persist it (S-5).
const tamperError = message =>
  Object.assign(new Error(message), { isTamper: true });

/**
 * Verifies the bundled HTML, injects a nonce, and writes a verified version to cache.
 */
export async function verifyAndPrepareWebView(bundleSource) {
  try {
    let html;
    let fileUri;

    // Load the HTML asset
    if (Platform.OS === 'ios') {
      const htmlAsset = Asset.fromModule(bundleSource);
      await htmlAsset.downloadAsync();
      html = await FileSystem.readAsStringAsync(htmlAsset.localUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      fileUri = htmlAsset.localUri;
    } else {
      fileUri = FileSystem.bundleDirectory + 'sparkContext.html';
      html = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    // Verify the bundle's Ed25519 signature against the pinned public key. The
    // signature is computed offline over sha256(canonical HTML) with the
    // signature slot holding the __SIGNATURE__ placeholder, so reconstruct those
    // exact bytes before hashing. The 5.3MB digest runs via JSI (quick-crypto)
    // so it never crosses the bridge as a string; Ed25519 then verifies just the
    // 32-byte digest. Runs before nonce injection, so the shipped bytes (with
    // __INJECT_NONCE__ intact) match what was signed.
    const SIG_META = /<meta name="blitz-webview-sig" content="([0-9a-f]{128})"/;
    const SIG_META_ANY = /<meta name="blitz-webview-sig" content="[0-9a-f]{128}"/g;
    const sigMatch = html.match(SIG_META);

    if (!sigMatch) throw tamperError('WebView bundle missing signature meta.');

    // Anchor verification to document structure: the signed slot must sit in
    // the head region at the top of the file so a valid signature can only
    // vouch for a document whose signing meta is where the signer put it,
    // never a variant with the meta relocated into the payload.
    const MAX_SIG_META_OFFSET = 1024;
    if (sigMatch.index > MAX_SIG_META_OFFSET) {
      throw tamperError(
        'Signature meta outside head region of WebView bundle.',
      );
    }

    const canonicalHtml = html.replace(
      /(<meta name="blitz-webview-sig" content=")[0-9a-f]{128}(")/,
      '$1__SIGNATURE__$2',
    );

    // Canonicalization must be lossless and unique: exactly one signature slot
    // (a planted literal would mean the signed bytes are ambiguous) and no
    // additional signature metas may survive substitution.
    const sigSlotCount = canonicalHtml.split('__SIGNATURE__').length - 1;
    const remainingSigMetas = (canonicalHtml.match(SIG_META_ANY) || []).length;
    if (sigSlotCount !== 1 || remainingSigMetas !== 0) {
      throw tamperError('WebView bundle has malformed signature slots.');
    }

    const digestHex = createHash('sha256')
      .update(canonicalHtml, 'utf8')
      .digest('hex');

    // sha256 must yield exactly 32 bytes; fail closed rather than trusting the
    // crypto library to reject a wrong-length buffer.
    const digest = Buffer.from(digestHex, 'hex');
    if (digest.length !== 32) {
      throw tamperError('Unexpected digest length for signature verification.');
    }

    const pubKey = createPublicKey({
      key: Buffer.concat([
        Buffer.from(ED25519_SPKI_PREFIX, 'hex'),
        Buffer.from(process.env.SPARK_WEBVIEW_SIGNING_PUBKEY, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });
    if (!verify(null, digest, pubKey, Buffer.from(sigMatch[1], 'hex'))) {
      throw tamperError('WebView bundle signature invalid — aborting.');
    }

    // Generate fresh nonce per load
    const nonceBytes = randomBytes(16);
    const nonceHex = Buffer.from(nonceBytes).toString('hex');

    if (!html.includes('__INJECT_NONCE__')) {
      throw tamperError('No __INJECT_NONCE__ placeholder found in HTML.');
    }

    // Census the placeholders before injecting so the post-conditions below can
    // prove every substitutable slot got the fresh nonce exactly once. Bare
    // __INJECT_NONCE__ literals used as runtime sentinels are never substituted
    // and must survive injection untouched.
    const NONCE_PLACEHOLDER_FORMS =
      /'nonce-__INJECT_NONCE__'|"nonce-__INJECT_NONCE__"|nonce="__INJECT_NONCE__"/g;
    const placeholderCount = (html.match(NONCE_PLACEHOLDER_FORMS) || []).length;
    const sentinelCount =
      html.split('__INJECT_NONCE__').length - 1 - placeholderCount;

    // Replace only CSP and attribute placeholders, counting the slots actually
    // rewritten so completeness never depends on guessing whether the random
    // nonce value collides with unrelated bytes in the document.
    let injectedCount = 0;
    let injectedHtml = html.replace(
      NONCE_PLACEHOLDER_FORMS,
      match => {
        injectedCount += 1;
        return match.replace('__INJECT_NONCE__', nonceHex);
      },
    );

    // Ensure placeholders were replaced
    if (
      !injectedHtml.includes(`nonce="${nonceHex}"`) ||
      !injectedHtml.includes(`'nonce-${nonceHex}'`)
    ) {
      throw tamperError(
        'Nonce injection failed (meta or script attribute missing).',
      );
    }

    // Injection completeness: every censused slot was rewritten exactly once,
    // no substitutable placeholder survives, and no placeholder text was added
    // or removed anywhere else in the document.
    const leftoverPlaceholders = (
      injectedHtml.match(NONCE_PLACEHOLDER_FORMS) || []
    ).length;
    const leftoverSentinels = injectedHtml.split('__INJECT_NONCE__').length - 1;
    if (
      injectedCount !== placeholderCount ||
      leftoverPlaceholders !== 0 ||
      leftoverSentinels !== sentinelCount
    ) {
      throw tamperError('Nonce injection incomplete or malformed.');
    }

    // Write verified + nonce-injected HTML to cache
    const verifiedPath = `${FileSystem.cacheDirectory}verified_webview.html`;
    await FileSystem.writeAsStringAsync(verifiedPath, injectedHtml, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return { htmlPath: verifiedPath, nonceHex };
  } catch (error) {
    console.error('[WebView] Verification failed:', error);
    throw error;
  }
}
