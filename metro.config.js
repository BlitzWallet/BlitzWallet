const {getDefaultConfig} = require('expo/metro-config');
const {mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const shim = p => path.resolve(__dirname, 'web-shims', p);
const EMPTY_NATIVE = shim('empty-native-module.js');

// Web-only module substitutions. Applied in resolveRequest before the default
// resolver so the browser bundle never pulls a native-only package. This is
// the mechanism that lets the ~400 RN UI files build unchanged.
const WEB_STUBS = {
  'react-native-quick-crypto': shim('quick-crypto.js'),
  crypto: shim('quick-crypto.js'),
  '@react-native-firebase/app': shim('firebase-app.js'),
  '@react-native-firebase/auth': shim('firebase-auth.js'),
  '@react-native-firebase/firestore': shim('firebase-firestore.js'),
  '@react-native-firebase/functions': shim('firebase-functions.js'),
  '@react-native-firebase/storage': shim('firebase-storage.js'),
  '@react-native-firebase/crashlytics': shim('firebase-crashlytics.js'),
  '@react-native-firebase/messaging': shim('firebase-messaging.js'),
  'expo-secure-store': shim('expo-secure-store.js'),
  'expo-local-authentication': shim('expo-local-authentication.js'),
  'react-native-device-info': shim('react-native-device-info.js'),
  'react-native-restart-newarch': shim('react-native-restart-newarch.js'),
  'react-native-webview': shim('react-native-webview.js'),
  'react-native-pager-view': shim('pager-view.js'),
  'react-native-vision-camera': shim('react-native-vision-camera.js'),
  'react-native-vision-camera-barcode-scanner': shim(
    'react-native-vision-camera-barcode-scanner.js',
  ),
  // Deferred-feature native deps: importable no-op stubs (entry points hidden
  // on web). They only fail if a hidden screen is actually reached.
  '@breeztech/react-native-breez-sdk-liquid': EMPTY_NATIVE,
  'react-native-maps': EMPTY_NATIVE,
  'react-native-clusterer': EMPTY_NATIVE,
  'expo-notifications': EMPTY_NATIVE,
  'expo-background-task': EMPTY_NATIVE,
  'expo-task-manager': EMPTY_NATIVE,
  'react-native-view-shot': EMPTY_NATIVE,
  'react-native-pdf-from-image': EMPTY_NATIVE,
  'react-native-context-menu-view': EMPTY_NATIVE,
  'rn-qr-generator': EMPTY_NATIVE,
  'react-native-email-link': EMPTY_NATIVE,
  'react-native-country-picker-modal': EMPTY_NATIVE,
  'react-native-tcp-socket': EMPTY_NATIVE,
  'react-native-nitro-image': EMPTY_NATIVE,
  'react-native-nitro-modules': EMPTY_NATIVE,
  'lottie-react-native': shim('lottie-react-native.js'),
  'lucide-react-native': shim('lucide-react-native.js'),
  net: EMPTY_NATIVE,
  tls: EMPTY_NATIVE,
};

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// const config = {};
const config = {
  resolver: {
    /**
     * needed for spark. should be safe to remove after we bump RN version since it will default to 'true'
     * (`npm ls metro` should be >= 0.82.0)
     * @see https://metrobundler.dev/docs/configuration/#unstable_enablepackageexports-experimental
     */
    extraNodeModules: {
      ws: path.resolve(__dirname, 'ws-shim.js'),
      stream: path.resolve(
        __dirname,
        'node_modules/stream-browserify/index.js',
      ),
      net: path.resolve(
        __dirname,
        'node_modules/react-native-tcp-socket/src/index.js',
      ),
      tls: path.resolve(
        __dirname,
        'node_modules/react-native-tcp-socket/src/index.js',
      ),
      crypto: path.resolve(
        __dirname,
        'node_modules/react-native-crypto/index.js',
      ),
      buffer: path.resolve(__dirname, 'node_modules/buffer/index.js'),
      string_decoder: path.resolve(
        __dirname,
        'node_modules/string_decoder/lib/string_decoder.js',
      ),
      events: path.resolve(__dirname, 'node_modules/events/events.js'),
      // empty modules below
      zlib: path.resolve(__dirname, 'empty-module.js'),
      http: path.resolve(__dirname, 'empty-module.js'),
      http2: path.resolve(__dirname, 'empty-module.js'),
      https: path.resolve(__dirname, 'empty-module.js'),
      fs: path.resolve(__dirname, 'empty-module.js'),
      os: path.resolve(__dirname, 'empty-module.js'),
      child_process: path.resolve(__dirname, 'empty-module.js'),
      cluster: path.resolve(__dirname, 'empty-module.js'),
      dgram: path.resolve(__dirname, 'empty-module.js'),
      dns: path.resolve(__dirname, 'empty-module.js'),
      domain: path.resolve(__dirname, 'empty-module.js'),
      punycode: path.resolve(__dirname, 'empty-module.js'),
      readline: path.resolve(__dirname, 'empty-module.js'),
      repl: path.resolve(__dirname, 'empty-module.js'),
      sys: path.resolve(__dirname, 'empty-module.js'),
      tty: path.resolve(__dirname, 'empty-module.js'),
      vm: path.resolve(__dirname, 'empty-module.js'),
      worker_threads: path.resolve(__dirname, 'empty-module.js'),
    },
    resolveRequest: (context, moduleName, platform) => {
      /**
       * needed for spark.
       */
      if (moduleName === 'ws') {
        return {
          filePath: path.resolve(__dirname, 'ws-shim.js'),
          type: 'sourceFile',
        };
      }

      if (platform === 'web' && WEB_STUBS[moduleName]) {
        return {filePath: WEB_STUBS[moduleName], type: 'sourceFile'};
      }

      return context.resolveRequest(context, moduleName, platform);
    },
    transformer: {
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true, // This can help with module resolution
        },
      }),
    },
  },
};

// expo-sqlite's web backend (wa-sqlite) imports a .wasm asset; register the
// extension so Metro bundles it instead of trying to resolve it as a module.
config.resolver.assetExts = [
  ...(getDefaultConfig(__dirname).resolver.assetExts || []),
  'wasm',
];

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
