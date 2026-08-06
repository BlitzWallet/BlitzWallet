// The sms4sats "sent payments" history screen builds the orderstatus request as
// `${API_ENDPOINTS.ORDER_STATUS}?orderId=${orderId}` without URL-encoding the
// orderId. A stored orderId containing reserved query characters (`&`, `#`, `=`)
// is therefore spliced straight into the request line as additional query
// parameters or a fragment, letting a value of `abc&admin=true` silently mutate
// the API call into `orderstatus?orderId=abc&admin=true`. This test pins the
// behaviour down: the orderId must travel as a single, encoded query value.
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = { navigate: jest.fn() };
const mockT = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

const mockToggleGlobalAppDataInformation = jest.fn();
const mockShowToast = jest.fn();
const mockEncrypt = jest.fn(() => 'encrypted-blob');

let mockMessages = { received: [], sent: [] };

jest.mock('../../../../../../context-store/appData', () => ({
  useGlobalAppData: () => ({
    decodedMessages: mockMessages,
    toggleGlobalAppDataInformation: mockToggleGlobalAppDataInformation,
  }),
}));

jest.mock('../../../../../../context-store/toastManager', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../../../../../../context-store/keys', () => ({
  useKeysContext: () => ({
    contactsPrivateKey: 'a'.repeat(64),
    publicKey: 'b'.repeat(66),
  }),
}));

jest.mock('../../../../../../app/functions', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock(
  '../../../../../../app/functions/messaging/encodingAndDecodingMessages',
  () => ({
    encriptMessage: (...args) => mockEncrypt(...args),
  }),
);

jest.mock('../../../../../../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    GlobalThemeView: ({ children }) =>
      MockReact.createElement(RN.View, null, children),
    ThemeText: ({ content, ...rest }) =>
      MockReact.createElement(RN.Text, rest, content),
  };
});

jest.mock('../../../../../../app/functions/CustomElements/settingsTopBar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../../../../app/functions/CustomElements/button', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ actionFunction, textContent }) =>
      MockReact.createElement(
        RN.TouchableOpacity,
        { testID: 'sms-action-button', onPress: actionFunction },
        MockReact.createElement(RN.Text, null, textContent),
      ),
  };
});

jest.mock('../../../../../../app/functions/CustomElements/themeIcon', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: () => MockReact.createElement(RN.Text, null, 'icon'),
  };
});

jest.mock('../../../../../../app/functions/CustomElements/noContentScreen', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: () => MockReact.createElement(RN.Text, null, 'no-content'),
  };
});

const HistoricalSMSMessagingPage = require('../../../../../../app/components/admin/homeComponents/apps/sms4sats/sentPayments')
  .default;

const ORDER_STATUS_ENDPOINT = 'https://api2.sms4sats.com/orderstatus';

describe('sms4sats sentPayments orderstatus request', () => {
  beforeEach(() => {
    mockNavigate.navigate.mockReset();
    mockToggleGlobalAppDataInformation.mockReset();
    mockShowToast.mockReset();
    mockEncrypt.mockReset();
    mockEncrypt.mockReturnValue('encrypted-blob');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ paid: true, code: '424242' }),
    });
  });

  it('URL-encodes the orderId so it cannot inject extra query parameters', async () => {
    mockMessages = {
      received: [
        {
          orderId: 'abc&admin=true',
          title: 'WhatsApp',
          isPending: true,
          isRefunded: false,
          createdAt: 1,
        },
      ],
      sent: [],
    };

    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <HistoricalSMSMessagingPage
          route={{ params: { selectedPage: 'receive' } }}
        />,
      );
      await Promise.resolve();
    });

    const actionButton = renderer.root.findByProps({
      testID: 'sms-action-button',
    });

    await act(async () => {
      actionButton.props.onPress();
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl.startsWith(`${ORDER_STATUS_ENDPOINT}?orderId=`)).toBe(true);
    expect(calledUrl).toBe(
      `${ORDER_STATUS_ENDPOINT}?orderId=${encodeURIComponent('abc&admin=true')}`,
    );
  });
});
