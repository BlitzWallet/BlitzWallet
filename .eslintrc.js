module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    'dot-notation': 'off',
    curly: 'off',
    'react-hooks/exhaustive-deps': 'off',
    'no-undef': 2,
    'no-unused-vars': 0,
    'no-unreachable': 'off',
    quotes: 'off',
  },
  globals: {
    BigInt: 'readonly',
    Buffer: 'readonly',
    btoa: 'readonly', // both are native to Hermes now
    atob: 'readonly',
    TextDecoder: 'readonly',
    TextEncoder: 'readonly',
  },
};
