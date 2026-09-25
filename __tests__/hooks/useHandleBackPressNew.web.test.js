import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// The web hook installs window listeners at import, so capture them on a fake
// window.history (the react-native jest env has window === global).
const mockListeners = {};
const mockNav = { canGoBack: jest.fn(), goBack: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: callback => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../navigation/navigationService', () => ({
  navigationRef: mockNav,
}));

window.addEventListener = (type, listener) => {
  mockListeners[type] = listener;
};
window.history = {
  state: null,
  pushState: jest.fn(state => {
    window.history.state = state;
  }),
  forward: jest.fn(),
};

const useHandleBackPressNew =
  require('../../app/hooks/useHandleBackPressNew.web').default;

function Screen({ onBack }) {
  useHandleBackPressNew(onBack);
  return null;
}

function mount(onBack) {
  let tree;
  act(() => {
    tree = ReactTestRenderer.create(<Screen onBack={onBack} />);
  });
  return tree;
}

const pressBack = state => mockListeners.popstate({ state });

beforeEach(() => {
  jest.clearAllMocks();
  window.history.state = null;
});

test('a tap arms the trap once and our own forward() popstate is ignored', () => {
  mockListeners.pointerup();
  mockListeners.pointerup();
  expect(window.history.pushState).toHaveBeenCalledTimes(1);

  pressBack({ blitzBackTrap: true });
  expect(window.history.forward).not.toHaveBeenCalled();
  expect(mockNav.goBack).not.toHaveBeenCalled();
});

test('newest focused handler wins and a handled back re-arms via forward(), never pushState', () => {
  const calls = [];
  const outer = mount(() => calls.push('outer') > 0);
  const inner = mount(() => calls.push('inner') > 0);

  pressBack(null);
  expect(calls).toEqual(['inner']);
  expect(window.history.forward).toHaveBeenCalledTimes(1);
  // pushState during popstate has no user activation -> Chrome would make
  // every entry skippable and the next back would close the tab.
  expect(window.history.pushState).not.toHaveBeenCalled();
  expect(mockNav.goBack).not.toHaveBeenCalled();

  act(() => inner.unmount()); // blur unregisters
  pressBack(null);
  expect(calls).toEqual(['inner', 'outer']);
  act(() => outer.unmount());
});

test('unhandled back uses goBack when possible, otherwise stays disarmed at root', () => {
  const screen = mount(() => false);

  mockNav.canGoBack.mockReturnValue(true);
  pressBack(null);
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  expect(window.history.forward).toHaveBeenCalledTimes(1);

  mockNav.canGoBack.mockReturnValue(false);
  pressBack(null);
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  expect(window.history.forward).toHaveBeenCalledTimes(1);
  act(() => screen.unmount());
});
