// Packages that ship untranspiled ES modules and must be run through babel-jest.
// The react-native preset only whitelists react-native/@react-native(-community);
// add any other ESM dependency that a test imports (directly or transitively) here.
const esModules = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-navigation',
  '@react-native-firebase',
  '@noble',
  '@buildonspark/spark-sdk',
  '@bufbuild/protobuf',
].join('|');

module.exports = {
  preset: 'react-native',
  // Ignore git worktrees so their duplicate test files / modules are not
  // collected (prevents haste naming collisions and phantom failures).
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.worktrees/'],
  transformIgnorePatterns: [`node_modules/(?!(${esModules})/)`],
  // Global mocks shared by every test (e.g. Firebase native modules).
  setupFiles: ['<rootDir>/jest.setup.js'],
};
