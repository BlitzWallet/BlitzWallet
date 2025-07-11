module.exports = api => {
  const isProduction = api.env('production');

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv'],

      isProduction && ['transform-remove-console'],

      [
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
      ['react-native-reanimated/plugin'],
    ].filter(Boolean),
  };
};
