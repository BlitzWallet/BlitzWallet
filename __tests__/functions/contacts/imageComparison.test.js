import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { areImagesSame } from '../../../app/components/admin/homeComponents/contacts/utils/imageComparison';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { MD5: 'MD5' },
  digestStringAsync: jest.fn(),
}));
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

  it('treats a picked web image as changed without native-only APIs', async () => {
    Platform.OS = 'web';

    await expect(areImagesSame('blob:new-image', 'blob:old-image')).resolves.toBe(
      false,
    );
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(Crypto.digestStringAsync).not.toHaveBeenCalled();
  });

  it('keeps comparing image contents on native', async () => {
    Platform.OS = 'ios';
    FileSystem.readAsStringAsync
      .mockResolvedValueOnce('same-bytes')
      .mockResolvedValueOnce('same-bytes');
    Crypto.digestStringAsync.mockResolvedValue('same-hash');

    await expect(areImagesSame('file:new-image', 'file:old-image')).resolves.toBe(
      true,
    );
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(2);
    expect(Crypto.digestStringAsync).toHaveBeenCalledTimes(2);
  });
});
