import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { areImagesSame } from '../../../app/components/admin/homeComponents/contacts/utils/imageComparison';

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
}));

describe('areImagesSame', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  it('compares image bytes on web via fetch', async () => {
    Platform.OS = 'web';
    const bytes = b => ({ arrayBuffer: async () => new Uint8Array(b).buffer });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(bytes([1, 2]))
      .mockResolvedValueOnce(bytes([1, 2]))
      .mockResolvedValueOnce(bytes([1, 2]))
      .mockResolvedValueOnce(bytes([3]));

    await expect(areImagesSame('blob:a', 'blob:b')).resolves.toBe(true);
    await expect(areImagesSame('blob:a', 'blob:c')).resolves.toBe(false);
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('keeps comparing image contents on native', async () => {
    Platform.OS = 'ios';
    FileSystem.readAsStringAsync
      .mockResolvedValueOnce('same-bytes')
      .mockResolvedValueOnce('same-bytes');

    await expect(areImagesSame('file:new-image', 'file:old-image')).resolves.toBe(
      true,
    );
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(2);
  });

  it('detects different image contents on native', async () => {
    Platform.OS = 'ios';
    FileSystem.readAsStringAsync
      .mockResolvedValueOnce('new-bytes')
      .mockResolvedValueOnce('old-bytes');

    await expect(areImagesSame('file:new-image', 'file:old-image')).resolves.toBe(
      false,
    );
  });
});
