import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useToast } from '../../../../../context-store/toastManager';
import { satsToDollars } from '../../../../functions/spark/flashnet';
import { addDataToCollection } from '../../../../../db';
import { shareMessage } from '../../../../functions/handleShare';
import { copyToClipboard } from '../../../../functions';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import LottieView from 'lottie-react-native';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

const BLUE_DIM = 'rgba(3,117,246,0.14)';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generatePayLinkId = () =>
  Array.from(
    { length: 9 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join('');

export default function ShareInvoicePayLinkModal({
  rawAmount,
  currencyType,
  onCreated,
  setContentHeight,
  sharePayLinkCache,
}) {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { sparkInformation } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const hasCreated = useRef(false);
  const [payLinkId, setPayLinkId] = useState(null);
  const copyTimeout = useRef(null);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    if (hasCreated.current) return;
    hasCreated.current = true;

    async function createPayLink() {
      if (!sparkInformation.identityPubKey) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'screens.inAccount.receiveBtcPage.walletNotConnected',
          ),
        });
        return;
      }

      if (sharePayLinkCache?.payLinkId) {
        setContentHeight?.(700);
        setPayLinkId(sharePayLinkCache?.payLinkId);
        return;
      }

      try {
        const newPayLinkId = generatePayLinkId();
        const displayAmount =
          currencyType === 'USD'
            ? satsToDollars(rawAmount, poolInfoRef?.currentPriceAInB)
            : rawAmount;

        const doc = {
          payLinkId: newPayLinkId,
          amount: Number(rawAmount),
          displayAmount: Number(displayAmount),
          rawAmount: Number(rawAmount),
          currencyType,
          description: '',
          name:
            globalContactsInformation.myProfile.name ||
            globalContactsInformation.myProfile.uniqueName,
          identityPubKey: sparkInformation.identityPubKey,
          creatorUUID: masterInfoObject.uuid,
          dateAdded: Date.now(),
          datePaid: null,
          isPaid: false,
        };

        const success = await addDataToCollection(
          doc,
          'blitzPaylinks',
          newPayLinkId,
        );
        if (!success) {
          throw new Error(
            t('screens.inAccount.receiveBtcPage.paylinkSaveError'),
          );
        }

        onCreated?.(newPayLinkId);
        setContentHeight?.(700);
        setPayLinkId(newPayLinkId);
      } catch (err) {
        console.log('Error creating share paylink:', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
      }
    }

    createPayLink();
  }, [
    currencyType,
    globalContactsInformation,
    masterInfoObject.uuid,
    navigate,
    onCreated,
    poolInfoRef,
    rawAmount,
    setContentHeight,
    sparkInformation.identityPubKey,
    t,
  ]);

  useEffect(() => () => clearTimeout(copyTimeout.current), []);

  if (!payLinkId) {
    return (
      <View style={styles.loadingContainer}>
        <FullLoadingScreen showText={false} />
      </View>
    );
  }

  const payLink = `https://blitzwalletapp.com/paylink/${payLinkId}`;

  const actionTextColor =
    theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;
  const primaryButtonBackground =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

  const handleCopy = () => {
    copyToClipboard(payLink, showToast);
  };

  const howItWorksSteps = [
    {
      icon: 'Send',
      label: t('wallet.payLinks.howItWorks.step1Label'),
      desc: t('wallet.payLinks.howItWorks.step1Desc'),
    },
    {
      icon: 'Globe',
      label: t('wallet.payLinks.howItWorks.step2Label'),
      desc: t('wallet.payLinks.howItWorks.step2Desc'),
    },
    {
      icon: 'Wallet',
      label: t('wallet.payLinks.howItWorks.step3Label'),
      desc: t('wallet.payLinks.howItWorks.step3Desc'),
    },
  ];

  return (
    <View style={styles.container}>
      <LottieView
        source={confirmAnimation}
        loop={false}
        style={styles.animation}
        autoPlay={true}
      />

      <View style={styles.headingContainer}>
        <ThemeText
          styles={styles.heading}
          content={t('wallet.payLinks.allSetTitle')}
        />
        <ThemeText
          styles={styles.subheading}
          content={t('wallet.payLinks.allSetSubtitle')}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.howItWorksContainer}
      >
        {howItWorksSteps.map(({ icon, label, desc }) => (
          <View key={icon} style={styles.infoRow}>
            <View
              style={[
                styles.infoIcon,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            >
              <ThemeIcon size={21} iconName={icon} />
            </View>
            <View style={styles.infoText}>
              <ThemeText styles={styles.infoLabel} content={label} />
              <ThemeText styles={styles.infoDesc} content={desc} />
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[styles.buttonContainer, { marginTop: CONTENT_KEYBOARD_OFFSET }]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => shareMessage({ message: payLink })}
          style={[
            styles.actionButton,
            { backgroundColor: primaryButtonBackground },
          ]}
        >
          <ThemeIcon
            colorOverride={actionTextColor}
            size={18}
            iconName={'Share'}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={[styles.actionButtonText, { color: actionTextColor }]}
            content={t('wallet.payLinks.share')}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCopy}
          style={[
            styles.actionButton,
            styles.ctaSecondary,
            { borderColor: backgroundOffset },
          ]}
        >
          <ThemeIcon size={18} iconName={'Copy'} />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.actionButtonText}
            content={t('wallet.payLinks.copyLink')}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  heroWrapper: {
    alignItems: 'center',
    marginTop: 30,
  },
  animation: {
    width: 125,
    height: 125,
    ...CENTER,
    // backgroundColor: 'red',
  },
  headingContainer: {
    alignItems: 'center',

    paddingHorizontal: 14,
  },
  heading: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  subheading: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginTop: 9,
    includeFontPadding: false,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginTop: 22,
  },
  linkChipIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: BLUE_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howItWorksContainer: {
    width: '100%',
    gap: 22,
    marginTop: 30,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  actionButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    includeFontPadding: false,
    textAlign: 'center',
    flexShrink: 1,
  },
  ctaSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginTop: 10,
  },
});
