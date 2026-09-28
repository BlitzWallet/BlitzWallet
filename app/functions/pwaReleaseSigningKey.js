// Pinned release-signing public key (hex) for PWA releases (W-07).
//
// Split out of pwaRelease.web.js so Jest can mock it: the react-native-dotenv
// babel plugin inlines process.env values at transform time, which would
// otherwise make the test keypair unusable. Same keypair as the WebView bundle
// (SPARK_WEBVIEW_SIGNING_PUBKEY); the private half never leaves the offline
// signer (see scripts/generate-release.js).

export function getReleaseSigningPubkeyHex() {
  return String(process.env.SPARK_WEBVIEW_SIGNING_PUBKEY ?? '').replace(
    /^['"]|['"]$/g,
    '',
  );
}
