import { filterDisplayableTransactions } from './spark/filterTransactions';
import { getStableTx } from './spark/enrichedTxCache';
import { isOrchestraSwapFailed } from './spark/orchestraLightning';

// Home / balance-page rows as plain data (the shape ActivityRow takes), not
// JSX: one pass that filters and maps, with JSON parsed once per tx change via
// the enrichedTxCache. The card renders the rows, so a row only re-renders
// when its own tx changes.
export default function getFormattedHomepageTxsForSpark({
  transactions,
  tokens,
  enabledLRC20,
  scrollPosition,
  limit = 25,
}) {
  return filterDisplayableTransactions({
    transactions,
    scrollPosition,
    enabledLRC20,
    tokens,
    limit,
    getDetails: tx => getStableTx(tx).details,
    toRow: (tx, details, showSwapConversion) => {
      const stableTx = getStableTx(tx, details);
      return {
        id: tx.sparkID,
        tx: stableTx,
        time: new Date(details.time).getTime(),
        isLRC20Payment: details.isLRC20Payment,
        // Plain failures are already filtered out; only orchestra swaps remain.
        isFailed: isOrchestraSwapFailed(stableTx),
        showSwapConversion,
      };
    },
  });
}
