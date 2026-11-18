import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  GlobalThemeProvider,
  useGlobalThemeContext,
  useTheme,
} from '../../context-store/theme';
import {MODES, SKINS} from '../../app/constants/themes';

// In-memory stand-in for AsyncStorage-backed helpers used by theme.js.
let mockStore = {};
jest.mock('../../app/functions', () => ({
  getLocalStorageItem: jest.fn(key =>
    Promise.resolve(key in mockStore ? mockStore[key] : null),
  ),
  setLocalStorageItem: jest.fn((key, val) => {
    mockStore[key] = val;
    return Promise.resolve(true);
  }),
}));

// ACTIVE_SKIN is a build-time constant; a getter lets each test pick it.
let mockSkin = null;
jest.mock('../../app/constants/themes', () => {
  const actual = jest.requireActual('../../app/constants/themes');
  // defineProperty, not an object-literal getter: babel's spread helper
  // would read the getter once at creation.
  return Object.defineProperty({__esModule: true, ...actual}, 'ACTIVE_SKIN', {
    get: () => mockSkin,
  });
});

let ctx;
let themeHook;
function Consumer() {
  ctx = useGlobalThemeContext();
  themeHook = useTheme();
  return null;
}

async function mount() {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <GlobalThemeProvider>
        <Consumer />
      </GlobalThemeProvider>,
    );
  });
  return renderer;
}

beforeEach(() => {
  mockStore = {};
  mockSkin = null;
});

describe('mode mapping (pins GetThemeColors: theme=true is dark, darkModeType=true is Lights out)', () => {
  it.each([
    [false, false, 'light'],
    [false, true, 'light'],
    [true, false, 'dim'],
    [true, true, 'lightsOut'],
  ])('theme=%s darkModeType=%s → %s', async (theme, darkModeType, mode) => {
    const r = await mount();
    await act(async () => {
      ctx.toggleTheme(theme);
      ctx.toggleDarkModeType(darkModeType);
    });
    expect(ctx.theme).toBe(theme);
    expect(ctx.darkModeType).toBe(darkModeType);
    expect(themeHook.mode).toBe(mode);
    act(() => r.unmount());
  });
});

describe('load rules (theme.js: darkModeType = saved === "dim", null → true; theme = stored !== "dark", null → false)', () => {
  it.each([
    [undefined, undefined, false, true, 'light'],
    ['dark', undefined, false, true, 'light'],
    ['dark', 'lights-out', false, false, 'light'],
    ['light', undefined, true, true, 'lightsOut'],
    ['light', 'dim', true, true, 'lightsOut'],
    ['light', 'lights-out', true, false, 'dim'],
    // any non-'dark' string reads as theme=true; any non-'dim' string as false
    ['garbage', 'garbage', true, false, 'dim'],
  ])(
    'colorScheme=%s darkModeType=%s → theme=%s darkModeType=%s mode=%s',
    async (storedTheme, savedDark, theme, darkModeType, mode) => {
      if (storedTheme !== undefined) mockStore.colorScheme = storedTheme;
      if (savedDark !== undefined) mockStore.darkModeType = savedDark;
      const r = await mount();
      expect(ctx.theme).toBe(theme);
      expect(ctx.darkModeType).toBe(darkModeType);
      expect(themeHook.mode).toBe(mode);
      act(() => r.unmount());
    },
  );
});

describe('storage round-trip', () => {
  it.each([
    [false, true, 'dark', 'dim', 'light'],
    [true, false, 'light', 'lights-out', 'dim'],
    [true, true, 'light', 'dim', 'lightsOut'],
  ])(
    'toggle(%s, %s) stores colorScheme=%s darkModeType=%s and reloads as %s',
    async (theme, darkModeType, storedTheme, storedDark, mode) => {
      const first = await mount();
      await act(async () => {
        ctx.toggleTheme(theme);
        ctx.toggleDarkModeType(darkModeType);
      });
      expect(mockStore).toEqual({
        colorScheme: storedTheme,
        darkModeType: storedDark,
      });
      expect(themeHook.mode).toBe(mode);
      act(() => first.unmount());

      const second = await mount();
      expect(ctx.theme).toBe(theme);
      expect(ctx.darkModeType).toBe(darkModeType);
      expect(themeHook.mode).toBe(mode);
      act(() => second.unmount());
    },
  );
});

describe('tokens', () => {
  it.each([
    ['light', undefined, undefined],
    ['dim', 'light', 'lights-out'],
    ['lightsOut', 'light', 'dim'],
  ])('%s with no skin equals MODES[mode]', async (mode, scheme, dark) => {
    if (scheme) mockStore.colorScheme = scheme;
    if (dark) mockStore.darkModeType = dark;
    const r = await mount();
    expect(themeHook.mode).toBe(mode);
    expect(themeHook.tokens).toEqual(MODES[mode]);
    expect(themeHook.scheme).toBe(MODES[mode].scheme);
    act(() => r.unmount());
  });

  it('every mode has the same token keys', () => {
    const keys = Object.keys(MODES.light).sort();
    expect(Object.keys(MODES.dim).sort()).toEqual(keys);
    expect(Object.keys(MODES.lightsOut).sort()).toEqual(keys);
  });

  it.each(['light', 'dim', 'lightsOut'])(
    'canary skin replaces only its listed keys in %s',
    async mode => {
      mockSkin = 'canary';
      if (mode !== 'light') mockStore.colorScheme = 'light';
      if (mode === 'dim') mockStore.darkModeType = 'lights-out';
      const r = await mount();
      expect(themeHook.mode).toBe(mode);
      const overrides = SKINS.canary.overrides[mode];
      expect(overrides).toEqual({ground: '#FF00FF', ink: '#00FF00'});
      expect(themeHook.tokens).toEqual({...MODES[mode], ...overrides});
      for (const key of Object.keys(MODES[mode])) {
        if (!(key in overrides)) {
          expect(themeHook.tokens[key]).toBe(MODES[mode][key]);
        }
      }
      act(() => r.unmount());
    },
  );

  it('is referentially stable across re-renders with the same inputs', async () => {
    const r = await mount();
    const before = themeHook.tokens;
    await act(async () => {
      r.update(
        <GlobalThemeProvider>
          <Consumer />
        </GlobalThemeProvider>,
      );
    });
    expect(themeHook.tokens).toBe(before);
    // same mode via a no-op toggle keeps the same object
    await act(async () => {
      ctx.toggleTheme(ctx.theme);
    });
    expect(themeHook.tokens).toBe(before);
    act(() => r.unmount());
  });
});
