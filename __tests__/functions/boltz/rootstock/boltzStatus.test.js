jest.mock('../../../../app/functions/boltz/rootstock/boltzHttp', () => ({
  fetchBoltzJson: jest.fn(),
}));

const {
  fetchBoltzJson,
} = require('../../../../app/functions/boltz/rootstock/boltzHttp');
const {
  fetchBoltzSwapStatus,
} = require('../../../../app/functions/boltz/rootstock/boltzStatus');

describe('fetchBoltzSwapStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the swap status from Boltz', async () => {
    fetchBoltzJson.mockResolvedValue({ status: 'transaction.confirmed' });
    await expect(fetchBoltzSwapStatus('abc')).resolves.toEqual({
      status: 'transaction.confirmed',
    });
  });

  it('returns null on failure instead of throwing', async () => {
    fetchBoltzJson.mockRejectedValue(new Error('down'));
    await expect(fetchBoltzSwapStatus('abc')).resolves.toBeNull();
  });
});
