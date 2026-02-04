module.exports = api => {
  const isProduction = api.env('production');

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv'],
      ['@babel/plugin-transform-class-static-block'],

      ['@babel/plugin-proposal-class-properties', { loose: true }],
      ['@babel/plugin-proposal-private-methods', { loose: true }],
      ['@babel/plugin-proposal-private-property-in-object', { loose: true }],

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
      ['react-native-worklets/plugin'],
    ].filter(Boolean),
  };
};
