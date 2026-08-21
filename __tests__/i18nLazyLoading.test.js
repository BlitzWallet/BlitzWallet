import i18next from 'i18next';
import '../i18n';

describe('lazy translation loading', () => {
  const i18n = i18next;
  // Jest's default VM cannot execute dynamic import() unless Node runs with
  // --experimental-vm-modules. Metro transforms import() natively in the app,
  // so only the test environment needs the guard below.
  let dynamicImportWorks = false;

  beforeAll(async () => {
    try {
      const module = await import('../locales/de-DE/translation.json');
      dynamicImportWorks = !!(module.default ?? module);
    } catch {
      dynamicImportWorks = false;
    }
  });

  it('has English bundled synchronously', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    expect(i18n.t('constants.scan')).toBe('Scan');
  });

  it('does not bundle non-selected languages at init', () => {
    expect(i18n.hasResourceBundle('ru', 'translation')).toBe(false);
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(false);
  });

  it('loads a language lazily on changeLanguage', async () => {
    if (!dynamicImportWorks) {
      console.warn('Skipping: run jest with --experimental-vm-modules');
      return;
    }
    expect(i18n.hasResourceBundle('de-DE', 'translation')).toBe(false);
    await i18n.changeLanguage('de-DE');
    expect(i18n.hasResourceBundle('de-DE', 'translation')).toBe(true);
    expect(i18n.t('constants.scan')).toBe('Scannen');
  });

  it('maps alias codes to their region file', async () => {
    if (!dynamicImportWorks) {
      console.warn('Skipping: run jest with --experimental-vm-modules');
      return;
    }
    await i18n.changeLanguage('pt');
    expect(i18n.hasResourceBundle('pt', 'translation')).toBe(true);
    expect(i18n.t('constants.scan')).not.toBe('Scan');
  });
});
