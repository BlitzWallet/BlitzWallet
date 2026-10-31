import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useKeysContext } from '../../../../../context-store/keys';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {
  fetchAndCacheGiftCardData,
  saveGiftCardData,
} from '../../../../functions/contacts/giftCardStorage';
import { CENTER, FONT } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomButton from '../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '../../../../functions';
import { useToast } from '../../../../../context-store/toastManager';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import DiscText from '../../../../functions/CustomElements/redesign/DiscText';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import Note from '../../../../functions/CustomElements/redesign/Note';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';

export default function ViewGiftCardCodePage({ route }) {
  const { giftCardInfo, isOutgoingPayment, message, senderName } =
    route.params || {};
  const [codeInformation, setCodeInformation] = useState(null);
  const isUserMarkedClaimed = codeInformation?.userMarkedClaimed;
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { tokens } = useTheme();
  const { fiatStats } = useNodeContext();
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
          navigate.goBack();
          navigate.navigate('ErrorScreen', {
            errorMessage: t('contacts.viewGiftCardCode.noCardInfoError'),
          });
        }
      } catch (err) {
        console.error('Error loading gift card:', err);
        navigate.goBack();
        navigate.navigate('ErrorScreen', {
          errorMessage: t('contacts.viewGiftCardCode.noCardInfoError'),
        });
      }
    }
    getCardInformation();
  }, [giftCardInfo?.invoice, contactsPrivateKey, publicKey, navigate, t]);

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
      navigate.goBack();
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.genericError'),
      });
    }
  };

  const title = t('contacts.viewGiftCardCode.title');

  if (!codeInformation) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.page}>
        <View style={[styles.inner, { width: INSET_WINDOW_WIDTH }, CENTER]}>
          <TopBar title={title} />
          <FullLoadingScreen
            text={t('contacts.viewGiftCardCode.loadingMessage')}
          />
        </View>
      </GlobalThemeView>
    );
  }

  const isCompleted = codeInformation?.status === 'Completed';
  const canUseCard = !isOutgoingPayment && isCompleted;
  const canOpen = canUseCard && !!codeInformation.claimData?.claimLink;
  const codes = canUseCard ? codeInformation.claimData?.codes : null;
  const storeName =
    codeInformation.name ||
    t('contacts.internalComponents.viewAllGiftCards.cardNamePlaceH');
  const cardTitle = t(
    'contacts.internalComponents.viewAllGiftCards.cardTitle',
    { store: storeName },
  );

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.page}>
      <View style={[styles.inner, { width: INSET_WINDOW_WIDTH }, CENTER]}>
        <TopBar title={title} />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <DiscText
              text={storeName.trim().charAt(0).toUpperCase() || '?'}
              size={72}
              fontSize={24}
              tone="white"
            />
            <ThemeText
              variant="body"
              content={
                senderName
                  ? t('contacts.viewGiftCardCode.cardFrom', {
                      card: cardTitle,
                      name: senderName,
                    })
                  : cardTitle
              }
              styles={[styles.heroSub, { color: tokens.muted }]}
            />
            {!isOutgoingPayment && (
              <AmountHero
                amount={codeInformation.amountSats}
                fiatStats={fiatStats}
                amountSize={48}
                splitCents={true}
              />
            )}
          </View>

          {!isCompleted && (
            <View style={styles.warning}>
              <Note
                tone="warn"
                text={t('contacts.viewGiftCardCode.unpaidMessage')}
              />
            </View>
          )}

          {!!message && (
            <View
              style={[styles.messageCard, { backgroundColor: tokens.surface }]}
            >
              <ThemeText
                variant="body"
                content={t('contacts.viewGiftCardCode.messageLabel')}
                styles={styles.messageLabel}
              />
              <ThemeText
                content={message}
                styles={[styles.messageText, { color: tokens.muted }]}
              />
            </View>
          )}

          <SectionHeader title={t('contacts.viewGiftCardCode.detailsHeader')} />
          <ListCard>
            <View style={styles.idRow}>
              <View style={styles.idTexts}>
                <ThemeText
                  variant="hint"
                  content={t('contacts.viewGiftCardCode.cardUUID')}
                />
                <ThemeText
                  CustomNumberOfLines={1}
                  CustomEllipsizeMode="middle"
                  content={codeInformation.uuid}
                  styles={styles.idValue}
                />
              </View>
              <IconButton
                icon="Copy"
                label="constants.copy"
                tone="disc"
                iconSize={18}
                onPress={() => copyToClipboard(codeInformation.uuid, showToast)}
              />
            </View>
            {codes?.map((code, index) => (
              <View key={index} style={styles.codeRow}>
                <ThemeText variant="hint" content={code.label} />
                <ThemeText content={code.value} styles={styles.codeValue} />
              </View>
            ))}
          </ListCard>
          {canUseCard && !!codeInformation.claimData && (
            <TextButton
              text={t('contacts.viewGiftCardCode.redeemHeader')}
              icon="Info"
              onPress={() =>
                navigate.navigate('InformationPopup', {
                  textContent: t('errormessages.giftCardExpiration'),
                  buttonText: t('constants.understandText'),
                })
              }
            />
          )}
          <ThemeText
            variant="hint"
            content={t('contacts.viewGiftCardCode.helpDesc')}
            styles={styles.helpText}
          />
          <TextButton
            text="support@thebitcoincompany.com"
            onPress={() =>
              Linking.openURL('mailto:support@thebitcoincompany.com')
            }
          />

          {!!codeInformation.redemptionInstructions && (
            <>
              <SectionHeader
                title={t('contacts.viewGiftCardCode.instructionsHeader')}
              />
              <ThemeText
                variant="hint"
                content={codeInformation.redemptionInstructions}
                styles={styles.bodyText}
              />
            </>
          )}

          {!!codeInformation.terms && (
            <>
              <SectionHeader
                title={t('contacts.viewGiftCardCode.terms&conditions')}
              />
              <ThemeText
                variant="hint"
                content={codeInformation.terms}
                styles={styles.bodyText}
              />
            </>
          )}
        </CustomScrollView>

        {canUseCard && (
          <View style={styles.actions}>
            {canOpen && (
              <CustomButton
                size="regular"
                textContent={t('contacts.viewGiftCardCode.openClaimText')}
                actionFunction={handleClaimPress}
              />
            )}
            <CustomButton
              size="regular"
              tone={canOpen ? 'secondary' : undefined}
              textContent={t(
                isUserMarkedClaimed
                  ? 'contacts.viewGiftCardCode.markAsUnclaimed'
                  : 'contacts.viewGiftCardCode.markAsClaimed',
              )}
              actionFunction={toggleClaimedStatus}
            />
          </View>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%' },
  inner: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 24 },
  hero: { alignItems: 'center' },
  heroSub: { marginTop: 14, textAlign: 'center' },
  warning: { marginTop: 24 },
  messageCard: { marginTop: 24, borderRadius: 20, padding: 16 },
  messageLabel: { marginBottom: 6 },
  messageText: { fontSize: 14, lineHeight: 21 },
  idRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  idTexts: { flex: 1, minWidth: 0 },
  idValue: {
    fontFamily: FONT.mono,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  codeRow: { paddingVertical: 12 },
  codeValue: { fontSize: 15, lineHeight: 22, includeFontPadding: false },
  helpText: { marginTop: 8, marginHorizontal: 4 },
  bodyText: { marginHorizontal: 4 },
  actions: { gap: 12, paddingTop: 12 },
});
