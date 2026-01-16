import {
  getSparkBitcoinPaymentFeeEstimate,
  getSparkLightningPaymentFeeEstimate,
  getSparkPaymentFeeEstimate,
  getSparkStaticBitcoinL1Address,
  receiveSparkLightningPayment,
  sendSparkBitcoinPayment,
  sendSparkLightningPayment,
  sendSparkPayment,
  getSparkAddress,
  sparkWallet,
  sendSparkTokens,
  getSparkLightningSendRequest,
  getSingleTxDetails,
  getSparkPaymentStatus,
} from '.';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
} from '../../../context-store/sparkContext';
import {
  DEFAULT_PAYMENT_EXPIRY_SEC,
  IS_SPARK_ID,
  IS_SPARK_REQUEST_ID,
  USDB_TOKEN_ID,
} from '../../constants';
import sha256Hash from '../hash';
import calculateProgressiveBracketFee from './calculateSupportFee';
import {
  dollarsToSats,
  executeSwap,
  getUserSwapHistory,
  payLightningWithToken,
  satsToDollars,
  SEND_AMOUNT_INCREASE_BUFFER,
  USD_ASSET_ADDRESS,
} from './flashnet';
import {
  abortOptimization,
  isOptimizationRunning,
  scheduleOptimization,
} from '../spark/optimization';
import { setFlashnetTransfer } from './handleFlashnetTransferIds';
import {
  addSingleUnpaidSparkLightningTransaction,
  bulkUpdateSparkTransactions,
} from './transactions';

