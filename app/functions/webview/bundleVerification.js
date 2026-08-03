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
    const sigMatch = html.match(SIG_META);

    if (!sigMatch) throw new Error('WebView bundle missing signature meta.');

    const canonicalHtml = html.replace(
      /(<meta name="blitz-webview-sig" content=")[0-9a-f]{128}(")/,
      '$1__SIGNATURE__$2',
    );

    const digestHex = createHash('sha256')
      .update(canonicalHtml, 'utf8')
      .digest('hex');

    const pubKey = createPublicKey({
      key: Buffer.concat([
        Buffer.from(ED25519_SPKI_PREFIX, 'hex'),
        Buffer.from(process.env.SPARK_WEBVIEW_SIGNING_PUBKEY, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });
    if (
      !verify(
        null,
        Buffer.from(digestHex, 'hex'),
        pubKey,
        Buffer.from(sigMatch[1], 'hex'),
      )
    ) {
      throw new Error('WebView bundle signature invalid — aborting.');
    }

    // Generate fresh nonce per load
    const nonceBytes = randomBytes(16);
    const nonceHex = Buffer.from(nonceBytes).toString('hex');

    if (!html.includes('__INJECT_NONCE__')) {
      throw new Error('No __INJECT_NONCE__ placeholder found in HTML.');
    }

    // Replace only CSP and attribute placeholders
    let injectedHtml = html
      .replace(/'nonce-__INJECT_NONCE__'/g, `'nonce-${nonceHex}'`)
      .replace(/"nonce-__INJECT_NONCE__"/g, `"nonce-${nonceHex}"`)
      .replace(/nonce="__INJECT_NONCE__"/g, `nonce="${nonceHex}"`);

    // Ensure placeholders were replaced
    if (
      !injectedHtml.includes(`nonce="${nonceHex}"`) ||
      !injectedHtml.includes(`'nonce-${nonceHex}'`)
    ) {
      throw new Error(
        'Nonce injection failed (meta or script attribute missing).',
      );
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
