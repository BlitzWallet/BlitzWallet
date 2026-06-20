import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  popTo: jest.fn(),
  replace: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: {
      fiatCurrency: 'USD',
      satDisplay: 'word',
      thousandsSeperator: 'comma',
      userBalanceDenomination: 'sats',
    },
  }),
}));

jest.mock('../context-store/nodeContext', () => ({
  useNodeContext: () => ({
    fiatStats: { coin: 'USD', value: 100000000 },
  }),
}));

jest.mock('../context-store/flashnetContext', () => ({
  useFlashnet: () => ({
    swapUSDPriceDollars: 100000000,
  }),
}));

jest.mock('../context-store/insetsProvider', () => ({
  useGlobalInsets: () => ({
    bottomPadding: 0,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => {
      const translations = {
        'constants.back': 'Back',
        'constants.request': 'Request',
        'constants.paymentDescriptionPlaceholder': 'Payment description',
        'wallet.receivePages.editPaymentInfo.editAmount': 'Edit amount',
        'wallet.receivePages.editPaymentInfo.minUSDSwap': `Minimum ${params?.amount}`,
      };

      return translations[key] || key;
    },
  }),
}));

jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

jest.mock('../app/functions/customUUID', () => jest.fn(() => 'test-uuid'));

jest.mock('../app/functions/displayCorrectDenomination', () =>
  jest.fn(({ amount }) => `${amount} sats`),
);

jest.mock('../app/hooks/useDisplayCurrencyController', () => {
  return function useDisplayCurrencyController({ initialCurrency }) {
    return {
      displayCurrency: initialCurrency,
      currencyRates: {},
      isLoadingRate: false,
      selectCurrency: jest.fn(async () => ({ didWork: true })),
    };
  };
});

jest.mock('../app/hooks/useCurrencyDisplay', () => {
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

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const { View } = require('react-native');

  return {
    CustomKeyboardAvoidingView: ({ children }) =>
      MockReact.createElement(View, { testID: 'keyboard-view' }, children),
  };
});

