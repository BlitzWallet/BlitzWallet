import { getNextChildDerivationIndex } from '../../../app/functions/accounts/childAccounts';

describe('getNextChildDerivationIndex', () => {
  it('defaults to 0 when the parent has no counter or children', () => {
    expect(getNextChildDerivationIndex({})).toBe(0);
    expect(getNextChildDerivationIndex()).toBe(0);
  });

  it('returns the counter when it is ahead of the registry', () => {
    expect(
      getNextChildDerivationIndex({
        nextChildDerivationIndex: 5,
        childAccounts: [{ childIndex: 2 }],
      }),
    ).toBe(5);
  });

  it('skips past the highest existing child when the registry is ahead', () => {
    expect(
      getNextChildDerivationIndex({
        nextChildDerivationIndex: 1,
        childAccounts: [{ childIndex: 4 }, { childIndex: 2 }],
      }),
    ).toBe(5);
  });

  it('ignores malformed registry entries', () => {
    expect(
      getNextChildDerivationIndex({
        nextChildDerivationIndex: 0,
        childAccounts: [{ childIndex: undefined }, {}, { childIndex: '7' }],
      }),
    ).toBe(8);
  });
});
