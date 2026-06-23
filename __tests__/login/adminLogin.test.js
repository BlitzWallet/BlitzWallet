import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks — factories use require() to avoid out-of-scope variable restrictions
// ---------------------------------------------------------------------------

// Mock child components with tiny identifiable markers
jest.mock('../../app/components/admin/loginComponents/pinPage', () => ({
  __esModule: true,
  default: function MockPinPage() {
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'pin-page' }, 'PinPage');
  },
}));

jest.mock('../../app/components/admin/loginComponents/biometricsPage', () => ({
  __esModule: true,
  default: function MockBiometricsLogin() {
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'biometrics-page' }, 'BiometricsLogin');
  },
}));

// GlobalThemeView: passthrough wrapper
jest.mock('../../app/functions/CustomElements', () => ({
  __esModule: true,
  GlobalThemeView: function MockGlobalThemeView({ children }) {
    return require('react').createElement(require('react').Fragment, null, children);
  },
}));

// loginContext mock — useLoginContext is a jest.fn() we control per test
jest.mock('../../context-store/loginContext', () => ({
  __esModule: true,
  useLoginContext: jest.fn(),
}));

const { useLoginContext } = require('../../context-store/loginContext');
const MockPinPage = require('../../app/components/admin/loginComponents/pinPage').default;
const MockBiometricsLogin = require('../../app/components/admin/loginComponents/biometricsPage').default;
const AdminLogin = require('../../app/screens/inAccount/login').default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render() {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(React.createElement(AdminLogin));
  });
  return renderer;
}

function hasBiometrics(renderer) {
  return renderer.root.findAllByType(MockBiometricsLogin).length > 0;
}

function hasPin(renderer) {
  return renderer.root.findAllByType(MockPinPage).length > 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// 1. Biometric state → renders BiometricsLogin, NOT PinPage
test('renders BiometricsLogin when isBiometricEnabled is true', () => {
  useLoginContext.mockReturnValue({
    loginState: {
      hasAccount: true,
      isSecurityEnabled: true,
      isBiometricEnabled: true,
      isPinEnabled: false,
    },
  });

  const renderer = render();
  expect(hasBiometrics(renderer)).toBe(true);
  expect(hasPin(renderer)).toBe(false);
});

// 2. PIN state → renders PinPage, NOT BiometricsLogin
test('renders PinPage when isBiometricEnabled is false', () => {
  useLoginContext.mockReturnValue({
    loginState: {
      hasAccount: true,
      isSecurityEnabled: true,
      isBiometricEnabled: false,
      isPinEnabled: true,
    },
  });

  const renderer = render();
  expect(hasPin(renderer)).toBe(true);
  expect(hasBiometrics(renderer)).toBe(false);
});

// 3. loginState === null → must NOT crash, PinPage must NOT render (bug fix)
test('renders nothing inside wrapper when loginState is null — no crash, no PinPage', () => {
  useLoginContext.mockReturnValue({ loginState: null });

  expect(() => render()).not.toThrow();
  const renderer = render();
  expect(hasPin(renderer)).toBe(false);
  expect(hasBiometrics(renderer)).toBe(false);
});

// 4. loginState === undefined → must NOT crash, PinPage must NOT render
test('renders nothing inside wrapper when loginState is undefined — no crash, no PinPage', () => {
  useLoginContext.mockReturnValue({ loginState: undefined });

  expect(() => render()).not.toThrow();
  const renderer = render();
  expect(hasPin(renderer)).toBe(false);
  expect(hasBiometrics(renderer)).toBe(false);
});

// 5. Biometric takes precedence even if isPinEnabled is also true
test('BiometricsLogin takes precedence over PinPage when both flags are true', () => {
  useLoginContext.mockReturnValue({
    loginState: {
      hasAccount: true,
      isSecurityEnabled: true,
      isBiometricEnabled: true,
      isPinEnabled: true,
    },
  });

  const renderer = render();
  expect(hasBiometrics(renderer)).toBe(true);
  expect(hasPin(renderer)).toBe(false);
});
