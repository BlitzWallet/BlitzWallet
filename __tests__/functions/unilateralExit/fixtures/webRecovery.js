// Shaped like web (wasm) SDK output: numbers, {type} enums, lowerCamel string enums.
export const webRecovery = {
  recoverableValueSats: 50000,
  totalFeeSats: 1200,
  feeRateSatPerVbyte: 5,
  destination: 'bc1qdest',
  leaves: [{ leafId: 'leaf-1', valueSats: 50000 }],
  transactions: [
    {
      kind: 'node',
      nodeId: 'n1',
      txid: 'aa01',
      txHex: '0200aa',
      cpfpTxHex: '0200bb',
      csvTimelockBlocks: 2016,
      dependsOn: [],
      status: { type: 'confirmed', blockHeight: 870000 },
    },
    {
      kind: 'refund',
      nodeId: 'n1',
      txid: 'aa02',
      txHex: '0200cc',
      dependsOn: ['aa01'],
      status: { type: 'waitingForTimelock', spendableAtHeight: 870100 },
    },
  ],
};
