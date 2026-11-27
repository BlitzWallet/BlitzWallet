const mockHandle = {exportExitState: jest.fn(), importExitState: jest.fn()};
const mockWrite = jest.fn();
const mockLoad = jest.fn();
const mockSave = jest.fn();
const mockPick = jest.fn();
const mockRead = jest.fn();
const mockSetItem = jest.fn();

jest.mock(
  'expo-document-picker',
  () => ({getDocumentAsync: (...a) => mockPick(...a)}),
  {virtual: true},
);
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...a) => mockRead(...a),
}));
jest.mock('../../../app/functions/writeFileToFilesystem', () => ({
  __esModule: true,
  default: (...a) => mockWrite(...a),
}));
jest.mock('../../../app/functions/unilateralExit/exitStore', () => ({
  loadExitRecord: (...a) => mockLoad(...a),
  listKeptRecoveries: async () => [],
  saveKeptRecovery: jest.fn(),
  saveExitRecord: (...a) => mockSave(...a),
}));
jest.mock('../../../app/functions/unilateralExit/exitEngine', () => ({
  startExitEngine: jest.fn(),
  stopExitEngine: jest.fn(),
}));
jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  identityFor: async m => `id-${m}`,
}));
jest.mock('../../../app/functions/spark', () => ({
  getExitHandle: async () => mockHandle,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: (...a) => mockSetItem(...a),
}));

import {
  saveExitDataFile,
  pickExitDataFile,
  restoreExitData,
} from '../../../app/functions/unilateralExit/exitBackup';

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockResolvedValue({record: null, corrupt: false});
  mockWrite.mockResolvedValue({success: true, error: null});
});

describe('exitBackup', () => {
  it('saved file is the raw exit state', async () => {
    mockHandle.exportExitState.mockResolvedValue('{"raw":1}');
    const res = await saveExitDataFile('m');
    expect(res.success).toBe(true);
    expect(mockWrite).toHaveBeenCalledWith(
      '{"raw":1}',
      expect.stringMatching(/^blitz-exit-data-\d{4}-\d{2}-\d{2}\.json$/),
      'application/json',
    );
  });

  it("saves the live exit's snapshot, not a fresh export", async () => {
    mockLoad.mockResolvedValue({
      record: {status: 'broadcasting', exitStateSnapshot: 'SNAP'},
    });
    mockHandle.exportExitState.mockResolvedValue('FRESH');
    await saveExitDataFile('m');
    const file = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(file.exitState).toBe('SNAP');
    expect(file.record.status).toBe('broadcasting');
    expect(mockHandle.exportExitState).not.toHaveBeenCalled();
  });

  it('writes nothing to Blitz storage when saving', async () => {
    mockHandle.exportExitState.mockResolvedValue('x');
    await saveExitDataFile('m');
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('cancelled picker imports nothing', async () => {
    mockPick.mockResolvedValue({canceled: true, assets: null});
    expect(await pickExitDataFile()).toBeNull();
    expect(await restoreExitData('m')).toBeNull();
    expect(mockHandle.importExitState).not.toHaveBeenCalled();
  });

  it('restore from a file reports foreign leaves', async () => {
    mockPick.mockResolvedValue({canceled: false, assets: [{uri: 'file:///a'}]});
    mockRead.mockResolvedValue('RAW');
    mockHandle.importExitState.mockResolvedValue({
      importedLeaves: 2,
      skippedForeignLeaves: 1,
      skippedConflictingLeaves: 0,
      skippedChains: 0,
    });
    expect(await restoreExitData('m')).toEqual({
      importedLeaves: 2,
      skippedForeignLeaves: 1,
      skippedConflictingLeaves: 0,
    });
    expect(mockHandle.importExitState).toHaveBeenCalledWith('RAW');
  });

  it('a failed import surfaces the error and changes nothing', async () => {
    mockPick.mockResolvedValue({canceled: false, assets: [{uri: 'file:///a'}]});
    mockRead.mockResolvedValue('bad');
    mockHandle.importExitState.mockRejectedValue(new Error('bad file'));
    await expect(restoreExitData('m')).rejects.toThrow('bad file');
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
