// Contract test for the shared Spark status mapper. The transfer-status
// classification is load-bearing for on-chain deposit claims: a claim's
// UTXO_SWAP transfer starts in TRANSFER_STATUS_SENDER_INITIATED (the initial
// in-flight state), and updateSparkTxStatus polls pending rows every ~10s. If
// the mapper called that state 'failed', a claim that had not settled yet was
// permanently wedged as failed (the poller only revisits pending rows).
jest.mock('@buildonspark/spark-sdk', () => ({ SparkWallet: {}, Network: {} }));
jest.mock('@buildonspark/spark-sdk/types', () => ({
  LightningSendRequestStatus: {
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    PREIMAGE_PROVIDED: 'PREIMAGE_PROVIDED',
    LIGHTNING_PAYMENT_SUCCEEDED: 'LIGHTNING_PAYMENT_SUCCEEDED',
    USER_SWAP_RETURNED: 'USER_SWAP_RETURNED',
    LIGHTNING_PAYMENT_FAILED: 'LIGHTNING_PAYMENT_FAILED',
    TRANSFER_FAILED: 'TRANSFER_FAILED',
    USER_TRANSFER_VALIDATION_FAILED: 'USER_TRANSFER_VALIDATION_FAILED',
    PREIMAGE_PROVIDING_FAILED: 'PREIMAGE_PROVIDING_FAILED',
    USER_SWAP_RETURN_FAILED: 'USER_SWAP_RETURN_FAILED',
  },
  SparkCoopExitRequestStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
  },
  LightningReceiveRequestStatus: {
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    LIGHTNING_PAYMENT_RECEIVED: 'LIGHTNING_PAYMENT_RECEIVED',
    TRANSFER_FAILED: 'TRANSFER_FAILED',
    PAYMENT_PREIMAGE_RECOVERING_FAILED: 'PAYMENT_PREIMAGE_RECOVERING_FAILED',
    REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED:
      'REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED',
    REFUND_SIGNING_FAILED: 'REFUND_SIGNING_FAILED',
    TRANSFER_CREATION_FAILED: 'TRANSFER_CREATION_FAILED',
  },
  SparkLeavesSwapRequestStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
  },
  SparkUserRequestStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELED: 'CANCELED',
  },
  ClaimStaticDepositStatus: {
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    SPEND_TX_BROADCAST: 'SPEND_TX_BROADCAST',
    TRANSFER_CREATION_FAILED: 'TRANSFER_CREATION_FAILED',
    REFUND_SIGNING_FAILED: 'REFUND_SIGNING_FAILED',
    UTXO_SWAPPING_FAILED: 'UTXO_SWAPPING_FAILED',
    REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED:
      'REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED',
  },
}));
jest.mock('@flashnet/sdk', () => ({ FlashnetClient: class {} }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../../../context-store/webViewContext', () => ({
  OPERATION_TYPES: {},
  sendWebViewRequestGlobal: jest.fn(),
  getHandshakeComplete: jest.fn(),
  getIsNativeRuntime: jest.fn(() => false),
  setForceReactNative: jest.fn(),
}));

const { getSparkPaymentStatus } = require('../../../app/functions/spark');

describe('getSparkPaymentStatus — transfer statuses', () => {
  test('SENDER_INITIATED is the initial in-flight state: pending, not failed', () => {
    expect(getSparkPaymentStatus('TRANSFER_STATUS_SENDER_INITIATED')).toBe(
      'pending',
    );
  });

  test('mid-flight transfer states stay pending', () => {
    for (const status of [
      'TRANSFER_STATUS_SENDER_KEY_TWEAK_PENDING',
      'TRANSFER_STATUS_SENDER_KEY_TWEAKED',
      'TRANSFER_STATUS_RECEIVER_KEY_TWEAKED',
      'TRANSFER_STATUS_RECEIVER_REFUND_SIGNED',
      'TRANSFER_STATUS_RECEIVER_KEY_TWEAK_LOCKED',
      'TRANSFER_STATUS_RECEIVER_KEY_TWEAK_APPLIED',
      'TRANSFER_STATUS_APPLYING_SENDER_KEY_TWEAK',
      'TRANSFER_STATUS_SENDER_INITIATED_COORDINATOR',
    ]) {
      expect(getSparkPaymentStatus(status)).toBe('pending');
    }
  });

  test('completed transfer is completed', () => {
    expect(getSparkPaymentStatus('TRANSFER_STATUS_COMPLETED')).toBe(
      'completed',
    );
  });

  test('returned and expired transfers are terminal failures', () => {
    expect(getSparkPaymentStatus('TRANSFER_STATUS_RETURNED')).toBe('failed');
    expect(getSparkPaymentStatus('TRANSFER_STATUS_EXPIRED')).toBe('failed');
  });
});

describe('getSparkPaymentStatus — request statuses', () => {
  test('completed request statuses map to completed', () => {
    for (const status of [
      'TRANSFER_COMPLETED',
      'PREIMAGE_PROVIDED',
      'LIGHTNING_PAYMENT_SUCCEEDED',
      'LIGHTNING_PAYMENT_RECEIVED',
      'SUCCEEDED',
      'SPEND_TX_BROADCAST',
    ]) {
      expect(getSparkPaymentStatus(status)).toBe('completed');
    }
  });

  test('terminal failure request statuses map to failed', () => {
    for (const status of [
      'LIGHTNING_PAYMENT_FAILED',
      'TRANSFER_FAILED',
      'USER_TRANSFER_VALIDATION_FAILED',
      'PREIMAGE_PROVIDING_FAILED',
      'USER_SWAP_RETURN_FAILED',
      'USER_SWAP_RETURNED',
      'FAILED',
      'EXPIRED',
      'CANCELED',
      'PAYMENT_PREIMAGE_RECOVERING_FAILED',
      'REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED',
      'REFUND_SIGNING_FAILED',
      'TRANSFER_CREATION_FAILED',
      'UTXO_SWAPPING_FAILED',
    ]) {
      expect(getSparkPaymentStatus(status)).toBe('failed');
    }
  });
});
