import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { InputTypes } from 'bitcoin-address-parser';
import { FONT } from '../../../../../constants';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { RowShell } from '../../../../../functions/CustomElements/redesign/ListRow';
import normalizeLNURLAddress from '../../../../../functions/lnurl/normalizeLNURLAddress';
import formatSparkPaymentAddress from '../functions/formatSparkPaymentAddress';
import {
  paymentAssetLabel,
  RecipientAvatar,
  resolveAssetAvatar,
  resolveRecipientDisplay,
} from './recipientCard';

export default function RecipientRow({
  paymentInfo,
  contactInfo,
  isDollarBalance,
  isToken,
  onPress,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useGlobalThemeContext();

  const view = useMemo(() => {
    const formatted = formatSparkPaymentAddress(paymentInfo, undefined, true);
    const isBranta = !!paymentInfo?.isUsingBranta;
    const isLNURL = paymentInfo?.type === InputTypes.LNURL_PAY;
    const resolved = resolveRecipientDisplay({
      brantaName: isBranta ? paymentInfo.brantaMerchantName : undefined,
      brantaLogo: isBranta ? paymentInfo.brantaMerchantLogo : undefined,
      contactInfo,
      lnurlAddress: isLNURL
        ? normalizeLNURLAddress(paymentInfo?.data?.address) ??
          paymentInfo?.data?.address
        : undefined,
    });
    const isOnChain = formatted.paymentType === 'bitcoin';

    let avatar = resolved;
    let name = resolved?.displayName;
    if (!resolved) {
      avatar = resolveAssetAvatar({ isDollarBalance, isToken });
      name = isOnChain
        ? t(
            'screens.inAccount.receiveBtcPage.invoiceDescription_bitcoinAddress',
          )
        : paymentAssetLabel({ isDollarBalance, isToken });
    }

    let sheetTitle = t(
      'screens.inAccount.receiveBtcPage.invoiceDescription_lightningInvoice',
    );
    if (resolved?.kind === 'contact') sheetTitle = resolved.displayName;
    else if (isLNURL)
      sheetTitle = t(
        'screens.inAccount.receiveBtcPage.invoiceDescription_lightningAddress',
      );
    else if (isOnChain)
      sheetTitle = t(
        'screens.inAccount.receiveBtcPage.invoiceDescription_bitcoinAddress',
      );
    else if (formatted.paymentType === 'spark')
      sheetTitle = t(
        'screens.inAccount.receiveBtcPage.invoiceDescription_sparkAddress',
      );

    return {
      avatar,
      name,
      isBranta: isBranta && resolved?.kind === 'branta',
      sub:
        resolved?.kind === 'contact' &&
        contactInfo?.uniqueName &&
        contactInfo.uniqueName !== resolved.displayName
          ? `@${contactInfo.uniqueName}`
          : '',
      address: formatted.address,
      sheetTitle,
    };
  }, [paymentInfo, contactInfo, isDollarBalance, isToken, t]);

  const handlePress = () => {
    if (onPress) {
      onPress(view);
      return;
    }
    if (view.isBranta) {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'brantaVerified',
        merchantName: paymentInfo.brantaMerchantName,
        verificationURL: paymentInfo.verificationURL,
        address: view.address,
        addressTitle: view.sheetTitle,
        sliderHight: 0.5,
      });
      return;
    }
    if (!view.address) return;
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'sendAddress',
      address: view.address,
      title: view.sheetTitle,
      sliderHight: 0.6,
    });
  };

  return (
    <RowShell
      onPress={handlePress}
      minHeight={72}
      accessibilityRole="button"
      accessibilityLabel={view.name}
      lead={
        <RecipientAvatar resolved={view.avatar} backgroundColor={tokens.disc} />
      }
      trailing={
        <ThemeIcon
          redesign
          iconName="ChevronRight"
          size={20}
          colorOverride={tokens.muted}
        />
      }
    >
      <View style={styles.texts}>
        <ThemeText
          styles={styles.name}
          CustomNumberOfLines={2}
          content={view.name || ''}
        />
        {view.isBranta ? (
          <View style={styles.verified}>
            <ThemeIcon
              redesign
              iconName="BadgeCheck"
              size={14}
              colorOverride={tokens.accent}
            />
            <ThemeText
              variant="hint"
              styles={{ color: tokens.accent }}
              content={t('wallet.sendPages.reviewParts.verified')}
            />
          </View>
        ) : view.sub ? (
          <ThemeText
            variant="hint"
            CustomNumberOfLines={1}
            content={view.sub}
          />
        ) : null}
      </View>
    </RowShell>
  );
}

const styles = StyleSheet.create({
  texts: { flexGrow: 1, flexShrink: 1 },
  name: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
