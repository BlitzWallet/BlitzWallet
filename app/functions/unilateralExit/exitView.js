import { normalizeExitTx } from '../spark/breezNormalize';
import { decodeRecovery } from './exitCodec';

// Value of the co-signed leaves the given records still hold (recovery in
// flight): what Recover Funds must not offer a second time.
export function heldCoopSats(records) {
  let total = 0;
  for (const r of records) {
    let recovery = null;
    try {
      recovery = decodeRecovery(r.recovery);
    } catch {}
    if (!recovery) continue;
    const open = new Set(
      recovery.transactions.flatMap(x => {
        const t = normalizeExitTx(x, x.status.tag !== undefined);
        return t.kind === 'cooperative' &&
          t.status.type !== 'confirmed' &&
          x.nodeId
          ? [x.nodeId]
          : [];
      }),
    );
    for (const l of recovery.leaves ?? []) {
      if (open.has(l.leafId)) total += Number(l.valueSats);
    }
  }
  return total;
}

// Pure: record + chain tip -> what the exit screens show.
export function exitView(record, tipHeight) {
  const tip = tipHeight ?? null;
  let txs = [];
  if (record.recovery) {
    // RN statuses carry `tag`, web ones `type`
    try {
      txs = decodeRecovery(record.recovery).transactions.map(t =>
        normalizeExitTx(t, t.status.tag !== undefined),
      );
    } catch {} // unparseable: the pass treats it as redo
  }
  const byId = new Map(txs.map(t => [t.txid, t]));
  const is = (t, type) => t.status.type === type;

  const memo = new Map();
  const finish = t => {
    if (is(t, 'confirmed')) return 0;
    if (memo.has(t.txid)) return memo.get(t.txid);
    let blocks;
    if (is(t, 'ready')) blocks = 1; // timelock already met
    else if (
      is(t, 'waitingForTimelock') &&
      t.status.spendableAtHeight != null
    ) {
      blocks = Math.max(t.status.spendableAtHeight - tip, 0);
    } else {
      blocks =
        Math.max(
          0,
          ...t.dependsOn.map(id => (byId.has(id) ? finish(byId.get(id)) : 0)),
        ) +
        1 +
        (t.csvTimelockBlocks ?? 0);
    }
    memo.set(t.txid, blocks);
    return blocks;
  };

  const locks = txs
    .filter(
      t => is(t, 'waitingForTimelock') && t.status.spendableAtHeight != null,
    )
    .map(t => t.status.spendableAtHeight - tip)
    .filter(n => n > 0);

  const status = record.status;
  let phase;
  if (
    status === 'done' ||
    status === 'awaitingFee' ||
    status === 'needsMoreFee'
  ) {
    phase = status;
  } else if (tip == null) phase = 'chainUnavailable';
  else if (txs.some(t => is(t, 'ready')) && record.lastCheckedAt == null) {
    phase = 'sending';
  } else if (txs.some(t => is(t, 'ready') || is(t, 'waitingForDependencies'))) {
    phase = 'waitingConfirmation';
  } else if (txs.some(t => is(t, 'waitingForTimelock')))
    phase = 'waitingTimelock';
  else phase = 'updating';

  const seen = record.feeSeen;
  return {
    phase,
    txs,
    amountSats: record.quote.recoverableSats,
    receiveSats: record.quote.receiveSats,
    stepsDone: txs.filter(t => is(t, 'confirmed')).length,
    stepsTotal: txs.length,
    blocksLeft: tip == null ? null : Math.max(0, ...txs.map(finish)),
    nextMaturityBlocks:
      tip == null || !locks.length ? null : Math.min(...locks),
    feeNeededSats:
      status === 'needsMoreFee'
        ? record.needMoreSats
        : record.quote.fundingSats,
    feeReceivedSats: seen ? seen.confirmedSats + seen.pendingSats : 0,
    feePendingSats: seen?.pendingSats ?? 0,
    failedLeafCount: (record.failedLeafIds ?? []).length,
    refusalCount: Object.keys(record.refusals ?? {}).length,
  };
}
