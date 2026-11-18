// Shaped like RN (uniffi) SDK output: bigint u64s, {tag, inner} enums, numeric C-like enums.
export const rnRecovery = {
  recoverableValueSats: 50000n,
  totalFeeSats: 1200n,
  feeRateSatPerVbyte: 5n,
  destination: 'bc1qdest',
  leaves: [{ leafId: 'leaf-1', valueSats: 50000n }],
  transactions: [
    {
      kind: 2,
      nodeId: 'n1',
      txid: 'aa01',
      txHex: '0200aa',
      cpfpTxHex: '0200bb',
      csvTimelockBlocks: 2016,
      dependsOn: [],
      status: { tag: 'Confirmed', inner: { blockHeight: 870000 } },
    },
    {
      kind: 3,
      nodeId: 'n1',
      txid: 'aa02',
      txHex: '0200cc',
      cpfpTxHex: undefined,
      csvTimelockBlocks: undefined,
      dependsOn: ['aa01'],
      status: {
        tag: 'WaitingForTimelock',
        inner: { spendableAtHeight: 870100 },
      },
    },
    {
      kind: 4,
      txid: 'aa03',
      txHex: '0200dd',
      dependsOn: ['aa02'],
      status: { tag: 'WaitingForDependencies', inner: {} },
    },
  ],
};
