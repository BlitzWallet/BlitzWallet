import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { deleteGift, getGiftCard } from '../../../../../db';
import { parseGiftUrl } from '../../../../functions/gift/encodeDecodeSecret';
import { useNavigation } from '@react-navigation/native';
import { decryptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import { getPublicKey } from 'nostr-tools';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  CENTER,
  GIFT_DERIVE_PATH_CUTOFF,
  SIZES,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
  WEBSITE_REGEX,
} from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import {
  getSparkBalance,
  getSparkPaymentFeeEstimate,
  initializeSparkWallet,
  sendSparkPayment,
} from '../../../../functions/spark';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import { useKeysContext } from '../../../../../context-store/keys';
import {
  getGiftByUuid,
  updateGiftLocal,
} from '../../../../functions/gift/giftsStorage';
import { transformTxToPaymentObject } from '../../../../functions/spark/transformTxToPayment';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
import { deriveSparkGiftMnemonic } from '../../../../functions/gift/deriveGiftWallet';
import { deriveKeyFromMnemonic } from '../../../../functions/seed';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function ClaimGiftScreen({
  url,
  claimType,
  expertMode,
  customGiftIndex,
}) {
  const { accountMnemoinc } = useKeysContext();
  const { updateGiftList } = useGifts();
  const navigate = useNavigation();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const [giftDetails, setGiftDetails] = useState({});
  const [isClaiming, setIsClaiming] = useState(false);
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [didClaim, setDidClaim] = useState(false);
  const animationRef = useRef(null);
  const [claimStatus, setClaimStatus] = useState('');

  // Store the initialization promise and result
  const walletInitPromise = useRef(null);
  const walletInitResult = useRef(null);
  const isClaimingRef = useRef(false);

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

    if (Date.now() < savedGift.expireTime) {
      throw new Error(t('screens.inAccount.giftPages.claimPage.notExpired'));
    }

    let giftWalletMnemonic;
    if (savedGift.createdTime > GIFT_DERIVE_PATH_CUTOFF) {
      giftWalletMnemonic = await deriveSparkGiftMnemonic(
        accountMnemoinc,
        savedGift.giftNum,
      );
    } else {
      giftWalletMnemonic = await deriveKeyFromMnemonic(
        accountMnemoinc,
        savedGift.giftNum,
      );
    }

    return {
      ...savedGift,
      giftSeed: giftWalletMnemonic.derivedMnemonic,
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
      navigate.goBack();
      handleError(err.message);
    }
  }, [
    claimType,
    deriveReclaimGiftSeed,
    deriveClaimGiftSeed,
    navigate,
    handleError,
  ]);

  const getBalanceWithStatusRetry = useCallback(
    async (seed, expectedAmount, shouldEnforceAmount = false) => {
      const delays = [5000, 7000, 8000];
      let attempt = 0;

      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.giftBalanceMessage_0'),
      );

      let result = await getSparkBalance(seed);
      if (result?.didWork && Number(result.balance) === expectedAmount) {
        return result;
      }

      for (const delay of delays) {
        attempt++;
        setClaimStatus(
          t('screens.inAccount.giftPages.claimPage.giftBalanceMessage', {
            context: attempt,
          }),
        );

        await new Promise(res => setTimeout(res, delay));

        result = await getSparkBalance(seed);
        if (!result?.didWork) continue;

        if (Number(result.balance) === expectedAmount) {
          return result;
        }
      }

      if (
        shouldEnforceAmount &&
        expectedAmount !== undefined &&
        Number(result?.balance) !== expectedAmount
      ) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.balanceMismatchError'),
        );
      }

      return result;
    },
    [t, expertMode],
  );

  const ensureWalletInitialized = useCallback(
    async giftSeed => {
      let initResult = walletInitResult.current;

      if (walletInitPromise.current && !initResult) {
        initResult = await walletInitPromise.current;
      }

      if (!initResult) {
        initResult = await initializeSparkWallet(giftSeed);
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

      const formattedWalletBalance = walletBalance?.didWork
        ? Number(walletBalance?.balance)
        : giftAmount || 0;

      const fees = await getSparkPaymentFeeEstimate(
        formattedWalletBalance,
        giftSeed,
      );

      const sendingAmount = formattedWalletBalance - fees;

      if (sendingAmount <= 0) {
        if (claimType === 'reclaim' && !expertMode) {
          await deleteGift(giftDetails.uuid);
          await updateGiftLocal(giftDetails.uuid, {
            state: 'Reclaimed',
          });
          await updateGiftList();
        }

        throw new Error(
          expertMode
            ? t('screens.inAccount.giftPages.claimPage.nobalanceErrorExpert')
            : t('screens.inAccount.giftPages.claimPage.nobalanceError'),
        );
      }

      return sendingAmount;
    },
    [
      getBalanceWithStatusRetry,
      expertMode,
      claimType,
      giftDetails.uuid,
      updateGiftList,
      t,
    ],
  );

  // Extract transaction processing logic
  const processTransaction = useCallback(
    async (paymentResponse, receivingAddress) => {
      const tx = {
        ...paymentResponse.response,
        description:
          claimType === 'reclaim'
            ? t('screens.inAccount.giftPages.reclaimGiftMessage')
            : giftDetails.description,
        isGift: true,
      };

      const transaction = await transformTxToPaymentObject(
        tx,
        receivingAddress,
        undefined,
        false,
        [],
        undefined,
        1,
        true,
        accountMnemoinc,
      );

      transaction.details.direction = 'INCOMING';
      transaction.paymentStatus = 'pending';

      if (!transaction.details.description) {
        transaction.details.description = t(
          'screens.inAccount.giftPages.claimPage.defaultDesc',
        );
      }

      await bulkUpdateSparkTransactions([transaction]);

      if (!expertMode) {
        await deleteGift(giftDetails.uuid);
        if (claimType === 'reclaim') {
          await updateGiftLocal(giftDetails.uuid, {
            state: 'Reclaimed',
          });
          await updateGiftList();
        }
      }
    },
    [
      claimType,
      giftDetails.description,
      giftDetails.uuid,
      expertMode,
      updateGiftList,
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
      const sendingAmount = await calculatePaymentAmount(
        giftDetails.giftSeed,
        giftDetails.amount,
      );

      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.claimingGiftMessage4'),
      );

      const paymentResponse = await sendSparkPayment({
        receiverSparkAddress: receivingAddress,
        amountSats: sendingAmount,
        mnemonic: giftDetails.giftSeed,
      });

      if (!paymentResponse.didWork) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.paymentError'),
        );
      }

      await processTransaction(paymentResponse, receivingAddress);
      setDidClaim(true);
    } catch (err) {
      console.log('Error claiming gift:', err);
      navigate.goBack();
      handleError(err.message || 'Failed to claim gift');
    } finally {
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
    t,
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

  useEffect(() => {
    if (didClaim) {
      animationRef.current?.play();
    }
  }, [didClaim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      walletInitPromise.current = null;
      walletInitResult.current = null;
      isClaimingRef.current = false;
    };
  }, []);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  const containerBackgroundColor = useMemo(() => {
    return theme && darkModeType ? backgroundColor : backgroundOffset;
  }, [theme, darkModeType, backgroundColor, backgroundOffset]);

  if (!sparkInformation.identityPubKey || !sparkInformation.didConnect) {
    return (
      <FullLoadingScreen
        text={t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage')}
      />
    );
  }

  if (!Object.keys(giftDetails).length) {
    return <FullLoadingScreen showText={false} />;
  }

  if (didClaim) {
    return (
      <View style={styles.tempClaimMessageContainer}>
        <LottieView
          ref={animationRef}
          source={confirmAnimation}
          loop={false}
          style={styles.lottieView}
        />
        <ThemeText
          styles={styles.confirmMessage}
          content={t('screens.inAccount.giftPages.claimPage.confirmMessage')}
        />
        <CustomButton
          actionFunction={navigate.goBack}
          textContent={t('constants.done')}
        />
      </View>
    );
  }

  const amountDisplay = expertMode
    ? customGiftIndex
    : displayCorrectDenomination({
        amount: giftDetails.amount,
        masterInfoObject,
        fiatStats,
      });

  const headerText =
    claimType === 'reclaim'
      ? t('screens.inAccount.giftPages.claimPage.reclaimHead')
      : t('screens.inAccount.giftPages.claimPage.claimHead');

  const amountHeaderText =
    claimType === 'reclaim'
      ? expertMode
        ? t('screens.inAccount.giftPages.claimPage.reclaimAmountHeadExpert')
        : t('screens.inAccount.giftPages.claimPage.reclaimAmountHead')
      : t('screens.inAccount.giftPages.claimPage.claimAmountHead');

  const amountDescriptionText = expertMode
    ? t('screens.inAccount.giftPages.claimPage.networkFeeWarningExpert')
    : t('screens.inAccount.giftPages.claimPage.networkFeeWarning');

  const buttonText = isClaiming
    ? t('screens.inAccount.giftPages.claimPage.buttonTextClaiming')
    : claimType === 'reclaim'
    ? t('screens.inAccount.giftPages.claimPage.reclaimButton')
    : t('screens.inAccount.giftPages.claimPage.claimButton');

  const loadingText =
    claimStatus ||
    (claimType === 'reclaim'
      ? t('screens.inAccount.giftPages.claimPage.reclaimLoading')
      : t('screens.inAccount.giftPages.claimPage.claimLoading'));

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.header} content={headerText} />
      <View
        style={[styles.border, { backgroundColor: containerBackgroundColor }]}
      />

      {isClaiming ? (
        <FullLoadingScreen
          textStyles={styles.claimingMessage}
          text={loadingText}
        />
      ) : (
        <>
          <View
            style={[
              styles.amountContainer,
              { backgroundColor: containerBackgroundColor },
            ]}
          >
            <ThemeText
              styles={styles.amountHeader}
              content={amountHeaderText}
            />
            <ThemeText styles={styles.amount} content={amountDisplay} />
            <ThemeText
              styles={styles.amountDescription}
              content={amountDescriptionText}
            />
          </View>
          <CustomButton
            buttonStyles={styles.buttonContainer}
            textContent={buttonText}
            actionFunction={handleClaim}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  header: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    fontWeight: 500,
  },
  border: {
    height: 3,
    marginVertical: 20,
  },
  amountContainer: {
    padding: 20,
    borderRadius: 8,
    marginBottom: 10,
  },
  amountHeader: {
    textAlign: 'center',
  },
  amount: {
    textAlign: 'center',
    fontSize: SIZES.xxLarge,
    marginVertical: 10,
  },
  amountDescription: {
    fontSize: SIZES.small,
    textAlign: 'center',
    opacity: 0.6,
  },
  buttonContainer: {
    marginTop: 'auto',
  },
  tempClaimMessageContainer: {
    flex: 1,
    alignItems: 'center',
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  confirmMessage: { textAlign: 'center', marginBottom: 'auto' },
  claimingMessage: {
    textAlign: 'center',
    width: INSET_WINDOW_WIDTH,
    minHeight: 80,
  },
  lottieView: {
    width: 150,
    height: 150,
  },
});
