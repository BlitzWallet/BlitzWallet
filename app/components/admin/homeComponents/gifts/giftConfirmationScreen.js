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
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { handleGiftCardShare } from '../../../../functions/gift/standardizeLinkShare';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGifts } from '../../../../../context-store/giftContext';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function GiftConfirmation(props) {
  const {
    isBulk = false,
    // Single gift params
    giftId = '',
    // Bulk gift params
    giftsUUIDs = [],
  } = props.route?.params || {};

  const { giftsArray } = useGifts();
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const animationRef = useRef(null);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const gifts = isBulk
    ? giftsArray.filter(gift => {
        return giftsUUIDs.includes(gift?.uuid);
      })
    : giftsArray.find(gift => gift?.uuid === giftId);

  console.log('Gifts to display:', gifts);

  const handleCopy = data => {
    copyToClipboard(data, showToast);
  };

  const handleCopyAllLinks = () => {
    const allLinks = gifts.map(g => g.claimURL).join('\n');
    console.log(allLinks);
    copyToClipboard(allLinks, showToast);
  };

  const handleShare = async () => {
    try {
      const targetStorageObject = isBulk ? gifts : gifts;
      const targetLink = isBulk ? gifts?.claimURL : gifts.claimURL;
      const targetAmount = isBulk ? gifts?.amount : gifts?.amount;

      await handleGiftCardShare({
        amount: displayCorrectDenomination({
          amount:
            targetStorageObject?.denomination === 'BTC'
              ? targetAmount
              : targetStorageObject?.dollarAmount,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination:
              targetStorageObject?.denomination === 'USD' ? 'fiat' : 'sats',
          },
          fiatStats,
          convertAmount: targetStorageObject?.denomination !== 'USD',
          forceCurrency:
            targetStorageObject?.denomination === 'USD' ? 'USD' : false,
        }),
        giftLink: targetLink,
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

  const headerTitle = isBulk
    ? t('screens.inAccount.giftPages.giftConfirmation.bulkHeader', {
        count: gifts.length,
      })
    : t('screens.inAccount.giftPages.giftConfirmation.header');

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        iconNew="Share"
        showLeftImage={!isBulk}
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
          <ThemeText styles={styles.title} content={headerTitle} />
          <ThemeText
            styles={styles.subtitle}
            content={t('screens.inAccount.giftPages.giftConfirmation.whatToDo')}
          />
        </View>

        {isBulk ? (
          // ── Bulk Layout ────────────────────────────────────────────────────
          <>
            {/* Copy All button */}
            <TouchableOpacity
              onPress={handleCopyAllLinks}
              style={[styles.copyAllRow, { backgroundColor: backgroundOffset }]}
              activeOpacity={0.7}
            >
              <ThemeIcon
                size={18}
                colorOverride={
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                }
                iconName={'Copy'}
              />
              <ThemeText
                styles={[
                  styles.copyAllText,
                  {
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  },
                ]}
                content={t(
                  'screens.inAccount.giftPages.giftConfirmation.copyAllLinks',
                )}
              />
            </TouchableOpacity>

            {/* Gift list */}
            <View style={styles.bulkListContainer}>
              {gifts.map((gift, index) => {
                return (
                  <View
                    key={gift?.uuid || index}
                    style={[
                      styles.bulkGiftRow,
                      { backgroundColor: backgroundOffset },
                      index < gifts.length - 1 && styles.bulkGiftRowBorder,
                      index < gifts.length - 1 && {
                        borderBottomColor: backgroundColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.bulkLinkBox,
                        {
                          backgroundColor: theme
                            ? backgroundColor
                            : COLORS.darkModeText,
                          borderColor: backgroundColor,
                        },
                      ]}
                    >
                      <ThemeText
                        CustomNumberOfLines={1}
                        styles={styles.bulkLinkText}
                        content={gift.claimURL}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCopy(gift.claimURL)}
                      style={styles.bulkCopyBtn}
                      activeOpacity={0.7}
                    >
                      <ThemeIcon
                        size={18}
                        colorOverride={
                          theme && darkModeType
                            ? COLORS.darkModeText
                            : COLORS.primary
                        }
                        iconName={'Copy'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          // ── Single Gift Layout ─────────────────────────────────────────────
          <>
            {/* Show QR Code button */}
            <TouchableOpacity
              onPress={() =>
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'customQrCode',
                  data: gifts?.claimURL,
                })
              }
              style={[
                styles.showQrButton,
                { backgroundColor: backgroundOffset },
              ]}
              activeOpacity={0.7}
            >
              <ThemeIcon size={20} iconName={'QrCode'} />
              <ThemeText
                styles={styles.showQrButtonText}
                content={t(
                  'screens.inAccount.giftPages.giftConfirmation.showQr',
                )}
              />
            </TouchableOpacity>

            {/* Gift Link */}
            <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
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
                    content={gifts?.claimURL}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(gifts?.claimURL)}
                  style={styles.copyButton}
                  activeOpacity={0.7}
                >
                  <ThemeIcon
                    size={20}
                    colorOverride={
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary
                    }
                    iconName={'Copy'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <CustomButton
          actionFunction={() => navigate.popTo('GiftsPageHome')}
          textContent={t('screens.inAccount.giftPages.giftConfirmation.done')}
        />
        <CustomButton
          buttonStyles={{ backgroundColor: 'unset' }}
          textStyles={{ color: textColor }}
          actionFunction={() => navigate.popTo('CreateGift')}
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
    marginBottom: 32,
  },
  lottieAnimation: {
    width: 160,
    height: 160,
  },
  title: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    opacity: 0.7,
    textAlign: 'center',
    maxWidth: 320,
  },
  // Single gift: Show QR button
  showQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    width: '100%',
  },
  showQrButtonText: {
    includeFontPadding: false,
  },
  card: {
    borderRadius: 16,
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
  // Bulk layout
  copyAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
    width: '100%',
  },
  copyAllText: {
    includeFontPadding: false,
  },
  bulkListContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    width: '100%',
  },
  bulkGiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bulkGiftRowBorder: {
    borderBottomWidth: 1,
  },
  bulkLinkBox: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  bulkLinkText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  bulkCopyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtons: {
    width: INSET_WINDOW_WIDTH,
    paddingTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
