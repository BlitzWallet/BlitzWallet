import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import { formatDateToDayMonthYear } from '../../../../functions/rotateAddressDateChecker';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { handleGiftCardShare } from '../../../../functions/gift/standardizeLinkShare';
import { useTranslation } from 'react-i18next';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../functions/CustomElements/button';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function GiftConfirmation({
  amount,
  description,
  expiration,
  giftId = ' ',
  giftSecret = ' ',
  giftLink = ' ',
  resetPageState,
  storageObject,
}) {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const animationRef = useRef(null);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();

  const handleCopy = data => {
    copyToClipboard(data, showToast);
  };

  const handleShare = async () => {
    try {
      await handleGiftCardShare({
        amount: displayCorrectDenomination({
          amount:
            storageObject?.denomination === 'BTC'
              ? amount
              : storageObject.dollarAmount,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination:
              storageObject.denomination === 'USD' ? 'fiat' : 'sats',
          },
          fiatStats,
          convertAmount: storageObject.denomination !== 'USD',
          forceCurrency: storageObject.denomination === 'USD' ? 'USD' : false,
        }),
        giftLink,
      });
    } catch (error) {
      console.log('Share cancelled or error:', error);
    }
  };

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        iconNew="Share"
        showLeftImage={true}
        leftImageFunction={handleShare}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Animation */}
        <View style={styles.header}>
          <LottieView
            ref={animationRef}
            source={confirmAnimation}
            loop={false}
            style={styles.lottieAnimation}
          />
          <ThemeText
            styles={styles.title}
            content={t('screens.inAccount.giftPages.giftConfirmation.header')}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('screens.inAccount.giftPages.giftConfirmation.whatToDo')}
          />
        </View>

        {/* QR Code */}
        <View style={[styles.qrCard, { backgroundColor: backgroundOffset }]}>
          <TouchableOpacity onPress={() => handleCopy(giftLink)}>
            <QrCodeWrapper
              outerContainerStyle={styles.qrContainer}
              QRData={giftLink}
              qrSize={250}
            />
          </TouchableOpacity>
        </View>

        {/* Gift Details */}
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <View
            style={[styles.cardHeader, { borderBottomColor: backgroundColor }]}
          >
            <ThemeIcon size={25} iconName={'Gift'} />
            <ThemeText
              styles={styles.cardHeaderText}
              content={t(
                'screens.inAccount.giftPages.giftConfirmation.details',
              )}
            />
          </View>
          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <ThemeText
                styles={styles.detailLabel}
                content={t('constants.amount')}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.detailValue}
                content={displayCorrectDenomination({
                  amount:
                    storageObject?.denomination === 'BTC'
                      ? amount
                      : storageObject.dollarAmount,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination:
                      storageObject.denomination === 'USD' ? 'fiat' : 'sats',
                  },
                  fiatStats,
                  convertAmount: storageObject.denomination !== 'USD',
                  forceCurrency:
                    storageObject.denomination === 'USD' ? 'USD' : false,
                })}
              />
            </View>
            {description && (
              <View style={styles.detailRow}>
                <ThemeText
                  styles={styles.detailLabel}
                  content={t('constants.description')}
                />
                <ThemeText
                  styles={[styles.detailValue, styles.detailDescription]}
                  content={description}
                />
              </View>
            )}
            {expiration && (
              <View style={styles.detailRow}>
                <ThemeText
                  styles={styles.detailLabel}
                  content={t(
                    'screens.inAccount.giftPages.giftConfirmation.expire',
                  )}
                />
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.detailValueSecondary}
                  content={formatDateToDayMonthYear(expiration)}
                />
              </View>
            )}
          </View>
        </View>

        {/* Gift Link */}
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <ThemeText
            styles={styles.inputLabel}
            content={t('screens.inAccount.giftPages.giftConfirmation.giftLink')}
          />
          <View style={styles.inputRow}>
            <View
              style={[
                styles.linkContainer,
                {
                  borderColor: backgroundColor,
                  backgroundColor: theme
                    ? backgroundColor
                    : COLORS.darkModeText,
                },
              ]}
            >
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.linkText}
                content={giftLink}
              />
            </View>
            <TouchableOpacity
              onPress={() => handleCopy(giftLink)}
              style={[styles.copyButton]}
              activeOpacity={0.7}
            >
              <ThemeIcon
                size={20}
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                iconName={'Copy'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <View style={[styles.bottomButtons]}>
        <CustomButton
          actionFunction={navigate.goBack}
          textContent={t('screens.inAccount.giftPages.giftConfirmation.done')}
        />
        <CustomButton
          buttonStyles={{ backgroundColor: 'unset' }}
          textStyles={{ color: textColor }}
          actionFunction={resetPageState}
          textContent={t(
            'screens.inAccount.giftPages.giftConfirmation.createAnother',
          )}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    paddingBottom: 24,
    ...CENTER,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  lottieAnimation: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.8,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  qrCard: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: 'unset',
    width: 250,
    height: 250,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  cardHeaderText: {
    includeFontPadding: false,
    fontWeight: '500',
  },
  detailsContent: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailLabel: {},
  detailValue: {},
  detailValueSecondary: {},
  detailDescription: {
    flexShrink: 1,
    maxWidth: '60%',
    textAlign: 'right',
  },
  inputLabel: {
    marginBottom: 12,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkContainer: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  linkText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  copyButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtons: {
    width: INSET_WINDOW_WIDTH,
    paddingTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
