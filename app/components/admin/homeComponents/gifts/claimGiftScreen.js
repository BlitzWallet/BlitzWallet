import { useEffect, useState, useRef } from 'react';
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
import { CENTER, SIZES, WEBSITE_REGEX } from '../../../../constants';
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
import { deriveKeyFromMnemonic } from '../../../../functions/seed';
import { useKeysContext } from '../../../../../context-store/keys';
import { getGiftByUuid } from '../../../../functions/gift/giftsStorage';
import { transformTxToPaymentObject } from '../../../../functions/spark/transformTxToPayment';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';

export default function ClaimGiftScreen({ url, claimType }) {
  const { accountMnemoinc } = useKeysContext();
  const { deleteGiftFromCloudAndLocal } = useGifts();
  const navigate = useNavigation();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { backgroundOffset } = GetThemeColors();
  const [giftDetails, setGiftDetails] = useState({});
  const [isClaiming, setIsClaiming] = useState(false);
  const { t } = useTranslation();

  // Store the initialization promise and result
  const walletInitPromise = useRef(null);
  const walletInitResult = useRef(null);

  useEffect(() => {
    async function loadGiftDetails() {
      try {
        if (claimType === 'reclaim') {
          let uuid;
          if (WEBSITE_REGEX.test(url)) {
            const parsedURL = parseGiftUrl(url);
            uuid = parsedURL.giftId;
          } else {
            uuid = url;
          }

          const savedGift = await getGiftByUuid(uuid);

          const giftWalletMnemonic = await deriveKeyFromMnemonic(
            accountMnemoinc,
            savedGift.giftNum,
          );

          setGiftDetails({
            ...savedGift,
            giftSeed: giftWalletMnemonic.derivedMnemonic,
          });

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

          return;
        }

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
        const giftSeed = decryptMessage(
          parsedURL.secret,
          publicKey,
          retrivedGift.encryptedText,
        );

        // very basic check to see if decryption failed
        if (giftSeed.split(' ').length < 5)
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.noGiftSeed'),
          );

        setGiftDetails({ ...retrivedGift, giftSeed });

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
    }
    if (!url) return;
    loadGiftDetails();
  }, [url]);
  console.log(giftDetails);
  const handleClaim = async () => {
    if (isClaiming) return; // Prevent double-clicks
    setIsClaiming(true);

    try {
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

      const [walletBalance, fees] = await Promise.all([
        getSparkBalance(giftDetails.giftSeed),
        getSparkPaymentFeeEstimate(giftDetails.amount, giftDetails.giftSeed),
      ]);

      const formattedWalletBalance = walletBalance?.didWork
        ? Number(walletBalance?.balance)
        : giftDetails.amount;

      const sendingAmount = formattedWalletBalance - fees;

      if (sendingAmount <= 0) {
        if (claimType === 'reclaim') {
          await deleteGiftFromCloudAndLocal(giftDetails.uuid);
          throw new Error(
            t('screens.inAccount.giftPages.claimPage.noBalanceErrorReclaim'),
          );
        }

        throw new Error(
          t('screens.inAccount.giftPages.claimPage.nobalanceError'),
        );
      }

      const paymentResponse = await sendSparkPayment({
        receiverSparkAddress: receivingAddress,
        amountSats: sendingAmount,
        mnemonic: giftDetails.giftSeed,
      });

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

      await bulkUpdateSparkTransactions([transaction]);

      if (!paymentResponse.didWork)
        throw new Error(
          t('screens.inAccount.giftPages.claimPage.paymentError'),
        );
      if (claimType === 'reclaim') {
        await deleteGiftFromCloudAndLocal(giftDetails.uuid);
      } else {
        await deleteGift(giftDetails.uuid);
      }
      await new Promise(res => setTimeout(res, 10000));
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

  if (!Object.keys(giftDetails).length) {
    return <FullLoadingScreen showText={false} />;
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
      <View style={[styles.border, { backgroundColor: backgroundOffset }]} />

      {isClaiming ? (
        <FullLoadingScreen
          text={
            claimType === 'reclaim'
              ? t('screens.inAccount.giftPages.claimPage.reclaimLoading')
              : t('screens.inAccount.giftPages.claimPage.claimLoading')
          }
        />
      ) : (
        <>
          <View
            style={[
              styles.amountContainer,
              { backgroundColor: backgroundOffset },
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
    fontWeight: 500,
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
});