jest.mock(
  '../app/functions/CustomElements/customNumberKeyboard',
  () =>
    function MockCustomNumberKeyboard({ setInputValue }) {
      const MockReact = require('react');
      const { TextInput, View } = require('react-native');

      return MockReact.createElement(
        View,
        { testID: 'number-keyboard' },
        MockReact.createElement(TextInput, {
          testID: 'amount-input',
          value: '',
          onChangeText: setInputValue,
        }),
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/formattedBalanceInput',
  () =>
    function MockFormattedBalanceInput({
      amountValue,
      placeholderAmountValue,
      inputDenomination,
    }) {
      const MockReact = require('react');
      const { Text } = require('react-native');

      return MockReact.createElement(
        Text,
        { testID: 'amount-display' },
        amountValue || placeholderAmountValue || '',
        inputDenomination ? ` ${inputDenomination}` : '',
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/satTextDisplay',
  () =>
    function MockFormattedSatText({ balance }) {
      const MockReact = require('react');
      const { Text } = require('react-native');

      return MockReact.createElement(
        Text,
        { testID: 'secondary-amount-display' },
        String(balance),
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/currencySwitchButton',
  () =>
    function MockCurrencySwitchButton({ displayCurrency, onPress }) {
      const MockReact = require('react');
      const { Text, TouchableOpacity } = require('react-native');

      return MockReact.createElement(
        TouchableOpacity,
        { testID: 'currency-switch', onPress },
        MockReact.createElement(Text, null, displayCurrency),
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/searchInput',
  () =>
    function MockCustomSearchInput({
      inputText,
      setInputText,
      placeholderText,
    }) {
      const MockReact = require('react');
      const { TextInput } = require('react-native');

      return MockReact.createElement(TextInput, {
        testID: 'description-input',
        value: inputText,
        placeholder: placeholderText,
        onChangeText: setInputText,
      });
    },
);

jest.mock(
  '../app/functions/CustomElements/button',
  () =>
    function MockCustomButton({ actionFunction, textContent, buttonStyles }) {
      const MockReact = require('react');
      const { Text, TouchableOpacity } = require('react-native');

      return MockReact.createElement(
        TouchableOpacity,
        {
          testID: 'submit-button',
          onPress: actionFunction,
          style: buttonStyles,
        },
        MockReact.createElement(
          Text,
          { testID: 'submit-button-text' },
          textContent,
        ),
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/settingsTopBar',
  () =>
    function MockCustomSettingsTopBar({ label }) {
      const MockReact = require('react');
      const { Text } = require('react-native');

      return MockReact.createElement(
        Text,
        { testID: 'top-bar-label' },
        label,
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/emojiBar',
  () =>
    function MockEmojiQuickBar() {
      return null;
    },
);

const EditReceivePaymentInformation = require('../app/components/admin/homeComponents/receiveBitcoin/editPaymentInformation')
  .default;

function renderEditPaymentInformation(routeParams = {}) {
  const params = {
    from: 'receivePage',
    receiveType: 'Lightning',
    endReceiveType: 'BTC',
    userReceiveAmount: 0,
    description: '',
    ...routeParams,
  };

  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <EditReceivePaymentInformation route={{ params }} />,
    );
  });

  return renderer;
}

function textByTestId(renderer, testID) {
  function flattenText(value) {
    if (Array.isArray(value)) {
      return value.map(flattenText).join('');
    }

    if (React.isValidElement(value)) {
      return flattenText(value.props.children);
    }

    return value === null || value === undefined ? '' : String(value);
  }

  return flattenText(renderer.root.findByProps({ testID }).props.children);
}

function pressSubmit(renderer) {
  act(() => {
    renderer.root.findByProps({ testID: 'submit-button' }).props.onPress();
  });
}

function enterAmount(renderer, value) {
  act(() => {
    renderer.root
      .findByProps({ testID: 'amount-input' })
      .props.onChangeText(value);
  });
}

function enterDescription(renderer, value) {
  act(() => {
    renderer.root
      .findByProps({ testID: 'description-input' })
      .props.onChangeText(value);
  });
}

function descriptionInput(renderer) {
  return renderer.root.findByProps({ testID: 'description-input' }).props;
}

function expectReceivePageUpdate({ amount, description, method = 'popTo' }) {
  const expectedParams = {
    receiveAmount: amount,
    description,
    endReceiveType: 'BTC',
    uuid: 'test-uuid',
    // Carried back so ReceiveBTC re-opens in the currency the amount was edited
    // in. BTC mode defaults to SATS; conversionFiatStats is the mocked USD rate.
    paymentDisplayCurrency: 'SATS',
    paymentDisplayFiatStats: { coin: 'USD', value: 100000000 },
  };

  if (method === 'replace') {
    expect(mockNavigation.replace).toHaveBeenCalledWith(
      'ReceiveBTC',
      expectedParams,
    );
    return;
  }

  expect(mockNavigation.popTo).toHaveBeenCalledWith(
    'ReceiveBTC',
    expectedParams,
    { merge: true },
  );
}

describe('EditReceivePaymentInformation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unchanged states', () => {
    test.each([
      ['no previous amount or description', {}],
      ['previous description only', { description: 'Coffee' }],
      ['previous amount only', { userReceiveAmount: 5000 }],
      [
        'previous amount and description',
        { userReceiveAmount: 5000, description: 'Coffee' },
      ],
    ])('shows Back and goes back when unchanged: %s', (_, routeParams) => {
      const renderer = renderEditPaymentInformation(routeParams);

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Back');

      pressSubmit(renderer);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.popTo).not.toHaveBeenCalled();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
    });

    test('keeps Back when the user types the same previous amount', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterAmount(renderer, '5000');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Back');

      pressSubmit(renderer);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.popTo).not.toHaveBeenCalled();
    });

    test('keeps Back when the user types the same previous description', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterDescription(renderer, 'Coffee');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Back');

      pressSubmit(renderer);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.popTo).not.toHaveBeenCalled();
    });
  });

  describe('placeholder display', () => {
    test('shows the previous amount as a placeholder and prefills the description input', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      expect(textByTestId(renderer, 'amount-display')).toBe('5000 sats');
      expect(descriptionInput(renderer).value).toBe('Coffee');
      expect(descriptionInput(renderer).placeholder).toBe(
        'Payment description',
      );
      expect(textByTestId(renderer, 'submit-button-text')).toBe('Back');
    });

    test('uses the generic description placeholder when no previous description exists', () => {
      const renderer = renderEditPaymentInformation();

      expect(descriptionInput(renderer).placeholder).toBe(
        'Payment description',
      );
    });
  });

  describe('creating requests with no previous values', () => {
    test('requests a description-only invoice from an empty state', () => {
      const renderer = renderEditPaymentInformation();

      enterDescription(renderer, 'Coffee');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 0, description: 'Coffee' });
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    test('requests an amount-only invoice from an empty state', () => {
      const renderer = renderEditPaymentInformation();

      enterAmount(renderer, '5000');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 5000, description: '' });
    });

    test('requests an invoice with both amount and description from an empty state', () => {
      const renderer = renderEditPaymentInformation();

      enterAmount(renderer, '5000');
      enterDescription(renderer, 'Coffee');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 5000, description: 'Coffee' });
    });
  });

  describe('overriding previous values', () => {
    test('adds a description while preserving the previous amount', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
      });

      enterDescription(renderer, 'Coffee');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 5000, description: 'Coffee' });
    });

    test('adds an amount while preserving the previous description placeholder', () => {
      const renderer = renderEditPaymentInformation({
        description: 'Coffee',
      });

      enterAmount(renderer, '5000');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 5000, description: 'Coffee' });
    });

    test('overrides only the previous amount and preserves the previous description', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterAmount(renderer, '7500');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 7500, description: 'Coffee' });
    });

    test('overrides only the previous description and preserves the previous amount', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterDescription(renderer, 'Dinner');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 5000, description: 'Dinner' });
    });

    test('overrides both previous amount and previous description', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterAmount(renderer, '7500');
      enterDescription(renderer, 'Dinner');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 7500, description: 'Dinner' });
    });

    test('clears a previous amount only when the user explicitly enters zero', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterAmount(renderer, '0');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 0, description: 'Coffee' });
    });

    test('clears a previous description when the input is emptied while the amount changes', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterAmount(renderer, '7500');
      enterDescription(renderer, '');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 7500, description: '' });
    });

    test('clears a previous description while preserving the previous amount', () => {
      const renderer = renderEditPaymentInformation({
        userReceiveAmount: 5000,
        description: 'Coffee',
      });

      enterDescription(renderer, '');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expectReceivePageUpdate({ amount: 5000, description: '' });
    });
  });

  describe('navigation variants and validation', () => {
    test('uses replace when the edit screen was opened from the homepage', () => {
      const renderer = renderEditPaymentInformation({
        from: 'homepage',
      });

      enterAmount(renderer, '5000');
      enterDescription(renderer, 'Coffee');

      pressSubmit(renderer);

      expectReceivePageUpdate({
        amount: 5000,
        description: 'Coffee',
        method: 'replace',
      });
      expect(mockNavigation.popTo).not.toHaveBeenCalled();
    });

    test('blocks USD lightning requests below the receive minimum', () => {
      const renderer = renderEditPaymentInformation({
        endReceiveType: 'USD',
      });

      enterAmount(renderer, '1999');

      expect(textByTestId(renderer, 'submit-button-text')).toBe('Request');

      pressSubmit(renderer);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
        errorMessage: 'Minimum 2000 sats',
      });
      expect(mockNavigation.popTo).not.toHaveBeenCalled();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
    });

    test('allows USD lightning requests at the receive minimum', () => {
      const renderer = renderEditPaymentInformation({
        endReceiveType: 'USD',
      });

      enterAmount(renderer, '2000');

      pressSubmit(renderer);

      expect(mockNavigation.navigate).not.toHaveBeenCalledWith(
        'ErrorScreen',
        expect.anything(),
      );
      expect(mockNavigation.popTo).toHaveBeenCalledWith(
        'ReceiveBTC',
        {
          receiveAmount: 2000,
          description: '',
          endReceiveType: 'USD',
          uuid: 'test-uuid',
          paymentDisplayCurrency: 'USD',
          paymentDisplayFiatStats: { coin: 'USD', value: 100000000 },
        },
        { merge: true },
      );
    });

    test('does not validate the USD minimum when an explicit zero clears the amount', () => {
      const renderer = renderEditPaymentInformation({
        endReceiveType: 'USD',
        userReceiveAmount: 5000,
      });

      enterAmount(renderer, '0');

      pressSubmit(renderer);

      expect(mockNavigation.navigate).not.toHaveBeenCalledWith(
        'ErrorScreen',
        expect.anything(),
      );
      expect(mockNavigation.popTo).toHaveBeenCalledWith(
        'ReceiveBTC',
        {
          receiveAmount: 0,
          description: '',
          endReceiveType: 'USD',
          uuid: 'test-uuid',
          paymentDisplayCurrency: 'USD',
          paymentDisplayFiatStats: { coin: 'USD', value: 100000000 },
        },
        { merge: true },
      );
    });
  });
});
