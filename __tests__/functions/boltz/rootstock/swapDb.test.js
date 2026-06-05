const mockGetAllAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: mockGetAllAsync,
  })),
}));

const {
  getSwapById,
  loadSwaps,
} = require('../../../../app/functions/boltz/rootstock/swapDb');

describe('Rootstock swap DB row parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips a corrupt row and still returns valid swaps', async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        id: 'good',
        type: 'submarine',
        data: JSON.stringify({ status: 'invoice.set' }),
      },
      { id: 'bad', type: 'submarine', data: '{not json' },
    ]);

    const swaps = await loadSwaps();

    expect(swaps).toHaveLength(1);
    expect(swaps[0]).toEqual({
      id: 'good',
      type: 'submarine',
      data: { status: 'invoice.set' },
    });
  });

  it('isolates corrupt rows when loading by id', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: 'bad', type: 'submarine', data: '{not json' },
    ]);

    await expect(getSwapById('bad')).resolves.toEqual([]);
  });
});
