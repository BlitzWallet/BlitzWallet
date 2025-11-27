import { useEffect, useState, useRef, useMemo } from 'react';
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
import { getGiftByUuid } from '../../../../functions/gift/giftsStorage';
import { transformTxToPaymentObject } from '../../../../functions/spark/transformTxToPayment';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
import { deriveSparkGiftMnemonic } from '../../../../functions/gift/deriveGiftWallet';
import { deriveKeyFromMnemonic } from '../../../../functions/seed';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function ClaimGiftScreen({ url, claimType }) {
  const { accountMnemoinc } = useKeysContext();
  const { deleteGiftFromCloudAndLocal } = useGifts();
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

  const loadGiftDetails = async () => {
    try {
      let giftSeed;

      if (claimType === 'reclaim') {
        let uuid;
        if (WEBSITE_REGEX.test(url)) {
          const parsedURL = parseGiftUrl(url);
          uuid = parsedURL.giftId;
        } else {
          uuid = url;
        }

        const savedGift = await getGiftByUuid(uuid);

        if (Date.now() < savedGift.expireTime) {
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.notExpired'),
          );
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
        giftSeed = giftWalletMnemonic.derivedMnemonic;

        setGiftDetails({
          ...savedGift,
          giftSeed: giftSeed,
        });
      } else {
        const parsedURL = parseGiftUrl(url);
        if (!parsedURL)
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.parseError'),
          );

        const retrivedGift = await getGiftCard(parsedURL.giftId);

        if (!retrivedGift || retrivedGift?.expireTime < Date.now())
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.expiredOrClaimed'),
          );

        const publicKey = getPublicKey(parsedURL.secret);
        const decodedSeed = decryptMessage(
          parsedURL.secret,
          publicKey,
          retrivedGift.encryptedText,
        );

        // very basic check to see if decryption failed
        if (decodedSeed.split(' ').length < 5)
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.noGiftSeed'),
          );

        giftSeed = decodedSeed;
        setGiftDetails({ ...retrivedGift, giftSeed });
      }

      // Pre-initialize the wallet in the background
      walletInitPromise.current = initializeSparkWallet(giftSeed)
        .then(result => {
          walletInitResult.current = result;
          console.log('Wallet pre-initialized successfully:', result);
          return result;
        })
        .catch(err => {
          console.log('Pre-initialization failed:', err);
          walletInitResult.current = null;
          return null;
        });
    } catch (err) {
      console.log(err);
      navigate.goBack();
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  const getBalanceWithStatusRetry = async (seed, expectedAmount) => {
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
      if (result?.didWork && Number(result.balance) === expectedAmount) {
        return result;
      }
    }

    return result;
  };

  const handleClaim = async () => {
    if (isClaiming) return; // Prevent double-clicks
    setIsClaiming(true);

    try {
      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.claimingGiftMessage1'),
      );
      // Wait for the pre-initialization to complete
      let initResult = walletInitResult.current;

      if (walletInitPromise.current && !initResult) {
        console.log('Waiting for pre-initialization to complete...');
        initResult = await walletInitPromise.current;
      }

      // If pre-initialization failed or wasn't successful, try again
      if (!initResult) {
        console.log('Retrying wallet initialization...');
        initResult = await initializeSparkWallet(giftDetails.giftSeed);
      }

      // Verify initialization was successful
      if (!initResult) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.giftWalletInitError'),
        );
      }

      const receivingAddress = sparkInformation.sparkAddress;

      const walletBalance = await getBalanceWithStatusRetry(
        giftDetails.giftSeed,
        giftDetails.amount,
      );

      const fees = await getSparkPaymentFeeEstimate(
        giftDetails.amount,
        giftDetails.giftSeed,
      );

      const formattedWalletBalance = walletBalance?.didWork
        ? Number(walletBalance?.balance)
        : giftDetails.amount;

      const sendingAmount = formattedWalletBalance - fees;

      if (sendingAmount <= 0) {
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.nobalanceError'),
        );
      }

      setClaimStatus(
        t('screens.inAccount.giftPages.claimPage.claimingGiftMessage4'),
      );

      const paymentResponse = await sendSparkPayment({
        receiverSparkAddress: receivingAddress,
        amountSats: sendingAmount,
        mnemonic: giftDetails.giftSeed,
      });

      if (!paymentResponse.didWork)
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.paymentError'),
        );

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
        sparkInformation.sparkAddress,
        undefined,
        false,
        [],
        undefined,
        1,
        true,
      );
      transaction.details.direction = 'INCOMING';
      transaction.paymentStatus = 'pending';

      if (!transaction.details.description) {
        transaction.details.description = t(
          'screens.inAccount.giftPages.claimPage.defaultDesc',
        );
      }

      await bulkUpdateSparkTransactions([transaction]);

      if (claimType === 'reclaim') {
        await deleteGiftFromCloudAndLocal(giftDetails.uuid);
      } else {
        await deleteGift(giftDetails.uuid);
      }
      setDidClaim(true);
    } catch (err) {
      console.log('Error claiming gift:', err);
      navigate.goBack();
      navigate.navigate('ErrorScreen', {
        errorMessage: err.message || 'Failed to claim gift',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    if (!url) return;

    async function run() {
      const isConnected =
        sparkInformation.identityPubKey && sparkInformation.didConnect;

      if (isConnected) {
        loadGiftDetails();
        return;
      }
    }

    run();
  }, [url, sparkInformation.identityPubKey, sparkInformation.didConnect]);

  useEffect(() => {
    if (!didClaim) return;
    animationRef.current?.play();
  }, [didClaim]);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

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
          style={{
            width: 150,
            height: 150,
          }}
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

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.header}
        content={
          claimType === 'reclaim'
            ? t('screens.inAccount.giftPages.claimPage.reclaimHead')
            : t('screens.inAccount.giftPages.claimPage.claimHead')
        }
      />
      <View
        style={[
          styles.border,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      />

      {isClaiming ? (
        <FullLoadingScreen
          textStyles={styles.claimingMessage}
          text={
            claimStatus ||
            (claimType === 'reclaim'
              ? t('screens.inAccount.giftPages.claimPage.reclaimLoading')
              : t('screens.inAccount.giftPages.claimPage.claimLoading'))
          }
        />
      ) : (
        <>
          <View
            style={[
              styles.amountContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            <ThemeText
              styles={styles.amountHeader}
              content={
                claimType === 'reclaim'
                  ? t('screens.inAccount.giftPages.claimPage.reclaimAmountHead')
                  : t('screens.inAccount.giftPages.claimPage.claimAmountHead')
              }
            />
            <ThemeText
              styles={styles.amount}
              content={displayCorrectDenomination({
                amount: giftDetails.amount,
                masterInfoObject,
                fiatStats,
              })}
            />
            <ThemeText
              styles={styles.amountDescription}
              content={t(
                'screens.inAccount.giftPages.claimPage.networkFeeWarning',
              )}
            />
          </View>
          <CustomButton
            buttonStyles={styles.buttonContainer}
            textContent={
              isClaiming
                ? t('screens.inAccount.giftPages.claimPage.buttonTextClaiming')
                : claimType === 'reclaim'
                ? t('screens.inAccount.giftPages.claimPage.reclaimButton')
                : t('screens.inAccount.giftPages.claimPage.claimButton')
            }
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
});
