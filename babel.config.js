module.exports = api => {
  const isProduction = api.env('production');
  // The crypto/stream/buffer aliases below point at native RN packages that
  // don't work in the browser. On web, Metro's resolveRequest handles crypto
  // (-> web-shims/quick-crypto) and buffer resolves to the npm `buffer`, so we
  // must NOT apply these aliases for the web platform.
  const platform = api.caller(caller => caller && caller.platform);
  const isWeb = platform === 'web';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv'],
      ['@babel/plugin-transform-class-static-block'],

      // babel-preset-expo downlevels const/let -> var on native (Hermes target)
      // but keeps native block scoping on web, so web enforces TDZ where native
      // silently hoists. Force the same transform on web for parity, otherwise
      // any use-before-declaration that native masks throws a ReferenceError.
      isWeb && ['@babel/plugin-transform-block-scoping'],
      isProduction && ['transform-remove-console'],

      !isWeb && [
        'module-resolver',
        {
          alias: {
            crypto: 'react-native-quick-crypto',
            stream: 'stream-browserify',
            buffer: '@craftzdog/react-native-buffer',
          },
        },
      ],

      // 👇 MUST be last
      ['react-native-worklets/plugin'],
    ].filter(Boolean),
  };
};
