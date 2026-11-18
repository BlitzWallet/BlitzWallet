jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  acquire: jest.fn(),
  release: jest.fn(),
  disposeIdentity: jest.fn(),
  identityFor: jest.fn(),
  peek: jest.fn(),
}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const spark = require('../../../app/functions/spark');

describe('unilateral exit has no fake broadcast path', () => {
  test('runUnilateralExit is gone and getExitHandle exists', () => {
    expect(spark.runUnilateralExit).toBeUndefined();
    expect(typeof spark.getExitHandle).toBe('function');
  });

  test.each(['walletRuntime.js', 'walletRuntime.web.js'])(
    '%s has no recoverFundsWithoutFunding',
    file => {
      const src = fs.readFileSync(
        path.join(__dirname, '../../../app/functions/spark', file),
        'utf8',
      );
      expect(src).not.toContain('recoverFundsWithoutFunding');
    },
  );
});
