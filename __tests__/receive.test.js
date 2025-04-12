import {receivePayment} from '@breeztech/react-native-breez-sdk';

import {fetchOnchainLimits} from '@breeztech/react-native-breez-sdk-liquid';

import {getECashInvoice} from '../app/functions/eCash/wallet';
import {breezLiquidReceivePaymentWrapper} from '../app/functions/breezLiquid';
import customUUID from '../app/functions/customUUID';
import {initializeAddressProcess} from '../app/functions/receiveBitcoin/addressGeneration';
import {
  ecashEventEmitter,
  ECASH_QUOTE_EVENT_NAME,
} from '../context-store/eCash';

// Mock the external dependencies
jest.mock('@breeztech/react-native-breez-sdk', () => ({
  receivePayment: jest.fn(),
}));

jest.mock('../app/functions/eCash/wallet', () => ({
  getECashInvoice: jest.fn(),
}));

jest.mock('../app/functions/breezLiquid', () => ({
  breezLiquidReceivePaymentWrapper: jest.fn(),
}));

jest.mock('@breeztech/react-native-breez-sdk-liquid', () => ({
  fetchOnchainLimits: jest.fn(),
}));

jest.mock('../app/functions/customUUID', () => jest.fn());

jest.mock('../context-store/eCash', () => ({
  ECASH_QUOTE_EVENT_NAME: 'ecash_quote_event',
  ecashEventEmitter: {
    emit: jest.fn(),
  },
}));

