import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
  popTo: jest.fn(),
  replace: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../../../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: {
      fiatCurrency: 'USD',
      userBalanceDenomination: 'sats',
    },
  }),
}));

jest.mock('../../../context-store/nodeContext', () => ({
  useNodeContext: () => ({
    fiatStats: { coin: 'USD', value: 100000000 },
  }),
}));

jest.mock('../../../context-store/flashnetContext', () => ({
  useFlashnet: () => ({
    swapUSDPriceDollars: 100000000,
    poolInfoRef: { currentPriceAInB: 0 },
  }),
}));

jest.mock('../../../app/functions/displayCurrency', () => ({
  getDefaultDisplayCurrency: () => 'SATS',
  resolveUsdFiatStats: (fiatStats, swapUSDPriceDollars) =>
    fiatStats?.coin?.toUpperCase() === 'USD'
      ? fiatStats
      : { coin: 'USD', value: swapUSDPriceDollars },
}));

jest.mock('../../../app/hooks/useDisplayCurrencyController', () => {
  return function useDisplayCurrencyController({ initialCurrency }) {
    return {
      displayCurrency: initialCurrency,
      currencyRates: {},
      isLoadingRate: false,
      selectCurrency: jest.fn(async () => ({ didWork: true })),
    };
  };
});

jest.mock('../../../app/hooks/useCurrencyDisplay', () => {
  return function useCurrencyDisplay({ displayCurrency }) {
    const denomination = displayCurrency === 'SATS' ? 'sats' : 'fiat';

    return {
      primaryDisplay: {
        denomination,
        forceCurrency: displayCurrency === 'SATS' ? null : displayCurrency,
        forceFiatStats:
          displayCurrency === 'SATS'
            ? null
            : { coin: displayCurrency, value: 100000000 },
      },
      conversionFiatStats: { coin: 'USD', value: 100000000 },
      convertSatsToDisplay: amount => (amount ? String(amount) : ''),
      convertDisplayToSats: amount => Math.round(Number(amount) || 0),
    };
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => {
      const translations = {
        'constants.save': 'Save',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock(
  '../../../app/functions/CustomElements/textTheme',
  () =>
    function MockThemeText({ content }) {
      const MockReact = require('react');
      const { Text } = require('react-native');
      return MockReact.createElement(Text, { testID: 'theme-text' }, content);
    },
);

jest.mock(
  '../../../app/functions/CustomElements/formattedBalanceInput',
  () =>
    function MockFormattedBalanceInput() {
      const MockReact = require('react');
      const { View } = require('react-native');
      return MockReact.createElement(View, { testID: 'balance-input' });
    },
);

jest.mock(
  '../../../app/functions/CustomElements/customNumberKeyboard',
  () =>
    function MockCustomNumberKeyboard() {
      const MockReact = require('react');
      const { View } = require('react-native');
      return MockReact.createElement(View, { testID: 'number-keyboard' });
    },
);

jest.mock(
  '../../../app/functions/CustomElements/button',
  () =>
    function MockCustomButton({ actionFunction }) {
      const MockReact = require('react');
      const { TouchableOpacity } = require('react-native');
      return MockReact.createElement(TouchableOpacity, {
        testID: 'submit-button',
        onPress: actionFunction,
      });
    },
);

jest.mock(
  '../../../app/functions/CustomElements/currencySwitchButton',
  () =>
    function MockCurrencySwitchButton() {
      return null;
    },
);

jest.mock('../../../app/functions/spark/flashnet', () => ({
  satsToDollars: () => '0.00',
}));

const CustomInputHalfModal = require('../../../app/functions/CustomElements/CustomInputHalfModal')
  .default;

function renderHalfModal(overrides = {}) {
  const props = {
    handleBackPressFunction: callback => callback(),
    setContentHeight: jest.fn(),
    message: '',
    type: 'customInputText',
    returnLocation: 'CreateNostrConnectAccount',
    forceUSD: false,
    setBackNav: jest.fn(),
    passedParams: null,
    ...overrides,
  };

  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<CustomInputHalfModal {...props} />);
  });

  return renderer;
}

function pressSubmit(renderer) {
  act(() => {
    renderer.root.findByProps({ testID: 'submit-button' }).props.onPress();
  });
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('CustomInputHalfModal return path', () => {
  it('carries only the whitelisted passedParams keys back via popTo', () => {
    const renderer = renderHalfModal({
      passedParams: {
        accountID: 'nwc-account-public-key',
        privateKey: 'SENSITIVE_PRIVATE_KEY',
        secret: 'SENSITIVE_CONNECTION_SECRET',
        data: { privateKey: 'SENSITIVE_NESTED_KEY' },
      },
    });

    pressSubmit(renderer);

    expect(mockNavigation.popTo).toHaveBeenCalledTimes(1);
    expect(mockNavigation.popTo).toHaveBeenCalledWith(
      'CreateNostrConnectAccount',
      {
        accountID: 'nwc-account-public-key',
        amount: 0,
        type: 'customInputText',
      },
    );

    const serializedCall = JSON.stringify(mockNavigation.popTo.mock.calls[0]);
    expect(serializedCall).not.toContain('SENSITIVE');
  });

  it('drops secret material even when the caller spread unknown params', () => {
    const renderer = renderHalfModal({
      passedParams: {
        secret: 'SENSITIVE_CONNECTION_SECRET',
        accountID: 'nwc-account-public-key',
      },
    });

    pressSubmit(renderer);

    expect(mockNavigation.popTo).toHaveBeenCalledWith(
      'CreateNostrConnectAccount',
      {
        accountID: 'nwc-account-public-key',
        amount: 0,
        type: 'customInputText',
      },
    );
  });

  it('does not add accountID when the caller did not provide one', () => {
    const renderer = renderHalfModal({
      passedParams: { returnLocation: 'CreateNostrConnectAccount' },
    });

    pressSubmit(renderer);

    expect(mockNavigation.popTo).toHaveBeenCalledWith(
      'CreateNostrConnectAccount',
      {
        amount: 0,
        type: 'customInputText',
      },
    );
  });
});
