// Verifies disposeWalletViewer exists and forces a fresh readonly client on the
// next init (native runtime path). SparkReadonlyClient + selectSparkRuntime are
// mocked so no native/webview deps are pulled in.
jest.mock('@buildonspark/spark-sdk', () => ({
  SparkReadonlyClient: {
    createWithMasterKey: jest.fn(async () => ({ id: Math.random() })),
  },
}));
jest.mock('../../app/functions/spark/index', () => ({
  selectSparkRuntime: jest.fn(async () => 'native'),
}));
jest.mock('../../context-store/webViewContext', () => ({
  OPERATION_TYPES: {},
  sendWebViewRequestGlobal: jest.fn(),
}));
jest.mock('../../app/constants', () => ({ USDB_TOKEN_ID: 'usdb' }));

import { SparkReadonlyClient } from '@buildonspark/spark-sdk';
import {
  initializeSparkWalletViewer,
  disposeWalletViewer,
} from '../../app/functions/spark/walletViewer';

describe('disposeWalletViewer', () => {
  beforeEach(() => SparkReadonlyClient.createWithMasterKey.mockClear());

  it('is a function', () => {
    expect(typeof disposeWalletViewer).toBe('function');
  });

  it('forces a fresh client build after dispose', async () => {
    await initializeSparkWalletViewer('seed one');
    expect(SparkReadonlyClient.createWithMasterKey).toHaveBeenCalledTimes(1);

    // Without a mnemonic, an already-initialized viewer short-circuits (no rebuild).
    await initializeSparkWalletViewer();
    expect(SparkReadonlyClient.createWithMasterKey).toHaveBeenCalledTimes(1);

    // After dispose, the no-mnemonic guard returns false and a new seed rebuilds.
    disposeWalletViewer();
    await initializeSparkWalletViewer('seed two');
    expect(SparkReadonlyClient.createWithMasterKey).toHaveBeenCalledTimes(2);
  });
});
