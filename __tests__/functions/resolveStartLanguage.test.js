jest.mock('../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(() => Promise.resolve(true)),
}));

import { resolveUserLanguage } from '../../i18n';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../app/functions/localStorage';
import { getLocales } from 'react-native-localize';

describe('resolveUserLanguage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored user preference without touching device locale', async () => {
    getLocalStorageItem.mockResolvedValue('"es"');

    await expect(resolveUserLanguage()).resolves.toBe('es');
    expect(getLocales).not.toHaveBeenCalled();
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('falls back to the matched device locale and persists it', async () => {
    getLocalStorageItem.mockResolvedValue(null);
    getLocales.mockReturnValue([{ languageTag: 'de-DE' }]);

    await expect(resolveUserLanguage()).resolves.toBe('de-DE');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'userSelectedLanguage',
      JSON.stringify('de-DE'),
    );
  });

  it('falls back to en for an unsupported device locale', async () => {
    getLocalStorageItem.mockResolvedValue(null);
    getLocales.mockReturnValue([{ languageTag: 'ja-JP' }]);

    await expect(resolveUserLanguage()).resolves.toBe('en');
  });

  it('treats a corrupt stored value as absent', async () => {
    getLocalStorageItem.mockResolvedValue('not-json{');
    getLocales.mockReturnValue([{ languageTag: 'fr-FR' }]);

    await expect(resolveUserLanguage()).resolves.toBe('fr');
  });
});