export const sparkPaymenWrapper = async ({
  getFee = false,
  address,
  paymentType,
  amountSats = 0,
  exitSpeed = 'FAST',
  masterInfoObject,
  fee,
  memo,
  userBalance = 0,
  sparkInformation,
  feeQuote,
  usingZeroAmountInvoice = false,
  seletctedToken = 'Bitcoin',
  mnemonic,
  sendWebViewRequest,
  contactInfo,
  fromMainSendScreen = false,
  usablePaymentMethod = 'BTC',
  swapPaymentQuote,
  paymentInfo,
  fiatValueConvertedSendAmount,
  poolInfoRef,
}) => {
  try {
    console.log('Begining spark payment');

    if (!getFee && (await isOptimizationRunning(mnemonic))) {
      console.log(
        'Optimization in progress, aborting immediately for payment...',
      );
      await abortOptimization(mnemonic);
      // Small delay to ensure abort completes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // if (!sparkWallet[sha256Hash(mnemonic)])
    //   throw new Error('sparkWallet not initialized');
    const supportFee = 0;
    if (getFee) {
      console.log('Calculating spark payment fee');
      let calculatedFee = 0;
      let tempFeeQuote;
      if (paymentType === 'lightning') {
        const routingFee = await getSparkLightningPaymentFeeEstimate(
          address,
          amountSats,
          mnemonic,
        );

        if (!routingFee.didWork)
          throw new Error(routingFee.error || 'Unable to get routing fee');
        calculatedFee = routingFee.response; //Math.ceil(routingFee.response * 1.5); //addding 50% buffer so we dont undershoot it
      } else if (paymentType === 'bitcoin') {
        const feeResponse = await getSparkBitcoinPaymentFeeEstimate({
          amountSats,
          withdrawalAddress: address,
          mnemonic,
        });

        if (!feeResponse.didWork)
          throw new Error(
            feeResponse.error || 'Unable to get Bitcoin fee estimation',
          );
        const data = feeResponse.response;
        calculatedFee =
          data.userFeeFast.originalValue +
          data.l1BroadcastFeeFast.originalValue;
        tempFeeQuote = data;
      } else if (paymentType === 'lrc20') {
        calculatedFee = 0;
      } else {
        // Spark payments
        const feeResponse = await getSparkPaymentFeeEstimate(
          amountSats,
          mnemonic,
        );
        calculatedFee = feeResponse;
      }
      return {
        didWork: true,
        fee: Math.round(calculatedFee),
        supportFee: Math.round(supportFee),
        feeQuote: tempFeeQuote,
      };
    }
    let response;
    // if (
    //   seletctedToken === 'Bitcoin' &&
    //   userBalance < amountSats + (paymentType === 'bitcoin' ? supportFee : fee)
    // )
    //   throw new Error('Insufficient funds');

    isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, true);

    if (paymentType === 'lightning') {
      if (usablePaymentMethod === 'USD') {
        const swapPaymentResponse = await payLightningWithToken(mnemonic, {
          invoice: address,
          tokenAddress: USD_ASSET_ADDRESS,
        });

        if (!swapPaymentResponse.didWork)
          throw new Error(
            swapPaymentResponse.error ||
              'Error when sending lightning payment from USD balance',
          );

        // delete swap transfer and combine all info into one tx
        setFlashnetTransfer(swapPaymentResponse.result.swapTransferId);

        const [lightningSendResponse, userSwaps] = await Promise.all([
          IS_SPARK_REQUEST_ID.test(
            swapPaymentResponse.result.lightningPaymentId,
          )
            ? getSparkLightningSendRequest(
                swapPaymentResponse.result.lightningPaymentId,
                mnemonic,
              )
            : getSingleTxDetails(
                mnemonic,
                swapPaymentResponse.result.lightningPaymentId,
              ),
          getUserSwapHistory(mnemonic, 5),
        ]);

        if (userSwaps.didWork) {
          const swap = userSwaps.swaps.find(
            savedSwap =>
              savedSwap.outboundTransferId ===
              swapPaymentResponse.result.swapTransferId,
          );

          // if swap is found delte from tx history
          if (swap) {
            setFlashnetTransfer(swap.inboundTransferId);
          }
        }

        const didUseLightning = IS_SPARK_REQUEST_ID.test(
          swapPaymentResponse.result.lightningPaymentId,
        );

        const usdToSatFee = dollarsToSats(
          swapPaymentResponse.result.ammFeePaid / 1000000,
          poolInfoRef.currentPriceAInB,
        );
        const lnFee = swapPaymentResponse.result.lightningFeePaid;

        const tx = {
          id: swapPaymentResponse.result.lightningPaymentId,
          paymentStatus: didUseLightning ? 'pending' : 'completed',
          paymentType: didUseLightning ? 'lightning' : 'spark',
          accountId: sparkInformation.identityPubKey,
          details: {
            sendingUUID: contactInfo?.uuid,
            fee: Math.round(usdToSatFee + lnFee),
            totalFee: Math.round(usdToSatFee + lnFee),
            supportFee: 0,
            amount: swapPaymentResponse.result.tokenAmountSpent,
            description: memo || '',
            address: address,
            time: new Date(
              lightningSendResponse[
                didUseLightning ? 'updatedAt' : 'updatedTime'
              ],
            ).getTime(),
            createdAt: new Date(
              lightningSendResponse[
                didUseLightning ? 'createdAt' : 'createdTime'
              ],
            ).getTime(),
            direction: 'OUTGOING',
            preimage: '',
            isLRC20Payment: true,
            LRC20Token: USDB_TOKEN_ID,
          },
        };
        response = tx;
      } else {
        const initialFee = Math.round(fee - supportFee);

        // await handleSupportPayment(masterInfoObject, supportFee, mnemonic);

        const lightningPayResponse = await sendSparkLightningPayment({
          maxFeeSats: Math.max(initialFee, 1000),
          invoice: address,
          amountSats: usingZeroAmountInvoice ? Number(amountSats) : undefined,
          mnemonic,
        });

        if (!lightningPayResponse.didWork)
          throw new Error(
            lightningPayResponse.error ||
              'Error when sending lightning payment',
          );

        console.log(lightningPayResponse, 'lightniing pay response');
        const data = lightningPayResponse.paymentResponse;

        // check if lightning payment used LN or handled over spark
        const paymentType = !!data?.type ? 'spark' : 'lightning';

        if (paymentType === 'lightning') {
          const realPaymentFee = data?.fee?.originalValue
            ? data?.fee?.originalValue /
              (data?.fee?.originalUnit === 'MILLISATOSHI' ? 1000 : 1)
            : initialFee;

          const tx = {
            id: data.id,
            paymentStatus: 'pending',
            paymentType: 'lightning',
            accountId: sparkInformation.identityPubKey,
            details: {
              sendingUUID: contactInfo?.uuid,
              fee: realPaymentFee,
              totalFee: supportFee + realPaymentFee,
              supportFee: supportFee,
              amount: amountSats,
              description: memo || '',
              address: address,
              time: new Date(data.updatedAt).getTime(),
              createdAt: new Date(data.createdAt).getTime(),
              direction: 'OUTGOING',
              preimage: '',
            },
          };
          response = tx;
        } else {
          const tx = {
            id: data.id,
            paymentStatus: 'completed',
            paymentType: 'spark',
            accountId: sparkInformation.identityPubKey,
            details: {
              sendingUUID: contactInfo?.uuid,
              fee: 0,
              totalFee: 0 + supportFee,
              supportFee: supportFee,
              amount: amountSats,
              address: address,
              time: new Date(data.updatedTime).getTime(),
              direction: 'OUTGOING',
              description: memo || '',
              senderIdentityPublicKey: data.receiverIdentityPublicKey,
              isLRC20Payment: false,
              LRC20Token: seletctedToken,
            },
          };
          response = tx;
        }
      }
    } else if (paymentType === 'bitcoin') {
      // make sure to import exist speed
      // await handleSupportPayment(masterInfoObject, supportFee, mnemonic);

      const onChainPayResponse = await sendSparkBitcoinPayment({
        onchainAddress: address,
        exitSpeed,
        amountSats,
        feeQuote,
        deductFeeFromWithdrawalAmount: true,
        mnemonic,
      });

      if (!onChainPayResponse.didWork)
        throw new Error(
          onChainPayResponse.error || 'Error when sending bitcoin payment',
        );

      console.log(onChainPayResponse, 'on-chain pay response');
      const data = onChainPayResponse.response;

      const tx = {
        id: data.id,
        paymentStatus: 'pending',
        paymentType: 'bitcoin',
        accountId: sparkInformation.identityPubKey,
        details: {
          fee: fee,
          totalFee: supportFee + fee,
          supportFee: supportFee,
          amount: amountSats,
          address: address,
          time: new Date(data.updatedAt).getTime(),
          direction: 'OUTGOING',
          description: memo || '',
          onChainTxid: data.coopExitTxid || '',
        },
      };
      response = tx;
    } else {
      let executionResponse;

      const expectedReceiveType = paymentInfo?.data?.expectedReceive || 'sats';
      const needsSwap =
        ((usablePaymentMethod === 'USD' && expectedReceiveType === 'sats') ||
          (usablePaymentMethod === 'BTC' &&
            expectedReceiveType === 'tokens')) &&
        seletctedToken === 'Bitcoin';

      let isSwap = false;
      let usedUSDB = false;
      if (needsSwap) {
        if (usablePaymentMethod === 'USD') {
          const amountInWithBuffer = Math.min(
            (swapPaymentQuote.amountIn * SEND_AMOUNT_INCREASE_BUFFER) /
              Math.pow(10, 6),
            satsToDollars(
              swapPaymentQuote.dollarBalanceSat,
              poolInfoRef.currentPriceAInB,
            ),
          );
          const formatted = Math.round(amountInWithBuffer * Math.pow(10, 6));
          executionResponse = await executeSwap(mnemonic, {
            poolId: swapPaymentQuote.poolId,
            assetInAddress: swapPaymentQuote.assetInAddress,
            assetOutAddress: swapPaymentQuote.assetOutAddress,
            amountIn: formatted,
          });
          usedUSDB = true;
        } else {
          const amountInWithBuffer = Math.min(
            (swapPaymentQuote.amountIn * SEND_AMOUNT_INCREASE_BUFFER) /
              Math.pow(10, 6),
            swapPaymentQuote.bitcoinBalance,
          );
          const formatted = Math.round(amountInWithBuffer * Math.pow(10, 6));
          executionResponse = await executeSwap(mnemonic, {
            poolId: swapPaymentQuote.poolId,
            assetInAddress: swapPaymentQuote.assetInAddress,
            assetOutAddress: swapPaymentQuote.assetOutAddress,
            amountIn: formatted,
          });
        }

        if (!executionResponse.didWork)
          throw new Error(executionResponse.error);

        const outboundTransferId = executionResponse.swap.outboundTransferId;
        setFlashnetTransfer(outboundTransferId);

        const userSwaps = await getUserSwapHistory(mnemonic, 5);

        if (userSwaps.didWork) {
          const swap = userSwaps.swaps.find(
            savedSwap => savedSwap.outboundTransferId === outboundTransferId,
          );

          if (swap) {
            setFlashnetTransfer(swap.inboundTransferId);
          }
        }

        const MAX_WAIT_TIME = 60000;
        const startTime = Date.now();

        while (true) {
          if (Date.now() - startTime > MAX_WAIT_TIME) {
            throw new Error('Swap completion timeout');
          }

          if (!IS_SPARK_ID.test(outboundTransferId)) {
            await new Promise(res => setTimeout(res, 2500));
            break;
          }

          const sparkTransferResponse = await getSingleTxDetails(
            mnemonic,
            outboundTransferId,
          );

          const status = getSparkPaymentStatus(sparkTransferResponse?.status);
          if (status === 'completed') break;

          console.log('Swap is not complete, waiting for completion');
          await new Promise(res => setTimeout(res, 1500));
        }

        isSwap = true;
        // small buffer to help smooth things out
        await new Promise(res => setTimeout(res, 1500));
      }

      let sparkPayResponse;
      let useLRC20Format = false;
      const maxAttempts = isSwap ? 3 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise(res => setTimeout(res, 3500));
        }

        if (expectedReceiveType === 'tokens' && seletctedToken === 'Bitcoin') {
          const originalSendAmount =
            satsToDollars(amountSats, poolInfoRef.currentPriceAInB).toFixed(3) *
            Math.pow(10, 6);
          const usdbAmount = isSwap
            ? executionResponse.swap.amountOut >= originalSendAmount
              ? originalSendAmount
              : executionResponse.swap.amountOut
            : fiatValueConvertedSendAmount;
          useLRC20Format = true;
          sparkPayResponse = await sendSparkTokens({
            tokenIdentifier: USDB_TOKEN_ID,
            tokenAmount: Number(Math.ceil(usdbAmount)),
            receiverSparkAddress: address,
            mnemonic,
          });
        } else if (seletctedToken !== 'Bitcoin') {
          useLRC20Format = true;
          sparkPayResponse = await sendSparkTokens({
            tokenIdentifier: seletctedToken,
            tokenAmount: Number(amountSats),
            receiverSparkAddress: address,
            mnemonic,
          });
        } else {
          const finalSatAmount = isSwap
            ? executionResponse.swap.amountOut >= amountSats
              ? amountSats
              : executionResponse.swap.amountOut
            : amountSats;
          sparkPayResponse = await sendSparkPayment({
            receiverSparkAddress: address,
            amountSats: Number(finalSatAmount),
            mnemonic,
          });
        }

        if (sparkPayResponse.didWork) break;

        if (attempt === maxAttempts - 1) {
          throw new Error(
            sparkPayResponse.error || 'Error when sending spark payment',
          );
        }
      }

      // await handleSupportPayment(masterInfoObject, supportFee, mnemonic);

      const data = sparkPayResponse.response;

      const formattedToken =
        seletctedToken !== 'Bitcoin'
          ? seletctedToken
          : expectedReceiveType === 'tokens'
          ? USDB_TOKEN_ID
          : '';

      const tx = {
        id: useLRC20Format ? data : data.id,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: sparkInformation.identityPubKey,
        details: {
          sendingUUID: contactInfo?.uuid,
          fee: 0,
          totalFee: 0 + supportFee,
          supportFee: supportFee,
          amount: amountSats,
          address: address,
          time: useLRC20Format
            ? new Date().getTime()
            : new Date(data.updatedTime).getTime(),
          direction: 'OUTGOING',
          description: memo || '',
          senderIdentityPublicKey: useLRC20Format
            ? ''
            : data.receiverIdentityPublicKey,
          isLRC20Payment: useLRC20Format,
          LRC20Token: formattedToken,
        },
      };

      if (isSwap) {
        if (usedUSDB) {
          tx.details.isLRC20Payment = true;
          tx.details.LRC20Token = USDB_TOKEN_ID;
          tx.details.fee = tx.details.fee + Math.ceil(swapPaymentQuote.satFee);
          tx.details.totalFee = tx.details.fee;

          tx.details.amount = swapPaymentQuote.amountIn;
        } else {
          tx.details.isLRC20Payment = false;
          tx.details.LRC20Token = '';
          tx.details.fee = tx.details.fee + Math.ceil(swapPaymentQuote.satFee);
          tx.details.totalFee = tx.details.fee;
          tx.details.amount = amountSats;
        }
      } else if (
        expectedReceiveType === 'tokens' &&
        seletctedToken === 'Bitcoin'
      ) {
        const usdbAmount = isSwap
          ? executionResponse.swap.amountOut
          : fiatValueConvertedSendAmount;
        tx.details.amount = usdbAmount;
      }
      response = tx;
    }

    console.log(
      response,
      'resonse in send function',
      sparkInformation.identityPubKey,
    );
    // Only save immediately if we have identityPubKey (otherwise the tx will not show up)
    if (sparkInformation.identityPubKey) {
      await bulkUpdateSparkTransactions([response], 'paymentWrapperTx', 0);
    }

    if (!getFee) {
      console.log('Scheduling post-payment optimization...');
      scheduleOptimization(mnemonic, sparkInformation.identityPubKey, 2000);
    }
    return {
      didWork: true,
      response,
      shouldSave: !sparkInformation.identityPubKey,
    };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: err.message };
  } finally {
    // Only emit if we processed a payment and have identityPubKey (will handle situation with no identiy pubkey on send screen)
    if (
      !getFee &&
      (!fromMainSendScreen || // not the main send screen → fire always
        sparkInformation?.identityPubKey) // on main send → only fire if identityPubKey exists
    ) {
      isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
    }
  }
};

