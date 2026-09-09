import ICONS from '../../app/constants/icons';
import {
  ACCUMULATION_BTC_SOURCES,
  ACCUMULATION_CHAINS,
} from '../../app/constants/accumulationAddresses';

// FlashNet route catalog (GET /v1/orchestration/routes), filtered to
// destinationChain=spark + destinationAsset=BTC, non-native BTC sources.
const FLASHNET_BTC_ROUTES = [
  ['ethereum', 'WBTC'],
  ['solana', 'cbBTC'],
  ['base', 'cbBTC'],
];

describe('ACCUMULATION_BTC_SOURCES', () => {
  it('matches the FlashNet BTC-in routes', () => {
    expect(ACCUMULATION_BTC_SOURCES.map(s => [s.chain, s.asset]).sort()).toEqual(
      [...FLASHNET_BTC_ROUTES].sort(),
    );
  });

  // A missing chain entry silently degrades the label to the raw id and makes
  // ICONS[`chain_<label>`] undefined (blank badge) in the deposit row, QR view
  // and address detail screen.
  it.each(ACCUMULATION_BTC_SOURCES)(
    'resolves a chain label and icons for %o',
    source => {
      const chain = ACCUMULATION_CHAINS.find(c => c.id === source.chain);
      expect(chain).toBeDefined();
      expect(ICONS[`chain_${chain.label.toLowerCase()}`]).toBeDefined();
      expect(ICONS[`${source.asset.toLowerCase()}Logo`]).toBeDefined();
    },
  );
});
