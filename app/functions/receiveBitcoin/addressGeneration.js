import {
  openChannelFee,
  receivePayment,
} from '@breeztech/react-native-breez-sdk';
import {LIGHTNINGAMOUNTBUFFER} from '../../constants/math';
import {getECashInvoice} from '../eCash/wallet';
import {BLITZ_DEFAULT_PAYMENT_DESCRIPTION} from '../../constants';
import {breezLiquidReceivePaymentWrapper} from '../breezLiquid';
import {fetchOnchainLimits} from '@breeztech/react-native-breez-sdk-liquid';
import displayCorrectDenomination from '../displayCorrectDenomination';
import {
  ECASH_QUOTE_EVENT_NAME,
  ecashEventEmitter,
} from '../../../context-store/eCash';

export async function initializeAddressProcess(wolletInfo) {
  const {setAddressState, selectedRecieveOption} = wolletInfo;
  try {
    setAddressState(prev => {
      return {
        ...prev,
        isGeneratingInvoice: true,
        generatedAddress: '',
        errorMessageText: {
          type: null,
          text: '',
        },
        swapPegInfo: {},
        isReceivingSwap: false,
        hasGlobalError: false,
      };
    });
    if (selectedRecieveOption.toLowerCase() === 'lightning') {
      const response = await generateLightningAddress(wolletInfo);
      if (!response) throw Error('Not able to generate invoice');
    } else if (selectedRecieveOption.toLowerCase() === 'bitcoin') {
      await generateBitcoinAddress(wolletInfo);
    } else {
      await generateLiquidAddress(wolletInfo);
    }
  } catch (error) {
    console.log(error, 'HANDLING ERROR');
    setAddressState(prev => {
      return {
        ...prev,
        hasGlobalError: true,
      };
    });
  } finally {
    console.log('RUNNING AFTER');
    setAddressState(prev => {
      return {
        ...prev,
        isGeneratingInvoice: false,
      };
    });
  }
}

async function generateLightningAddress(wolletInfo) {
  const {
    receivingAmount,
    description,
    userBalanceDenomination,
    nodeInformation,
    masterInfoObject,
    setAddressState,
    minMaxSwapAmounts,
    mintURL,
  } = wolletInfo;
  const liquidWalletSettings = masterInfoObject.liquidWalletSettings;
  const hasLightningChannel = !!nodeInformation.userBalance;
  const enabledEcash = masterInfoObject.enabledEcash;

  if (
    (liquidWalletSettings.regulateChannelOpen &&
      liquidWalletSettings.regulatedChannelOpenSize > receivingAmount &&
      !hasLightningChannel) ||
    !liquidWalletSettings.isLightningEnabled ||
    (hasLightningChannel &&
      nodeInformation.inboundLiquidityMsat / 1000 - LIGHTNINGAMOUNTBUFFER <=
        receivingAmount &&
      liquidWalletSettings.regulateChannelOpen &&
      liquidWalletSettings.regulatedChannelOpenSize > receivingAmount) ||
    (enabledEcash &&
      !hasLightningChannel &&
      receivingAmount < minMaxSwapAmounts.min)
  ) {
    if (receivingAmount < minMaxSwapAmounts.min) {
      const eCashInvoice = await getECashInvoice({
        amount: receivingAmount,
        mintURL: mintURL,
        descriptoin: description,
      });

      if (eCashInvoice.didWork) {
        setAddressState(prev => {
          return {
            ...prev,
            fe: 0,
            generatedAddress: eCashInvoice.mintQuote.request,
          };
        });
        ecashEventEmitter.emit(ECASH_QUOTE_EVENT_NAME, {
          quote: eCashInvoice.mintQuote.quote,
          counter: eCashInvoice.counter,
          mintURL: eCashInvoice.mintURL,
        });

        return true;
      } else {
        setAddressState(prev => {
          return {
            ...prev,
            generatedAddress: null,
            errorMessageText: {
              type: 'stop',
              text: eCashInvoice.reason,
            },
          };
        });
        return;
      }
    } else {
      console.log(description, 'DESCRIPTION');
      const addressResponse = await breezLiquidReceivePaymentWrapper({
        sendAmount: receivingAmount,
        paymentType: 'lightning',
        description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
      });

      if (!addressResponse) {
        setAddressState(prev => {
          return {
            ...prev,
            generatedAddress: null,
            errorMessageText: {
              type: 'stop',
              text: `Unable to generate lightning address`,
            },
          };
        });
        return;
      }
      const {destination, receiveFeesSat} = addressResponse;

      setAddressState(prev => {
        return {
          ...prev,
          generatedAddress: destination,
          fee: receiveFeesSat,
        };
      });

      return true;
    }
  } else {
    if (
      nodeInformation.inboundLiquidityMsat / 1000 - LIGHTNINGAMOUNTBUFFER >=
      receivingAmount
    ) {
      const invoice = await receivePayment({
        amountMsat: receivingAmount * 1000,
        description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
      });
      if (invoice) {
        setAddressState(prev => {
          return {
            ...prev,
            fee: 0,
            generatedAddress: invoice.lnInvoice.bolt11,
            errorMessageText: {
              type: null,
              text: '',
            },
          };
        });
        return true;
      } else return false;
    }

    const needsToOpenChannel = await checkRecevingCapacity({
      nodeInformation,
      receivingAmount,
      userBalanceDenomination,
    });
    if (
      needsToOpenChannel.fee / 1000 >=
      liquidWalletSettings.maxChannelOpenFee
    ) {
      setAddressState(prev => {
        return {
          ...prev,
          generatedAddress: '',
          errorMessageText: {
            type: needsToOpenChannel.type,
            text: `A ${displayCorrectDenomination({
              amount: needsToOpenChannel.fee / 1000,
              nodeInformation,
              masterInfoObject: {
                userBalanceDenomination: userBalanceDenomination,
              },
            })} fee needs to be applied, but you have a max fee of ${displayCorrectDenomination(
              {
                amount: liquidWalletSettings.maxChannelOpenFee,
                nodeInformation,
                masterInfoObject: {
                  userBalanceDenomination: userBalanceDenomination,
                },
              },
            )} set.`,
          },
        };
      });
    }
    if (needsToOpenChannel.fee / 1000 > receivingAmount) {
      setAddressState(prev => {
        return {
          ...prev,
          generatedAddress: '',
          errorMessageText: {
            type: needsToOpenChannel.type,
            text: `A ${displayCorrectDenomination({
              amount: needsToOpenChannel.fee / 1000,
              nodeInformation,
              masterInfoObject: {
                userBalanceDenomination: userBalanceDenomination,
              },
            })} fee needs to be applied, but only ${displayCorrectDenomination({
              amount: receivingAmount,
              nodeInformation,
              masterInfoObject: {
                userBalanceDenomination: userBalanceDenomination,
              },
            })} was requested.`,
          },
        };
      });
    } else {
      const invoice = await receivePayment({
        amountMsat: receivingAmount * 1000,
        description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
      });
      setAddressState(prev => {
        return {
          ...prev,
          fee: Math.round(needsToOpenChannel.fee / 1000),
          generatedAddress: invoice.lnInvoice.bolt11,
        };
      });
    }
    return true;
  }
}

