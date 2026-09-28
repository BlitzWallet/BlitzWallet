import React from 'react';
import { Platform, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import ThemeIcon from '../../../app/functions/CustomElements/themeIcon';

// Avoid pulling the native secure-store chain through context-store/theme.
jest.mock('../../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false }),
}));

// themeIcon.js loads icons through './lucideIcons', which jest maps to
// __mocks__/lucideIcons.js (real icon files can't be parsed under jest).
// Stub the icon itself so we can assert on the style props it receives.
const MockSvg = props => React.createElement('MockSvg', props);
jest.mock('../../../__mocks__/lucideIcons', () => ({
  __esModule: true,
  default: () => MockSvg,
}));

const REAL_OS = Platform.OS;

afterEach(() => {
  Platform.OS = REAL_OS;
});

function renderIcon(styles) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeIcon iconName="ChevronDown" size={22} styles={styles} />,
    );
  });
  return renderer;
}

test('on web the transform is applied to a wrapper View, not the Svg', () => {
  Platform.OS = 'web';
  const renderer = renderIcon({ transform: [{ rotate: '180deg' }] });

  const wrapper = renderer.root.findByType(View);
  expect(wrapper.props.style).toEqual({
    transform: [{ rotate: '180deg' }],
  });

  // The inner Svg must not carry the RN transform array (invalid CSS that
  // rotates around 0,0 and makes the glyph disappear).
  const svg = renderer.root.findByType(MockSvg);
  expect(svg.props.style.transform).toBeUndefined();
  expect(svg.props.style.color).toBeDefined();
});

test('on web without a transform there is no wrapper View', () => {
  Platform.OS = 'web';
  const renderer = renderIcon({ opacity: 0.5 });
  expect(renderer.root.findAllByType(View)).toHaveLength(0);
  const svg = renderer.root.findByType(MockSvg);
  expect(svg.props.style).toEqual(
    expect.objectContaining({ opacity: 0.5 }),
  );
});

test('on native the transform stays on the icon style (unchanged behavior)', () => {
  Platform.OS = 'ios';
  const renderer = renderIcon({ transform: [{ rotate: '180deg' }] });
  expect(renderer.root.findAllByType(View)).toHaveLength(0);
  const svg = renderer.root.findByType(MockSvg);
  expect(svg.props.style.transform).toEqual([{ rotate: '180deg' }]);
});
