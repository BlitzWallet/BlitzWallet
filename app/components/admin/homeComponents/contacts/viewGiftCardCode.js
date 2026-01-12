import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  Linking,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useEffect, useState } from 'react';
import { useKeysContext } from '../../../../../context-store/keys';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {
  fetchAndCacheGiftCardData,
  saveGiftCardData,
} from '../../../../functions/contacts/giftCardStorage';
import { COLORS, SIZES } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '../../../../functions';
import { useToast } from '../../../../../context-store/toastManager';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';

export default function ViewGiftCardCodePage({
  giftCardInfo,
  isOutgoingPayment,
  message,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const [codeInformation, setCodeInformation] = useState(null);
  const isUserMarkedClaimed = codeInformation?.userMarkedClaimed;
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    async function getCardInformation() {
      if (!giftCardInfo?.invoice) return;
      try {
        const cardData = await fetchAndCacheGiftCardData(
          giftCardInfo.invoice,
          contactsPrivateKey,
          publicKey,
        );
        if (cardData) {
          setCodeInformation(cardData);
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('contacts.viewGiftCardCode.noCardInfoError'),
          });
        }
      } catch (err) {
        console.error('Error loading gift card:', err);
      }
    }
    getCardInformation();
  }, [giftCardInfo?.invoice, contactsPrivateKey, publicKey]);

  const handleClaimPress = () => {
    if (codeInformation?.claimData?.claimLink) {
      Linking.openURL(codeInformation.claimData.claimLink);
    }
  };

  const toggleClaimedStatus = async () => {
    const newStatus = !codeInformation?.userMarkedClaimed;
    const newData = {
      ...codeInformation,
      userMarkedClaimed: newStatus,
    };

    const response = await saveGiftCardData(giftCardInfo.invoice, newData);

    if (response) {
      setCodeInformation(newData);
    } else {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.genericError'),
      });
    }
  };

  if (!codeInformation) {
    return (
      <FullLoadingScreen text={t('contacts.viewGiftCardCode.loadingMessage')} />
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Main Gift Card Display */}
      <View
        style={[
          styles.giftCardContainer,
          {
            paddingTop:
              !isOutgoingPayment && codeInformation?.status !== 'Completed'
                ? 0
                : 40,
          },
        ]}
      >
        {/* Header with Logo, Name, and Claimed Toggle */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: codeInformation.logo }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.nameSection}>
            <ThemeText
              styles={styles.cardName}
              content={codeInformation.name}
            />
            <ThemeText
              styles={styles.cardType}
              content={codeInformation.cardType}
            />
          </View>

          {/* Claimed Status Toggle */}
          {!isOutgoingPayment && codeInformation?.status === 'Completed' && (
            <TouchableOpacity
              onPress={toggleClaimedStatus}
              style={{
                ...styles.claimedToggle,
                backgroundColor: isUserMarkedClaimed
                  ? theme
                    ? darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary
                    : COLORS.primary
                  : 'transparent',
                borderColor: theme
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : backgroundOffset,
              }}
            >
              <View style={styles.claimedToggleContent}>
                <ThemeText
                  styles={{
                    ...styles.claimedToggleText,
                    color: isUserMarkedClaimed
                      ? theme
                        ? darkModeType
                          ? COLORS.lightModeText
                          : COLORS.darkModeText
                        : COLORS.darkModeText
                      : textColor,
                  }}
                  content={
                    isUserMarkedClaimed
                      ? t('contacts.viewGiftCardCode.claimed')
                      : t('contacts.viewGiftCardCode.markAsClaimed')
                  }
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Banner */}
        {codeInformation?.status !== 'Completed' && (
          <View style={styles.statusBanner}>
            <ThemeText
              styles={styles.statusTitle}
              content={t('contacts.viewGiftCardCode.unpaidMessage')}
            />
          </View>
        )}

        {/* Amount Display */}
        {!isOutgoingPayment && (
          <View
            style={[
              styles.amountSection,
              {
                backgroundColor: theme
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.darkModeText,
              },
            ]}
          >
            <ThemeText
              styles={styles.amountLabel}
              content={t('contacts.viewGiftCardCode.valueHeader')}
            />
            <FormattedSatText
              styles={styles.amountValue}
              balance={codeInformation.amountSats}
              useMillionDenomination={true}
              globalBalanceDenomination={'fiat'}
              neverHideBalance={true}
            />
            <FormattedSatText
              styles={styles.amountSats}
              balance={codeInformation.amountSats}
              useMillionDenomination={true}
              globalBalanceDenomination={'sats'}
              neverHideBalance={true}
            />

            {/* UUID integrated into amount section */}
            <View style={styles.uuidContainer}>
              <ThemeText
                styles={styles.uuidLabel}
                content={t('contacts.viewGiftCardCode.cardUUID')}
              />
              <TouchableOpacity
                onPress={() => {
                  copyToClipboard(codeInformation.uuid, showToast);
                }}
                style={styles.uuidTouchable}
              >
                <ThemeText
                  styles={styles.uuid}
                  content={codeInformation.uuid}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* For outgoing payments, show UUID in a minimal card */}
        {isOutgoingPayment && (
          <View
            style={[
              styles.outgoingUuidContainer,
              {
                borderColor: theme
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : backgroundOffset,
              },
            ]}
          >
            <ThemeText
              styles={styles.uuidLabel}
              content={t('contacts.viewGiftCardCode.cardUUID')}
            />
            <TouchableOpacity
              onPress={() => {
                copyToClipboard(codeInformation.uuid, showToast);
              }}
              style={styles.uuidTouchable}
            >
              <ThemeText styles={styles.uuid} content={codeInformation.uuid} />
            </TouchableOpacity>
          </View>
        )}

        {/* Message Section */}
        {message && (
          <View
            style={[
              styles.messageSection,
              {
                backgroundColor: theme
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.darkModeText,
              },
            ]}
          >
            <ThemeText
              styles={styles.messageLabel}
              content={t('contacts.viewGiftCardCode.messageLabel')}
            />
            <ThemeText styles={styles.messageText} content={message} />
          </View>
        )}

        {/* Claim Information */}
        {!isOutgoingPayment && codeInformation?.status === 'Completed' && (
          <>
            {codeInformation.claimData && (
              <View style={styles.claimSection}>
                <TouchableOpacity
                  onPress={() =>
                    navigate.navigate('InformationPopup', {
                      textContent: t('errormessages.giftCardExpiration'),
                      buttonText: t('constants.understandText'),
                    })
                  }
                  style={styles.redeemTextContainer}
                >
                  <ThemeText
                    styles={styles.sectionTitle}
                    content={t('contacts.viewGiftCardCode.redeemHeader')}
                  />
                </TouchableOpacity>
                {codeInformation.claimData.claimLink && (
                  <CustomButton
                    actionFunction={handleClaimPress}
                    textContent={t('contacts.viewGiftCardCode.openClaimText')}
                  />
                )}
                {codeInformation.claimData.codes &&
                  codeInformation.claimData.codes.length > 0 && (
                    <View
                      style={[
                        styles.codesContainer,
                        {
                          backgroundColor: theme
                            ? darkModeType
                              ? backgroundColor
                              : backgroundOffset
                            : COLORS.darkModeText,
                        },
                      ]}
                    >
                      {codeInformation.claimData.codes.map((code, index) => (
                        <View key={index} style={styles.codeItem}>
                          <ThemeText
                            styles={styles.codeLabel}
                            content={`${code.label}:`}
                          />
                          <ThemeText
                            styles={styles.codeValue}
                            content={code.value}
                          />
                        </View>
                      ))}
                    </View>
                  )}
              </View>
            )}
          </>
        )}

        {/* Help Section */}
        <View
          style={[
            styles.helpSection,
            {
              backgroundColor: theme
                ? darkModeType
                  ? backgroundOffset
                  : backgroundColor
                : backgroundColor,
              borderColor: theme
                ? darkModeType
                  ? backgroundColor
                  : backgroundOffset
                : backgroundOffset,
            },
          ]}
        >
          <ThemeText
            styles={styles.helpTitle}
            content={t('contacts.viewGiftCardCode.helpHeader')}
          />
          <ThemeText
            styles={styles.helpText}
            content={t('contacts.viewGiftCardCode.helpDesc')}
          />
          <TouchableOpacity
            onPress={() =>
              Linking.openURL('mailto:support@thebitcoincompany.com')
            }
            style={[
              styles.emailButton,
              {
                backgroundColor:
                  theme && darkModeType
                    ? backgroundColor
                    : 'rgba(0, 122, 255, 0.1)',
              },
            ]}
          >
            <ThemeText
              styles={{
                ...styles.emailText,
                color:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              }}
              content="support@thebitcoincompany.com"
            />
          </TouchableOpacity>
        </View>

        {/* Redemption Instructions */}
        {codeInformation.redemptionInstructions && (
          <View style={styles.instructionsSection}>
            <ThemeText
              styles={styles.sectionTitle}
              content={t('contacts.viewGiftCardCode.instructionsHeader')}
            />
            <ThemeText
              styles={styles.instructionsText}
              content={codeInformation.redemptionInstructions}
            />
          </View>
        )}

        {/* Terms and Conditions */}
        {codeInformation.terms && (
          <View style={styles.termsSection}>
            <ThemeText
              styles={styles.sectionTitle}
              content={t('contacts.viewGiftCardCode.terms&conditions')}
            />
            <ThemeText
              styles={styles.termsText}
              content={codeInformation.terms}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 30,
  },
  giftCardContainer: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logo: {
    width: 45,
    height: 45,
  },
  nameSection: {
    flex: 1,
  },
  cardName: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginBottom: 2,
  },
  cardType: {
    fontSize: SIZES.small,
    opacity: 0.7,
  },
  claimedToggle: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginLeft: 8,
    right: 0,
    top: -40,
  },
  claimedToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  claimedToggleText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  amountSection: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  amountLabel: {
    opacity: 0.7,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: SIZES.huge,
    marginBottom: 2,
  },
  amountSats: {
    opacity: 0.8,
    marginBottom: 16,
  },
  uuidContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    paddingTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  uuidLabel: {
    opacity: 0.5,
    fontSize: SIZES.small,
    marginBottom: 4,
  },
  uuidTouchable: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  uuid: {
    opacity: 0.8,
    textAlign: 'center',
    fontSize: SIZES.small,
  },
  outgoingUuidContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  messageSection: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  messageLabel: {
    opacity: 0.7,
    fontSize: SIZES.small,
    marginBottom: 8,
  },
  messageText: {
    fontSize: SIZES.medium,
    lineHeight: 20,
    opacity: 0.9,
  },
  claimSection: {
    marginBottom: 20,
  },
  redeemTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aboutIcon: {
    width: 20,
    height: 20,
    marginLeft: 5,
  },
  sectionTitle: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  codesContainer: {
    borderRadius: 8,
    padding: 12,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  codeLabel: {
    fontSize: 13,
  },
  codeValue: {
    fontSize: 13,
  },
  instructionsSection: {
    marginBottom: 20,
  },
  instructionsText: {
    fontSize: SIZES.small,
    lineHeight: 18,
    opacity: 0.8,
  },
  termsSection: {
    marginBottom: 10,
  },
  termsText: {
    fontSize: SIZES.small,
    lineHeight: 18,
    opacity: 0.8,
  },
  helpSection: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  helpTitle: {
    fontSize: SIZES.medium,
    marginBottom: 8,
    opacity: 0.9,
  },
  helpText: {
    fontSize: SIZES.small,
    lineHeight: 18,
    opacity: 0.7,
    marginBottom: 12,
  },
  emailButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  emailText: {
    fontSize: SIZES.small,
    textDecorationLine: 'underline',
  },
  statusBanner: {
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: SIZES.medium,
    marginBottom: 4,
    opacity: 0.7,
    textAlign: 'center',
  },
});
