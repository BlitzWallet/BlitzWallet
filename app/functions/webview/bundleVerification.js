import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { randomBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';

/**
 * Verifies the bundled HTML, injects a nonce, and writes a verified version to cache.
 */
export async function verifyAndPrepareWebView(bundleSource) {
  try {
    let html;
    let fileUri;

    const expectedHash = process.env.WEBVIEW_BUNDLE_HASH;

    // Load HTML
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

    // Compute hash
    /**
     * Note: Uses MD5 for performance (native, non-blocking).
     * While MD5 has known collision vulnerabilities, second-preimage attacks
     * (finding a different file with the same hash) remain computationally
     * infeasible. The runtime nonce-based handshake provides additional
     * verification that the bundle is legitimate.
     */
    const info = await FileSystem.getInfoAsync(fileUri, { md5: true });
    const hashHex = info.md5;

    if (hashHex !== expectedHash)
      throw new Error('Bundle has been tampered with, Stop,.');

    // Generate nonce and inject
    const nonceBytes = randomBytes(16);
    const nonceHex = Buffer.from(nonceBytes).toString('hex');
    const nonceRegex =
      /(window\.__STARTUP_NONCE__\s*=\s*["'])__INJECT_NONCE__(["'])/g;
    const injectedHtml = html.replace(nonceRegex, `$1${nonceHex}$2`);

    const verifiedPath = `${FileSystem.cacheDirectory}verified_webview.html`;
    await FileSystem.writeAsStringAsync(verifiedPath, injectedHtml, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return { htmlPath: verifiedPath, nonceHex, hashHex };
  } catch (error) {
    console.error('[WebView] Verification failed:', error);
    throw error;
  }
}
