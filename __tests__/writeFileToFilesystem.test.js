import {Platform} from 'react-native';
import writeAndShareFileToFilesystem from '../app/functions/writeFileToFilesystem';
import {writeAsStringAsync} from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
  EncodingType: {UTF8: 'utf8'},
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

test('downloads a UTF-8 export on web without writing to native storage', async () => {
  const originalOS = Platform.OS;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalDocument = global.document;
  const link = {click: jest.fn(), remove: jest.fn()};
  Platform.OS = 'web';
  URL.createObjectURL = jest.fn(() => 'blob:download');
  URL.revokeObjectURL = jest.fn();
  global.document = {
    createElement: jest.fn(() => link),
    body: {appendChild: jest.fn()},
  };

  try {
    expect(await writeAndShareFileToFilesystem('sats,amount\n1,2', 'wallet.csv', 'text/csv'))
      .toEqual({success: true, error: null});
    expect(writeAsStringAsync).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(link.download).toBe('wallet.csv');
    expect(link.href).toBe('blob:download');
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);
  } finally {
    Platform.OS = originalOS;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    global.document = originalDocument;
  }
});
