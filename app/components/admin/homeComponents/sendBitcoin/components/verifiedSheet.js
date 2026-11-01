import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../../context-store/theme';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

export default function VerifiedSheet({
  merchantName,
  verificationURL,
  address,
  addressTitle,
  setContentHeight,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigate = useNavigation();

  useEffect(() => {
    setContentHeight(320 + (verificationURL ? 40 : 0) + (address ? 40 : 0));
  }, [verificationURL, address, setContentHeight]);

  const learnMore = () => {
    navigate.navigate('CustomWebView', {
      headerText: 'Branta',
      webViewURL: verificationURL,
    });
  };

  const viewAddress = () => {
    handleBackPressFunction(() =>
      navigate.replace('CustomHalfModal', {
        wantedContent: 'sendAddress',
        address,
        title: addressTitle,
        sliderHight: 0.6,
      }),
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Disc icon="BadgeCheck" size={48} iconSize={24} tone="accent" />
      </View>
      <ThemeText
        styles={styles.title}
        content={t('wallet.sendPages.reviewParts.verified')}
      />
      <ThemeText
        variant="body"
        styles={{ color: tokens.muted, marginTop: 8 }}
        content={t(
          merchantName
            ? 'wallet.sendPages.reviewParts.verifiedBody'
            : 'wallet.sendPages.reviewParts.verifiedBodyNoName',
          { merchantName },
        )}
      />
      {!!verificationURL && (
        <TouchableOpacity
          style={styles.link}
          onPress={learnMore}
          accessibilityRole="link"
        >
          <ThemeText
            variant="body"
            styles={{ color: tokens.accent }}
            content={t('settings.about.learnMore')}
          />
        </TouchableOpacity>
      )}
      {!!address && (
        <TouchableOpacity
          style={styles.link}
          onPress={viewAddress}
          accessibilityRole="button"
        >
          <ThemeText
            variant="body"
            styles={{ color: tokens.accent }}
            content={t('wallet.sendPages.reviewParts.viewAddress')}
          />
        </TouchableOpacity>
      )}
      <CustomButton
        size="regular"
        buttonStyles={styles.button}
        actionFunction={() => handleBackPressFunction()}
        textContent={t('constants.iunderstand')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  head: { marginTop: 8, alignItems: 'flex-start' },
  title: { marginTop: 16, fontSize: 20, lineHeight: 28 },
  link: { marginTop: 12, minHeight: 44, justifyContent: 'center' },
  button: { marginTop: 'auto' },
});
