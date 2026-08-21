import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Regression cover for the toggle desync reported as "left the wallet, came
// back, colors changed and buttons stopped working".
//
// The pill used to call withTiming() *inside* useAnimatedStyle. Reanimated's
// styleUpdater only honours the forced update it fires when a view is
// re-attached on its no-animation branch, and otherwise gates the transform
// behind an isAnimationRunning latch. So once a background/foreground rebuilt
// the native view, the transform stopped being pushed and the pill snapped back
// to the translateX frozen into the props at first render (PropsFilter caches
// initial.value on _isFirstRender), while the controlled prop still said
// option 2. Tapping option 2 then set state to the value it already held, React
// bailed out, nothing re-rendered, and the toggle looked dead.
//
// These tests pin the two properties that keep that from coming back:
//   1. the animated style returns a PLAIN translateX (no animation object), so
//      Reanimated's re-attach repair path stays enabled, and
//   2. the value it returns always tracks the current selectedDisplayOption.
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = 400;
// Mirrors the component's sizing math: min(round(width * 0.9), 500) then
// (finalWidth - 10) / 2.
const EXPECTED_BUTTON_WIDTH = (Math.min(Math.round(SCREEN_WIDTH * 0.9), 500) - 10) / 2;

// Captures the worklet handed to useAnimatedStyle so tests can run it directly.
const mockAnimated = { updater: null };

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }) =>
        ReactModule.createElement(View, props, children),
    },
    useAnimatedStyle: updater => {
      mockAnimated.updater = updater;
      return updater();
    },
    // Shared values keep identity across renders and, like Reanimated's
    // valueSetter, resolve an assigned animation by running it - here it settles
    // on its target immediately.
    useSharedValue: initial => {
      const ref = ReactModule.useRef(null);
      if (ref.current === null) {
        let current = initial;
        ref.current = {
          get value() {
            return current;
          },
          set value(next) {
            current = next && next.__isAnimation ? next.toValue : next;
          },
        };
      }
      return ref.current;
    },
    // The real withTiming returns an ANIMATION OBJECT, not a number. That is the
    // whole point: an animation object left inside the style is what disabled
    // Reanimated's re-attach repair path.
    withTiming: toValue => ({
      __isAnimation: true,
      toValue,
      current: toValue,
      onFrame: () => true,
    }),
  };
});

jest.mock('../../../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { width: SCREEN_WIDTH, height: 800 } }),
}));

jest.mock('../../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../../../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#eee', backgroundColor: '#fff' }),
}));

jest.mock('../../../app/functions/CustomElements/textTheme', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ content }) => ReactModule.createElement(Text, null, content),
  };
});

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const WordsQrToggle =
  require('../../../app/functions/CustomElements/wordsQrToggle').default;

function renderToggle(props) {
  let tree;
  act(() => {
    tree = ReactTestRenderer.create(<WordsQrToggle {...props} />);
  });
  return tree;
}

function currentTranslateX() {
  const { transform } = mockAnimated.updater();
  return transform.find(entry => 'translateX' in entry).translateX;
}

const baseProps = {
  setSelectedDisplayOption: jest.fn(),
  option1Text: 'Personal',
  option2Text: 'Managed',
  option1Value: 'personal',
  option2Value: 'linked',
};

beforeEach(() => {
  mockAnimated.updater = null;
  baseProps.setSelectedDisplayOption = jest.fn();
});

describe('WordsQrToggle pill position', () => {
  it('returns a plain translateX, never an animation object', () => {
    renderToggle({ ...baseProps, selectedDisplayOption: 'personal' });

    const translateX = currentTranslateX();

    // An object carrying `onFrame` is a Reanimated animation. Its presence in
    // the style is what disabled the re-attach repair path.
    expect(typeof translateX).toBe('number');
    expect(translateX).not.toHaveProperty('onFrame');
  });

  it('sits at the left edge when option 1 is selected', () => {
    renderToggle({ ...baseProps, selectedDisplayOption: 'personal' });

    expect(currentTranslateX()).toBe(0);
  });

  it('sits over option 2 when option 2 is selected on mount', () => {
    renderToggle({ ...baseProps, selectedDisplayOption: 'linked' });

    expect(currentTranslateX()).toBe(EXPECTED_BUTTON_WIDTH);
  });

  it('follows the controlled prop when the selection changes', () => {
    const tree = renderToggle({ ...baseProps, selectedDisplayOption: 'personal' });
    expect(currentTranslateX()).toBe(0);

    act(() => {
      tree.update(<WordsQrToggle {...baseProps} selectedDisplayOption="linked" />);
    });

    expect(currentTranslateX()).toBe(EXPECTED_BUTTON_WIDTH);
  });

  it('re-running the style updater keeps the option 2 position', () => {
    // Stands in for Reanimated re-running the updater after a view re-attach
    // (background -> foreground). It must still report option 2's offset rather
    // than the position captured at first render.
    const tree = renderToggle({ ...baseProps, selectedDisplayOption: 'personal' });

    act(() => {
      tree.update(<WordsQrToggle {...baseProps} selectedDisplayOption="linked" />);
    });

    expect(currentTranslateX()).toBe(EXPECTED_BUTTON_WIDTH);
    expect(currentTranslateX()).toBe(EXPECTED_BUTTON_WIDTH);
  });
});
