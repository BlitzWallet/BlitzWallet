import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { deleteGift, getGiftCard } from '../../../../../db';
import { parseGiftUrl } from '../../../../functions/gift/encodeDecodeSecret';
import { useNavigation } from '@react-navigation/native';
import { decryptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import { getPublicKey } from 'nostr-tools';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  FONT,
  MAX_WEB_CONTENT_WIDTH,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
  USDB_TOKEN_ID,
  WEBSITE_REGEX,
} from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useTheme } from '../../../../../context-store/theme';
import AnimatedStep, {
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import { AssetDisc, SheetResult } from '../savings/savingsSheetParts';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import { giftAsset } from './giftDisplay';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import {
  getSparkPaymentFeeEstimate,
  initializeSparkWallet,
  sendSparkPayment,
  sendSparkTokens,
  disposeSparkWallet,
} from '../../../../functions/spark';
import { awaitSparkBalance } from '../../../../functions/spark/awaitBalanceChange';
import { useTranslation } from 'react-i18next';
import { useKeysContext } from '../../../../../context-store/keys';
import {
  getGiftByUuid,
  updateGiftLocal,
} from '../../../../functions/gift/giftsStorage';
import { transformTxToPaymentObject } from '../../../../functions/spark/transformTxToPayment';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import {
  deriveGiftRestoreKey,
  deriveSparkGiftMnemonic,
} from '../../../../functions/gift/deriveGiftWallet';
import { dollarsToSats } from '../../../../functions/spark/flashnet';
import { useFlashnet } from '../../../../../context-store/flashnetContext';

export default function ClaimGiftScreen({
  url,
  claimType,
  expertMode,
  customGiftIndex,
  handleBackPressFunction,
  setContentHeight,
  setDismissLocked,
}) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { poolInfoRef } = useFlashnet();
  const { accountMnemoinc } = useKeysContext();
  const navigate = useNavigation();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = useTheme();
  const [giftDetails, setGiftDetails] = useState({});
  const [isClaiming, setIsClaiming] = useState(false);
  const { t } = useTranslation();
  const [didClaim, setDidClaim] = useState(false);
  const [claimedExpert, setClaimedExpert] = useState(null);
  const [claimStatus, setClaimStatus] = useState('');

  // Store the initialization promise and result
  const walletInitPromise = useRef(null);
  const walletInitResult = useRef(null);
  const isClaimingRef = useRef(false);
  const denomination = giftDetails?.denomination || 'BTC';

  const handleError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', { errorMessage });
    },
    [navigate],
  );

  const deriveReclaimGiftSeed = useCallback(async () => {
    if (expertMode) {
      const giftWalletMnemonic = await deriveSparkGiftMnemonic(
        accountMnemoinc,
        STARTING_INDEX_FOR_GIFTS_DERIVE + customGiftIndex,
      );
      return { giftSeed: giftWalletMnemonic.derivedMnemonic };
    }

    let uuid;
    if (WEBSITE_REGEX.test(url)) {
      const parsedURL = parseGiftUrl(url);
      uuid = parsedURL.giftId;
    } else {
      uuid = url;
    }

    const savedGift = await getGiftByUuid(uuid);

    if (!savedGift) {
      throw new Error(t('screens.inAccount.giftPages.claimPage.parseError'));
    }

    if (Date.now() < savedGift.expireTime) {
      throw new Error(t('screens.inAccount.giftPages.claimPage.notExpired'));
    }

    const giftSeed = await deriveGiftRestoreKey(
      accountMnemoinc,
      savedGift.giftNum,
      savedGift.createdTime,
    );

    return {
      ...savedGift,
      giftSeed,
    };
  }, [expertMode, url, customGiftIndex, accountMnemoinc, t]);

  const deriveClaimGiftSeed = useCallback(async () => {
    const parsedURL = parseGiftUrl(url);
    if (!parsedURL) {
      throw new Error(t('screens.inAccount.giftPages.claimPage.parseError'));
    }

    const retrivedGift = await getGiftCard(parsedURL.giftId);

    if (!retrivedGift || retrivedGift?.expireTime < Date.now()) {
      throw new Error(
        t('screens.inAccount.giftPages.claimPage.expiredOrClaimed'),
      );
    }

    const publicKey = getPublicKey(parsedURL.secret);
    const decodedSeed = decryptMessage(
      parsedURL.secret,
      publicKey,
      retrivedGift.encryptedText,
    );

    if (decodedSeed.split(' ').length < 5) {
      throw new Error(t('screens.inAccount.giftPages.claimPage.noGiftSeed'));
    }

    return { ...retrivedGift, giftSeed: decodedSeed };
  }, [url, t]);

  const loadGiftDetails = useCallback(async () => {
    try {
      const details =
        claimType === 'reclaim'
          ? await deriveReclaimGiftSeed()
          : await deriveClaimGiftSeed();

      setGiftDetails(details);

      // Pre-initialize wallet in background
      walletInitPromise.current = initializeSparkWallet(details.giftSeed)
        .then(result => {
          walletInitResult.current = result;
          return result;
        })
        .catch(err => {
          console.log('Pre-initialization failed:', err);
          walletInitResult.current = null;
          return null;
        });
    } catch (err) {
      console.log('error loading gift details', err);
      handleBackPressFunction(() => {
        navigate.goBack();
        handleError(err.message);
      });
    }
  }, [
    claimType,
    deriveReclaimGiftSeed,
    deriveClaimGiftSeed,
    navigate,
    handleError,
    handleBackPressFunction,
  ]);

  const getBalanceWithStatusRetry = useCallback(
    async (seed, expectedAmount, shouldEnforceAmount = false) => {
      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.giftBalanceMessage'),
      );

      const handleBalanceCheck = result => {
        if (!result?.didWork) return false;

        const bitcoinBalance = Number(result.balance);
        const dollarBalance = Number(
          result.tokensObj?.[USDB_TOKEN_ID]?.balance,
        );

        // Expert mode has no expected amount — resolve as soon as any funds land.
        if (expectedAmount === undefined) {
          return bitcoinBalance > 0 || dollarBalance > 0;
        }

        const bitcoinCheck = bitcoinBalance >= expectedAmount * 0.97;
        const dollarCheck =
          dollarBalance >= expectedAmount * Math.pow(10, 6) * 0.97;

        return denomination === 'BTC' ? bitcoinCheck : dollarCheck;
      };

      // Immediate read first, then listen for the gift wallet's balance events
      // (up to 60s) instead of fixed-delay polling.
      const result = await awaitSparkBalance({
        mnemonic: seed,
        predicate: handleBalanceCheck,
      });

      if (
        shouldEnforceAmount &&
        expectedAmount !== undefined &&
        !handleBalanceCheck(result)
      ) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.balanceMismatchError'),
        );
      }

      return result;
    },
    [t, expertMode, denomination],
  );

  const ensureWalletInitialized = useCallback(
    async giftSeed => {
      let initResult = walletInitResult.current;

      if (walletInitPromise.current && !initResult) {
        initResult = await walletInitPromise.current;
      }

      if (!initResult) {
        initResult = await initializeSparkWallet(giftSeed, false, {
          maxRetries: 4,
        });
      }

      if (!initResult) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.giftWalletInitError'),
        );
      }

      return initResult;
    },
    [t],
  );

  const calculatePaymentAmount = useCallback(
    async (giftSeed, giftAmount) => {
      const walletBalance = await getBalanceWithStatusRetry(
        giftSeed,
        expertMode ? undefined : giftAmount,
        claimType === 'claim',
      );

      const bitcoinBalance = walletBalance?.didWork
        ? Number(walletBalance?.balance)
        : 0;
      const dollarBalance = walletBalance?.didWork
        ? Number(walletBalance?.tokensObj?.[USDB_TOKEN_ID]?.balance) || 0
        : 0;
      const dollarGiftAmount = giftAmount * Math.pow(10, 6);

      let formattedWalletBalance;
      let fees;
      let fromBalance;
      if (expertMode) {
        if (!bitcoinBalance && !dollarBalance) {
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.nobalanceErrorExpert'),
          );
        }
        formattedWalletBalance = bitcoinBalance || dollarBalance;
        fromBalance = bitcoinBalance ? 'BTC' : 'USD';
        fees = await (denomination === 'USD'
          ? Promise.resolve(0)
          : getSparkPaymentFeeEstimate(formattedWalletBalance, giftSeed));
      } else {
        formattedWalletBalance = walletBalance?.didWork
          ? denomination === 'BTC'
            ? bitcoinBalance
            : dollarBalance
          : giftAmount || 0;

        fees = await (denomination === 'USD'
          ? Promise.resolve(
              dollarGiftAmount > formattedWalletBalance
                ? dollarGiftAmount - formattedWalletBalance
                : 0,
            )
          : getSparkPaymentFeeEstimate(formattedWalletBalance, giftSeed));
        fromBalance = denomination;
      }

      const sendingAmount =
        formattedWalletBalance - (fromBalance === 'USD' ? 0 : fees);

      if (sendingAmount <= 0) {
        if (claimType === 'reclaim' && !expertMode) {
          await deleteGift(giftDetails.uuid);
          await updateGiftLocal(giftDetails.uuid, {
            state: 'Reclaimed',
          });
        }

        throw new Error(
          expertMode
            ? t('screens.inAccount.giftPages.claimPage.nobalanceErrorExpert')
            : t('screens.inAccount.giftPages.claimPage.nobalanceError'),
        );
      }
      const balanceDifference = expertMode
        ? 0
        : denomination === 'USD'
        ? dollarGiftAmount > formattedWalletBalance
          ? dollarGiftAmount - formattedWalletBalance
          : 0
        : giftAmount > formattedWalletBalance
        ? giftAmount - formattedWalletBalance
        : 0;

      const finalFee = fees + balanceDifference;

      return { sendingAmount, fees: finalFee, fromBalance };
    },
    [
      getBalanceWithStatusRetry,
      expertMode,
      claimType,
      giftDetails.uuid,
      t,
      denomination,
    ],
  );

  // Extract transaction processing logic
  const processTransaction = useCallback(
    async (
      paymentResponse,
      receivingAddress,
      sendingAmount,
      fees,
      paymentDenomination,
    ) => {
      const data = paymentResponse.response;
      const formattedToken = paymentDenomination === 'USD' ? USDB_TOKEN_ID : '';
      const fee =
        paymentDenomination === 'USD'
          ? dollarsToSats(fees / Math.pow(10, 6), poolInfoRef.currentPriceAInB)
          : fees;
      let tx = {
        id: paymentDenomination === 'USD' ? data : data.id,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: sparkInformation.identityPubKey,
        details: {
          fee: fee,
          totalFee: fee,
          supportFee: fee,
          amount: sendingAmount,
          address: receivingAddress,
          time:
            paymentDenomination === 'USD'
              ? new Date().getTime()
              : new Date(data.updatedTime).getTime(),
          direction: 'INCOMING',
          description:
            claimType === 'reclaim'
              ? t('screens.inAccount.giftPages.reclaimGiftMessage')
              : giftDetails.description,
          senderIdentityPublicKey:
            paymentDenomination === 'USD' ? '' : data.receiverIdentityPublicKey,
          isLRC20Payment: paymentDenomination === 'USD',
          LRC20Token: formattedToken,
          isGift: true,
        },
      };

      if (!tx.details.description) {
        tx.details.description = t(
          'screens.inAccount.giftPages.claimPage.defaultDesc',
        );
      }

      await bulkUpdateSparkTransactions([tx], 'fullUpdate-waitBalance');

      if (!expertMode) {
        await deleteGift(giftDetails.uuid);
        if (claimType === 'reclaim') {
          await updateGiftLocal(giftDetails.uuid, {
            state: 'Reclaimed',
          });
        }
      }
    },
    [
      claimType,
      giftDetails.description,
      giftDetails.uuid,
      expertMode,
      t,
      accountMnemoinc,
    ],
  );

  const handleClaim = useCallback(async () => {
    if (isClaimingRef.current) return;
    isClaimingRef.current = true;
    setIsClaiming(true);

    try {
      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.claimingGiftMessage1'),
      );

      await ensureWalletInitialized(giftDetails.giftSeed);

      const receivingAddress = sparkInformation.sparkAddress;
      const { sendingAmount, fees, fromBalance } = await calculatePaymentAmount(
        giftDetails.giftSeed,
        denomination === 'BTC' ? giftDetails.amount : giftDetails.dollarAmount,
      );

      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.claimingGiftMessage4'),
      );

      const paymentResponse = await (fromBalance === 'BTC'
        ? sendSparkPayment({
            receiverSparkAddress: receivingAddress,
            amountSats: sendingAmount,
            mnemonic: giftDetails.giftSeed,
          })
        : sendSparkTokens({
            tokenIdentifier: USDB_TOKEN_ID,
            tokenAmount: sendingAmount,
            receiverSparkAddress: receivingAddress,
            mnemonic: giftDetails.giftSeed,
          }));

      if (!paymentResponse.didWork) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.paymentError'),
        );
      }

      await processTransaction(
        paymentResponse,
        receivingAddress,
        sendingAmount,
        fees,
        fromBalance,
      );
      if (expertMode) {
        setClaimedExpert({
          amount: fromBalance === 'USD' ? sendingAmount / 1e6 : sendingAmount,
          denomination: fromBalance,
        });
      }
      setDidClaim(true);
    } catch (err) {
      console.log('Error claiming gift:', err);
      handleBackPressFunction(() => {
        navigate.goBack();
        handleError(err.message || 'Failed to claim gift');
      });
    } finally {
      // Tear down the gift wallet session/listeners once the claim is done.
      if (giftDetails.giftSeed) await disposeSparkWallet(giftDetails.giftSeed);
      setIsClaiming(false);
      isClaimingRef.current = false;
    }
  }, [
    giftDetails.giftSeed,
    giftDetails.amount,
    sparkInformation.sparkAddress,
    ensureWalletInitialized,
    calculatePaymentAmount,
    processTransaction,
    navigate,
    handleError,
    denomination,
    t,
    handleBackPressFunction,
  ]);

  useEffect(() => {
    if (!expertMode && !url) return;

    const isConnected =
      sparkInformation.identityPubKey && sparkInformation.didConnect;

    if (isConnected) {
      loadGiftDetails();
    }
  }, [
    url,
    sparkInformation.identityPubKey,
    sparkInformation.didConnect,
    expertMode,
    loadGiftDetails,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      walletInitPromise.current = null;
      walletInitResult.current = null;
      isClaimingRef.current = false;
    };
  }, []);

  const isConnected =
    sparkInformation.identityPubKey && sparkInformation.didConnect;
  const hasDetails = !!Object.keys(giftDetails).length;
  const isReclaim = claimType === 'reclaim';
  const page =
    !isConnected || !hasDetails
      ? 'loading'
      : didClaim
      ? 'claimed'
      : isClaiming
      ? 'claiming'
      : 'details';

  // One height for every page: resizing the sheet while a step slides in
  // leaves the step's touch area out of sync (Accept stopped responding).
  useStepSheetHeight(setContentHeight, 460);

  // Funds are moving: block hardware back and the sheet dismiss.
  useHandleBackPressNew(isClaiming ? () => true : null);
  useEffect(() => {
    setDismissLocked?.(isClaiming);
    return () => setDismissLocked?.(false);
  }, [isClaiming, setDismissLocked]);

  const amountProps = (amount, isUSD) => ({
    amount,
    fiatStats,
    masterInfoObject: {
      ...masterInfoObject,
      userBalanceDenomination: isUSD
        ? 'fiat'
        : masterInfoObject.userBalanceDenomination,
    },
    forceCurrency: isUSD ? 'USD' : false,
    convertAmount: !isUSD,
  });

  const giftAmountProps = amountProps(
    denomination === 'BTC' ? giftDetails.amount : giftDetails?.dollarAmount,
    denomination === 'USD',
  );

  const feeText = expertMode
    ? t('screens.inAccount.giftPages.claimPage.networkFeeWarningExpert')
    : isReclaim
    ? t('screens.inAccount.giftPages.claimPage.reclaimFeeWarning')
    : t('screens.inAccount.giftPages.claimPage.networkFeeWarning');

  const topLine = isReclaim
    ? expertMode
      ? t('screens.inAccount.giftPages.claimPage.reclaimAmountHeadExpert')
      : t('screens.inAccount.giftPages.claimPage.reclaimAmountHead')
    : giftDetails.description;

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      {page === 'loading' && (
        <FullLoadingScreen
          showText={!isConnected}
          text={t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage')}
        />
      )}

      {/* Fade only: details replaces the spinner while the sheet is still
          sliding up, and a sideways slide on top of that looked jittery. */}
      <AnimatedStep active={page === 'details'} direction={1} fadeOnly>
        {isReclaim && <TopBar onBack={() => handleBackPressFunction()} />}
        <View style={styles.center}>
          <AssetDisc asset={expertMode ? 'bitcoin' : giftAsset(giftDetails)} />
          {!!topLine && (
            <ThemeText
              variant={'body'}
              styles={[styles.note, { color: tokens.muted }]}
              content={topLine}
            />
          )}
          {expertMode ? (
            <ThemeText
              styles={styles.amount}
              content={t(
                'screens.inAccount.giftPages.claimPage.expertGiftLabel',
                {
                  number: customGiftIndex,
                },
              )}
            />
          ) : (
            <AmountHero {...giftAmountProps} amountSize={40} />
          )}
        </View>
        <ThemeText
          variant={'hint'}
          styles={[styles.fee, { color: tokens.muted }]}
          content={feeText}
        />
        <CustomButton
          buttonStyles={styles.button}
          textContent={
            isReclaim
              ? t('screens.inAccount.giftPages.claimPage.reclaimButton')
              : t('screens.inAccount.giftPages.claimPage.claimButton')
          }
          actionFunction={handleClaim}
          size={'regular'}
        />
      </AnimatedStep>

      <AnimatedStep active={page === 'claiming'} direction={1} fadeOnly>
        <View style={styles.claiming}>
          <ActivityIndicator size="large" color={tokens.accent} />
          <ThemeText
            styles={styles.title}
            content={
              isReclaim
                ? t('screens.inAccount.giftPages.claimPage.reclaimingTitle')
                : t('screens.inAccount.giftPages.claimPage.claimingTitle')
            }
          />
          <ThemeText
            variant={'body'}
            styles={[styles.sub, { color: tokens.muted }]}
            content={t('screens.inAccount.giftPages.claimPage.stayInApp')}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep active={page === 'claimed'} direction={1} fadeOnly>
        <SheetResult
          label={
            isReclaim
              ? t('screens.inAccount.giftPages.claimPage.reclaimedTitle')
              : t('screens.inAccount.giftPages.claimPage.claimedTitle')
          }
          amountProps={
            expertMode && claimedExpert
              ? amountProps(
                  claimedExpert.amount,
                  claimedExpert.denomination === 'USD',
                )
              : giftAmountProps
          }
          line={t('screens.inAccount.giftPages.claimPage.claimedSub')}
          buttonText={t('constants.done')}
          onDone={handleBackPressFunction}
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'center' },
  center: { marginTop: 24, alignItems: 'center' },
  note: { marginTop: 14, textAlign: 'center' },
  amount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 40,
    lineHeight: 48,
    marginTop: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },
  fee: { marginTop: 'auto', marginBottom: 12, textAlign: 'center' },
  button: { width: '100%' },
  claiming: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  sub: { marginTop: 6, textAlign: 'center' },
});
