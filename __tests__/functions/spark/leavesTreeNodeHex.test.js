// Verifies treeNodeHexFromRaw produces the single protobuf-encoded TreeNode hex
// that the spark-unilateral-exit tooling consumes, and that it round-trips back
// through TreeNode.decode. Exercises every byte-input shape getSparkLeaves can
// return: {"0":n,...} JSON maps (webview), hex strings (webview), plain number[]
// arrays, and Uint8Array (native).

// leavesStorage imports expo-sqlite at module load; treeNodeHexFromRaw never
// touches the DB, so an empty mock keeps the import chain from pulling native.
jest.mock('expo-sqlite', () => ({}));

const { TreeNode } = require('@buildonspark/spark-sdk/proto/spark');
const { treeNodeHexFromRaw } = require('../../../app/functions/spark/leavesStorage');

// A byte value encoded as the {"0":n,"1":n,...} object a JSON round-trip makes.
const toByteMap = arr => Object.fromEntries(arr.map((n, i) => [String(i), n]));

const NODE_TX = [3, 0, 0, 0, 1, 42, 99, 200, 7];
const REFUND_TX = [3, 0, 0, 0, 1, 11, 22, 33];
const rawLeaf = {
  id: '019aa11c-e0f8-7228-923e-27ed86726bf3',
  treeId: '019aa11c-085b-7c5c-aa5a-f18d722b34bd',
  value: 1024,
  parentNodeId: '019aa11c-e0de-7dd0-82c5-e56643f705b9',
  nodeTx: toByteMap(NODE_TX), // JSON byte-map (webview)
  refundTx: Buffer.from(REFUND_TX).toString('hex'), // hex string (webview)
  vout: 0,
  verifyingPublicKey: [2, 120, 194, 169], // number[]
  ownerIdentityPublicKey: Uint8Array.from([3, 175, 160, 143]), // Uint8Array (native)
  signingKeyshare: {
    ownerIdentifiers: ['01', '02', '03'],
    threshold: 2,
    publicKey: toByteMap([2, 1, 166, 111]),
    publicShares: {
      '01': toByteMap([3, 23, 137, 221]),
      '02': [3, 153, 167, 171],
    },
    updatedTime: '2026-07-08T17:38:29.781Z',
  },
  status: 'AVAILABLE',
  network: 1,
  createdTime: '2025-11-20T11:53:35.736Z',
  updatedTime: '2026-07-08T17:38:29.914Z',
  ownerSigningPublicKey: toByteMap([2, 222, 240, 145]),
  directTx: toByteMap([3, 0, 0, 0, 1, 1, 2]),
  directRefundTx: toByteMap([3, 0, 0, 0, 1, 3, 4]),
  directFromCpfpRefundTx: toByteMap([3, 0, 0, 0, 1, 5, 6]),
  treenodeStatus: 1,
};

describe('treeNodeHexFromRaw', () => {
  test('produces valid hex that round-trips through TreeNode.decode', () => {
    const hex = treeNodeHexFromRaw(rawLeaf);

    expect(typeof hex).toBe('string');
    expect(hex).toMatch(/^[0-9a-fA-F]+$/); // guide bundle.ts isHex rule

    const decoded = TreeNode.decode(Uint8Array.from(Buffer.from(hex, 'hex')));

    expect(decoded.id).toBe(rawLeaf.id);
    expect(decoded.treeId).toBe(rawLeaf.treeId);
    expect(decoded.value).toBe(1024);
    expect(decoded.status).toBe('AVAILABLE');
    expect(decoded.parentNodeId).toBe(rawLeaf.parentNodeId);
    expect(decoded.network).toBe(1);
    expect(decoded.treenodeStatus).toBe(1);

    // nodeTx is required by the SDK exit-chain builder and must survive encoding.
    expect(decoded.nodeTx.length).toBeGreaterThan(0);
    expect(Buffer.from(decoded.nodeTx).toString('hex')).toBe(
      Buffer.from(NODE_TX).toString('hex'),
    );
    expect(Buffer.from(decoded.refundTx).toString('hex')).toBe(
      Buffer.from(REFUND_TX).toString('hex'),
    );

    // All direct* tx variants (dropped by the SDK WalletLeaf DTO) survive too.
    expect(decoded.directTx.length).toBeGreaterThan(0);
    expect(decoded.directRefundTx.length).toBeGreaterThan(0);
    expect(decoded.directFromCpfpRefundTx.length).toBeGreaterThan(0);

    // signingKeyshare with mixed-shape public shares round-trips.
    expect(decoded.signingKeyshare.threshold).toBe(2);
    expect(decoded.signingKeyshare.ownerIdentifiers).toEqual(['01', '02', '03']);
    expect(Object.keys(decoded.signingKeyshare.publicShares).sort()).toEqual([
      '01',
      '02',
    ]);
  });

  test('returns null instead of throwing on a malformed leaf', () => {
    // A getter that throws simulates an unexpected leaf shape.
    const bad = {
      get id() {
        throw new Error('boom');
      },
    };
    expect(treeNodeHexFromRaw(bad)).toBeNull();
  });
});
