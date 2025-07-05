const {getDefaultConfig} = require('expo/metro-config');
const {mergeConfig} = require('@react-native/metro-config');
const path = require('path');

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

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
