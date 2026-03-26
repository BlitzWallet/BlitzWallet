import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import {
  COLORS,
  FONT,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { addDataToCollection } from '../../../../../../db';
import { shareMessage } from '../../../../../functions/handleShare';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
import GetThemeColors from '../../../../../hooks/themeColors';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { satsToDollars } from '../../../../../functions/spark/flashnet';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';

const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation');

// Omits visually ambiguous chars: 0/O, 1/l/I
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generatePayLinkId = () =>
  Array.from(
    { length: 9 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join('');

/**
 * PayLink Description Input Sub-Component
 * Allows user to optionally add a description before creating a paylink
 *
 * @param {Number} payLinkAmount - The amount in sats
 * @param {Function} onComplete - Callback when paylink is created and shared
 * @param {Function} onBack - Callback to go back to amount step
 * @param {Function} onSkip - Callback when user skips description (navigates to ReceiveBTC with amount)
 */
export default function PayLinkDescriptionInput({
  payLinkAmount,
  onComplete,
  onBack,
  onSkip,
  didCreatePaylink,
  setDidCreatePaylink,
  currencyType,
}) {
  const navigate = useNavigation();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const textInputRef = useRef(null);
  const isAlreadyCreating = useRef(null);
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Description is optional — only amount must be > 0
  const isValid = payLinkAmount > 0;

  const handleCreatePayLink = useCallback(async () => {
    if (!isValid || isAlreadyCreating.current) return;

    if (!sparkInformation.identityPubKey) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Wallet not connected. Please try again.',
      });
      return;
    }

    isAlreadyCreating.current = true;
    setIsLoading(true);

    try {
      const payLinkId = generatePayLinkId();
      const doc = {
        payLinkId,
        amount: payLinkAmount,
        currencyType,
        description: description.trim(),
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
        payLinkId,
      );
      if (!success) throw new Error('Failed to save paylink');

      setDidCreatePaylink(payLinkId);
      Keyboard.dismiss();

      setTimeout(() => {
        shareMessage({
          message: `https://blitzwalletapp.com/paylink/${payLinkId}`,
        });
      }, 350);
    } catch (err) {
      console.log('Error creating paylink:', err);
      isAlreadyCreating.current = false;
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [
    isValid,
    payLinkAmount,
    description,
    sparkInformation,
    masterInfoObject,
    navigate,
  ]);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  if (didCreatePaylink) {
    const howItWorksSteps = [
      {
        icon: 'Share2',
        label: t('wallet.payLinks.howItWorks.step1Label'),
        desc: t('wallet.payLinks.howItWorks.step1Desc'),
      },
      {
        icon: 'Globe',
        label: t('wallet.payLinks.howItWorks.step2Label'),
        desc: t('wallet.payLinks.howItWorks.step2Desc'),
      },
      {
        icon: 'Clock',
        label: t('wallet.payLinks.howItWorks.step3Label'),
        desc: t('wallet.payLinks.howItWorks.step3Desc'),
      },
    ];

    return (
      <View
        style={[
          styles.container,
          { paddingBottom: bottomPadding, marginBottom: 0 },
        ]}
      >
        {/* Success animation + headline */}
        <LottieView
          source={confirmAnimation}
          loop={false}
          autoPlay={true}
          style={styles.animation}
        />

        {/* How it works */}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.howItWorksContainer}
        >
          {howItWorksSteps.map(({ icon, label, desc }) => (
            <View
              key={icon}
              style={[
                styles.infoRow,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            >
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      theme && darkModeType ? backgroundOffset : COLORS.primary,
                  },
                ]}
              >
                <ThemeIcon
                  size={15}
                  iconName={icon}
                  colorOverride={COLORS.darkModeText}
                />
              </View>
              <View style={styles.infoText}>
                <ThemeText styles={styles.infoLabel} content={label} />
                <ThemeText styles={styles.infoDesc} content={desc} />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Actions */}
        <View
          style={[
            styles.buttonContainer,
            { marginTop: CONTENT_KEYBOARD_OFFSET },
          ]}
        >
          <TouchableOpacity
            onPress={() =>
              shareMessage({
                message: `https://blitzwalletapp.com/paylink/${didCreatePaylink}`,
              })
            }
            style={[
              styles.confirmButtonStyles,
              {
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText
              }
              size={20}
              iconName={'Share'}
            />
            <ThemeText
              styles={[
                styles.confirmButtonText,
                {
                  color:
                    theme && darkModeType
                      ? COLORS.lightModeText
                      : COLORS.darkModeText,
                },
              ]}
              content={t('wallet.payLinks.share')}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              copyToClipboard(
                `https://blitzwalletapp.com/paylink/${didCreatePaylink}`,
                showToast,
              )
            }
            style={[
              styles.confirmButtonStyles,
              {
                backgroundColor: 'transparent',
              },
            ]}
          >
            <ThemeText
              styles={[styles.confirmButtonText]}
              content={t('constants.copy')}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('wallet.payLinks.descriptionTitle')}
      />

      <CustomSearchInput
        textInputRef={textInputRef}
        inputText={description}
        setInputText={setDescription}
        maxLength={100}
        autoFocus={true}
        containerStyles={{ width: '100%', marginBottom: 'auto' }}
        placeholderText={t('wallet.payLinks.descriptionPlaceholder')}
      />

      <CustomButton
        enableElipsis={false}
        textContent={t('wallet.payLinks.genQRCode')}
        actionFunction={() => onSkip?.(payLinkAmount, description)}
      />

      <CustomButton
        buttonStyles={[{ backgroundColor: 'transparent' }]}
        textStyles={{ color: textColor }}
        useLoading={isLoading}
        textContent={t('wallet.payLinks.createPayLink')}
        actionFunction={handleCreatePayLink}
        disabled={isLoading || !isValid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontFamily: FONT.Descriptoin_Medium,
    fontWeight: 500,
    marginBottom: 20,
  },
  animation: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    // marginBottom: 20,
  },
  confirmHeader: {
    fontSize: SIZES.large,
    fontWeight: 500,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmText: {
    fontSize: SIZES.medium,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 'auto',
    gap: 10,
  },
  containerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  buttonStacked: {
    width: '100%',
  },
  buttonColumn: {
    flex: 1,
  },
  // How it works
  howItWorksContainer: {
    width: '100%',
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 12,
  },
  infoIcon: {
    backgroundColor: COLORS.primary,
    padding: 9,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    gap: 2,
    marginTop: -2,
  },
  infoLabel: {
    fontSize: SIZES.medium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.smedium,
    opacity: 0.65,
    includeFontPadding: false,
  },
  confirmButtonStyles: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.darkModeText,
    flexDirection: 'row',
    gap: 8,
  },
  confirmButtonText: {
    includeFontPadding: false,
    paddingVertical: 8,
  },
});
