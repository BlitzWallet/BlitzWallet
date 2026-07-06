// dedupeMerge collapses the same physical merchant appearing across map sources
// (BTC Map + the aux directories) into a single pin, keeping the highest-priority
// record and backfilling fields the winner is missing.
const { dedupeMerge } = require('../../../app/functions/btcMap/mergePlaces');

describe('dedupeMerge', () => {
  it('collapses near-identical places from different sources into one row', () => {
    const rows = [
      { id: 1, source: 'btcmap', lat: 9.9281, lon: -84.0907, name: "Joe's Coffee", icon: 'local_cafe', category: null },
      { id: 'joes-coffee-4', source: 'bitcoinjungle', lat: 9.92809, lon: -84.09071, name: 'Joes Coffee', icon: '', category: 'food_drink' },
    ];
    const merged = dedupeMerge(rows);
    expect(merged).toHaveLength(1);
  });

  it('keeps the higher-priority source (btcmap) as the winner', () => {
    const rows = [
      { id: 'x-1', source: 'moneybadger', lat: 1, lon: 2, name: 'Shop', icon: '', category: 'retail' },
      { id: 42, source: 'btcmap', lat: 1.00001, lon: 2.00001, name: 'Shop', icon: 'storefront', category: null },
    ];
    const merged = dedupeMerge(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('btcmap');
    expect(merged[0].id).toBe(42);
  });

  it('backfills fields the winner is missing from the duplicate', () => {
    const rows = [
      // btcmap wins but has no category (resolved from icon at render); the aux
      // duplicate's category should backfill so filtering still works.
      { id: 7, source: 'btcmap', lat: 5, lon: 6, name: 'Cafe', icon: '', category: null },
      { id: 'cafe-1', source: 'bitcoinjungle', lat: 5, lon: 6, name: 'Cafe', icon: '', category: 'food_drink' },
    ];
    const merged = dedupeMerge(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('btcmap');
    expect(merged[0].category).toBe('food_drink');
  });

  it('keeps distinct merchants at different coordinates separate', () => {
    const rows = [
      { id: 1, source: 'btcmap', lat: 10, lon: 20, name: 'A', icon: '', category: null },
      { id: 2, source: 'moneybadger', lat: 30, lon: 40, name: 'B', icon: '', category: 'retail' },
    ];
    expect(dedupeMerge(rows)).toHaveLength(2);
  });

  it('drops rows with non-finite coordinates', () => {
    const rows = [
      { id: 1, source: 'btcmap', lat: NaN, lon: 20, name: 'A', icon: '', category: null },
      { id: 2, source: 'moneybadger', lat: 30, lon: 40, name: 'B', icon: '', category: 'retail' },
    ];
    const merged = dedupeMerge(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(2);
  });
});
