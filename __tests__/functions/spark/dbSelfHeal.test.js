jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

// Fresh module state per test so module-level initPromise/rawDB don't leak.
function loadModule() {
  let openDatabaseAsync;
  let getAllUnpaidSparkLightningInvoices;
  jest.isolateModules(() => {
    ({ openDatabaseAsync } = require('expo-sqlite'));
    ({
      getAllUnpaidSparkLightningInvoices,
    } = require('../../../app/functions/spark/transactions'));
  });
  return { openDatabaseAsync, getAllUnpaidSparkLightningInvoices };
}

describe('spark tx DB self-heal on released native handle', () => {
  it('reopens and retries when the handle was released', async () => {
    const { openDatabaseAsync, getAllUnpaidSparkLightningInvoices } =
      loadModule();
    const dead = {
      getAllAsync: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Call to function 'NativeDatabase.prepareAsync' has been rejected.\nCannot use shared object that was already released",
          ),
        ),
    };
    const fresh = { getAllAsync: jest.fn().mockResolvedValue([{ id: 1 }]) };
    openDatabaseAsync
      .mockResolvedValueOnce(dead)
      .mockResolvedValueOnce(fresh);

    const result = await getAllUnpaidSparkLightningInvoices();

    expect(result).toEqual([{ id: 1 }]);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
    expect(dead.getAllAsync).toHaveBeenCalledTimes(1);
    expect(fresh.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('does not reopen on unrelated errors', async () => {
    const { openDatabaseAsync, getAllUnpaidSparkLightningInvoices } =
      loadModule();
    const handle = {
      getAllAsync: jest.fn().mockRejectedValue(new Error('no such table')),
    };
    openDatabaseAsync.mockResolvedValueOnce(handle);

    // getAllUnpaidSparkLightningInvoices swallows errors -> returns undefined
    const result = await getAllUnpaidSparkLightningInvoices();

    expect(result).toBeUndefined();
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(handle.getAllAsync).toHaveBeenCalledTimes(1);
  });
});
