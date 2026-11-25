import { useMemo } from 'react';
import { useNodeContext } from '../../context-store/nodeContext';
import { useFlashnet } from '../../context-store/flashnetContext';
import { resolveDisplayUsdRate } from '../functions/money';

// USD rate for display/entry: market USD, else the Flashnet pool price while
// the market rate loads or fails. Never use for swap execution.
export default function useDisplayUsdRate() {
  const { usdFiatStats } = useNodeContext();
  const { swapUSDPriceDollars } = useFlashnet();
  return useMemo(
    () => resolveDisplayUsdRate(usdFiatStats, swapUSDPriceDollars),
    [usdFiatStats, swapUSDPriceDollars],
  );
}