describe('initializeAddressProcess', () => {
  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();

    // Set default mock returns if needed
    customUUID.mockReturnValue('test-uuid');
  });

  test('should handle Lightning address generation successfully', async () => {
    // Mock state setter function
    const setAddressState = jest.fn();

    // Mock successful Lightning invoice response
    receivePayment.mockResolvedValue({
      lnInvoice: {
        bolt11: 'ln123456789',
      },
      openingFeeMsat: 0,
    });

    // Mock wallet info object
    const walletInfo = {
      setAddressState,
      selectedRecieveOption: 'Lightning',
      receivingAmount: 1000,
      description: 'Test payment',
      userBalanceDenomination: 'sat',
      nodeInformation: {
        userBalance: 5000,
        inboundLiquidityMsat: 5000000,
      },
      masterInfoObject: {
        enabledEcash: false,
        liquidWalletSettings: {
          isLightningEnabled: true,
          regulateChannelOpen: false,
        },
        userBalanceDenomination: 'sat',
      },
      minMaxSwapAmounts: {
        min: 1000,
        max: 10000,
      },
    };

    // Call the function
    await initializeAddressProcess(walletInfo);

    // Check that setAddressState was called correctly
    expect(setAddressState).toHaveBeenCalledTimes(2);

    // First call should set isGeneratingInvoice to true
    expect(
      setAddressState.mock.calls[0][0]({
        someExistingValue: true,
      }),
    ).toEqual({
      someExistingValue: true,
      isGeneratingInvoice: true,
      generatedAddress: '',
      errorMessageText: {
        type: null,
        text: '',
      },
      swapPegInfo: {},
      isReceivingSwap: false,
      hasGlobalError: false,
    });

    // Second call should update with the invoice data and set isGeneratingInvoice to false
    expect(
      setAddressState.mock.calls[1][0]({
        someExistingValue: true,
      }),
    ).toEqual({
      someExistingValue: true,
      generatedAddress: 'ln123456789',
      fee: 0,
      isGeneratingInvoice: false,
    });

    // Verify receivePayment was called with correct parameters
    expect(receivePayment).toHaveBeenCalledWith({
      amountMsat: 1000 * 1000,
      description: 'Test payment',
    });
  });

  test('should handle Bitcoin address generation successfully', async () => {
    // Mock state setter function
    const setAddressState = jest.fn();

    // Mock successful onchain limits
    fetchOnchainLimits.mockResolvedValue({
      receive: {
        minSat: 10000,
        maxSat: 1000000,
      },
    });

    // Mock successful Bitcoin address response
    breezLiquidReceivePaymentWrapper.mockResolvedValue({
      destination: 'bc1q123456789',
      receiveFeesSat: 1000,
    });

    // Mock wallet info object
    const walletInfo = {
      setAddressState,
      selectedRecieveOption: 'Bitcoin',
      receivingAmount: 50000,
      nodeInformation: {
        userBalance: 5000,
      },
      userBalanceDenomination: 'sat',
      masterInfoObject: {
        userBalanceDenomination: 'sat',
      },
    };

    // Call the function
    await initializeAddressProcess(walletInfo);

    // Check that setAddressState was called correctly
    expect(setAddressState).toHaveBeenCalledTimes(2);

    // Verify Bitcoin payment wrapper was called with correct parameters
    expect(breezLiquidReceivePaymentWrapper).toHaveBeenCalledWith({
      paymentType: 'bitcoin',
      sendAmount: 50000,
    });

    // Final state should contain Bitcoin address
    expect(
      setAddressState.mock.calls[1][0]({
        someExistingValue: true,
      }),
    ).toEqual({
      someExistingValue: true,
      generatedAddress: 'bc1q123456789',
      fee: 1000,
      isGeneratingInvoice: false,
    });
  });

  test('should handle Liquid address generation successfully', async () => {
    // Mock state setter function
    const setAddressState = jest.fn();

    // Mock successful Liquid address response
    breezLiquidReceivePaymentWrapper.mockResolvedValue({
      destination: 'lq1q123456789',
      receiveFeesSat: 500,
    });

    // Mock wallet info object
    const walletInfo = {
      setAddressState,
      selectedRecieveOption: 'Liquid',
      receivingAmount: 5000,
      description: 'Test Liquid payment',
    };

    // Call the function
    await initializeAddressProcess(walletInfo);

    // Check that setAddressState was called correctly
    expect(setAddressState).toHaveBeenCalledTimes(2);

    // Verify Liquid payment wrapper was called with correct parameters
    expect(breezLiquidReceivePaymentWrapper).toHaveBeenCalledWith({
      sendAmount: 5000,
      paymentType: 'liquid',
      description: 'Test Liquid payment',
    });

    // Final state should contain Liquid address
    expect(
      setAddressState.mock.calls[1][0]({
        someExistingValue: true,
      }),
    ).toEqual({
      someExistingValue: true,
      generatedAddress: 'lq1q123456789',
      fee: 500,
      isGeneratingInvoice: false,
    });
  });

  test('should handle eCash invoice generation when conditions are met', async () => {
    // Mock state setter function
    const setAddressState = jest.fn();

    // Mock successful eCash invoice response
    getECashInvoice.mockResolvedValue({
      didWork: true,
      mintQuote: {
        quote: 'ecash-quote-123',
        request: 'ecash-invoice-123',
      },
      mintURL: 'https://mint.example.com',
    });

    // Mock wallet info object with conditions that should trigger eCash path
    const walletInfo = {
      setAddressState,
      selectedRecieveOption: 'Lightning',
      receivingAmount: 100, // Below min swap amount
      description: 'Test eCash payment',
      mintURL: 'https://mint.example.com',
      nodeInformation: {userBalance: 0}, // No lightning channel
      minMaxSwapAmounts: {min: 1000, max: 10000},
      masterInfoObject: {
        enabledEcash: true, // eCash enabled
        liquidWalletSettings: {
          isLightningEnabled: true,
        },
      },
    };

    // Call the function
    await initializeAddressProcess(walletInfo);

    // Check that setAddressState was called correctly
    expect(setAddressState).toHaveBeenCalledTimes(2);

    // Verify eCash invoice function was called
    expect(getECashInvoice).toHaveBeenCalledWith({
      amount: 100,
      mintURL: 'https://mint.example.com',
      descriptoin: 'Test eCash payment', // Note: there's a typo in the original code
    });

    // Verify ecashEventEmitter was called
    expect(ecashEventEmitter.emit).toHaveBeenCalledWith(
      ECASH_QUOTE_EVENT_NAME,
      {
        quote: 'ecash-quote-123',
        counter: 1,
        mintURL: 'https://mint.example.com',
      },
    );

    // Final state should contain eCash invoice
    expect(
      setAddressState.mock.calls[1][0]({
        someExistingValue: true,
      }),
    ).toEqual({
      someExistingValue: true,
      fee: 0,
      generatedAddress: 'ecash-invoice-123',
      isGeneratingInvoice: false,
    });
  });

  test('should handle error during address generation', async () => {
    // Mock state setter function
    const setAddressState = jest.fn();

    // Force an error by making receivePayment throw
    receivePayment.mockRejectedValue(new Error('Network failure'));

    // Mock wallet info object
    const walletInfo = {
      setAddressState,
      selectedRecieveOption: 'Lightning',
      receivingAmount: 1000,
      nodeInformation: {
        userBalance: 5000,
        inboundLiquidityMsat: 5000000,
      },
      masterInfoObject: {
        enabledEcash: false,
        liquidWalletSettings: {
          isLightningEnabled: true,
        },
      },
    };

    // Call the function
    await initializeAddressProcess(walletInfo);

    // Check that setAddressState was called correctly
    expect(setAddressState).toHaveBeenCalledTimes(2);

    // Final state should indicate error
    expect(
      setAddressState.mock.calls[1][0]({
        someExistingValue: true,
      }),
    ).toEqual({
      someExistingValue: true,
      hasGlobalError: true,
      isGeneratingInvoice: false,
    });
  });

  test('should prevent race conditions with UUID tracking', async () => {
    // Set up two sequential calls with different UUIDs
    customUUID.mockReturnValueOnce('uuid-1');
    customUUID.mockReturnValueOnce('uuid-2');

    // Mock state setter function
    const setAddressState = jest.fn();

    // Make first call slow, second call fast
    const slowPromise = new Promise(resolve => {
      setTimeout(() => {
        resolve({
          lnInvoice: {bolt11: 'slow-response'},
          openingFeeMsat: 0,
        });
      }, 50);
    });

    const fastPromise = Promise.resolve({
      lnInvoice: {bolt11: 'fast-response'},
      openingFeeMsat: 0,
    });

    receivePayment.mockReturnValueOnce(slowPromise);
    receivePayment.mockReturnValueOnce(fastPromise);

    // Same wallet info for both calls
    const walletInfo = {
      setAddressState,
      selectedRecieveOption: 'Lightning',
      receivingAmount: 1000,
      description: 'Test race condition',
      nodeInformation: {
        userBalance: 5000,
        inboundLiquidityMsat: 5000000,
      },
      masterInfoObject: {
        enabledEcash: false,
        liquidWalletSettings: {
          isLightningEnabled: true,
        },
      },
    };

    // Start both processes (first slow, then fast)
    const slowProcess = initializeAddressProcess({...walletInfo});
    const fastProcess = initializeAddressProcess({...walletInfo});

    // Wait for both to complete
    await Promise.all([slowProcess, fastProcess]);

    // Only the result of the second call should be applied (due to UUID checking)
    const finalStateUpdate =
      setAddressState.mock.calls[setAddressState.mock.calls.length - 1][0];
    const result = finalStateUpdate({someExistingValue: true});

    expect(result.generatedAddress).toBe('fast-response');
  });
});