async function generateLiquidAddress(wolletInfo) {
  const {receivingAmount, setAddressState, description} = wolletInfo;

  const addressResponse = await breezLiquidReceivePaymentWrapper({
    sendAmount: receivingAmount,
    paymentType: 'liquid',
    description: description,
  });
  if (!addressResponse) {
    setAddressState(prev => {
      return {
        ...prev,
        generatedAddress: null,
        errorMessageText: {
          type: 'stop',
          text: `Unable to generate liquid address`,
        },
      };
    });
    return;
  }

  const {destination, receiveFeesSat} = addressResponse;

  setAddressState(prev => {
    return {
      ...prev,
      generatedAddress: destination,
      fee: receiveFeesSat,
    };
  });
}

async function generateBitcoinAddress(wolletInfo) {
  const {
    setAddressState,
    receivingAmount,
    userBalanceDenomination,
    nodeInformation,
  } = wolletInfo;
  // Fetch the Onchain lightning limits
  const [currentLimits, addressResponse] = await Promise.all([
    fetchOnchainLimits(),
    breezLiquidReceivePaymentWrapper({
      paymentType: 'bitcoin',
      sendAmount: receivingAmount,
    }),
  ]);

  console.log(`Minimum amount, in sats: ${currentLimits.receive.minSat}`);
  console.log(`Maximum amount, in sats: ${currentLimits.receive.maxSat}`);

  if (!addressResponse) {
    setAddressState(prev => {
      return {
        ...prev,
        generatedAddress: null,
        errorMessageText: {
          type: 'stop',
          text: `Output amount is ${
            currentLimits.receive.minSat > receivingAmount
              ? 'below minimum ' +
                displayCorrectDenomination({
                  amount: currentLimits.receive.minSat,
                  nodeInformation,
                  masterInfoObject: {
                    userBalanceDenomination: userBalanceDenomination,
                  },
                })
              : 'above maximum ' +
                displayCorrectDenomination({
                  amount: currentLimits.receive.maxSat,
                  nodeInformation,
                  masterInfoObject: {
                    userBalanceDenomination: userBalanceDenomination,
                  },
                })
          }`,
        },

        minMaxSwapAmount: {
          min: currentLimits.receive.minSat,
          max: currentLimits.receive.maxSat,
        },
      };
    });
    return;
  }
  const {destination, receiveFeesSat} = addressResponse;

  setAddressState(prev => {
    return {
      ...prev,
      generatedAddress: destination,
      fee: receiveFeesSat,
    };
  });
}

async function checkRecevingCapacity({
  nodeInformation,
  receivingAmount,
  userBalanceDenomination,
}) {
  try {
    const channelFee = await openChannelFee({
      amountMsat: receivingAmount * 1000,
    });

    if (channelFee.feeMsat != 0) {
      return {
        fee: channelFee.feeMsat,
        type: 'warning',
        text: `A ${displayCorrectDenomination({
          amount: channelFee.feeMsat / 1000,
          nodeInformation,
          masterInfoObject: {
            userBalanceDenomination: userBalanceDenomination,
          },
        })} fee will be applied.`,
      };
    } else return false;
  } catch (err) {
    console.log(err);
    return false;
  }
}