export const sparkReceivePaymentWrapper = async ({
  amountSats,
  memo,
  paymentType,
  shouldNavigate,
  mnemoinc,
  sendWebViewRequest,
  performSwaptoUSD = false,
  includeSparkAddress = true,
  expirySeconds,
}) => {
  try {
    // if (!sparkWallet[sha256Hash(mnemoinc)])
    //   throw new Error('sparkWallet not initialized');

    if (paymentType === 'lightning') {
      const invoiceResponse = await receiveSparkLightningPayment({
        amountSats,
        memo,
        mnemonic: mnemoinc,
        includeSparkAddress,
        expirySeconds,
      });

      if (!invoiceResponse.didWork) throw new Error(invoiceResponse.error);
      const invoice = invoiceResponse.response;

      const tempTransaction = {
        id: invoice.id,
        amount: amountSats,
        expiration: invoice.invoice.expiresAt,
        description: memo || '',
        shouldNavigate,
        details: {
          createdTime: new Date(invoice.createdAt).getTime(),
          isLNURL: false,
          shouldNavigate: true,
          isBlitzContactPayment: false,
          performSwaptoUSD,
        },
      };
      await addSingleUnpaidSparkLightningTransaction(tempTransaction);
      return {
        didWork: true,
        data: invoice,
        invoice: invoice.invoice.encodedInvoice,
      };
    } else if (paymentType === 'bitcoin') {
      // Handle storage of tx when claiming in spark context
      const depositAddress = await getSparkStaticBitcoinL1Address(mnemoinc);
      if (!depositAddress)
        throw new Error('Not able to generate bitcoin address');
      return {
        didWork: true,
        invoice: depositAddress,
      };
    } else {
      // No need to save address since it is constant
      const sparkAddress = await getSparkAddress(mnemoinc);
      if (!sparkAddress.didWork) throw new Error(sparkAddress.error);

      const data = sparkAddress.response;

      return {
        didWork: true,
        invoice: data,
      };
    }
  } catch (err) {
    console.log('Receive spark payment error', err);
    return { didWork: false, error: err.message };
  }
};

async function handleSupportPayment(masterInfoObject, supportFee, mnemonic) {
  try {
    if (!supportFee) return;
    if (masterInfoObject?.enabledDeveloperSupport?.isEnabled) {
      // const txPromise = sendSparkPayment({
      //   receiverSparkAddress: process.env.BLITZ_SPARK_SUPPORT_ADDRESSS,
      //   amountSats: supportFee,
      //   mnemonic,
      // });
      // await Promise.race([
      //   txPromise,
      //   new Promise(res => setTimeout(res, 30000)),
      // ]);
      // txPromise.catch(err =>
      //   console.log('Error sending support payment (late)', err),
      // );
      // await new Promise(res => setTimeout(res, 800)); // wait a bit
    }
  } catch (err) {
    console.log('Error sending support payment', err);
  }
}
