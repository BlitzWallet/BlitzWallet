import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';

export default function ChildMatchCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { status, sas, confirmMatch, isEnded } = useChildPairing();

  // Grant delivered -> show the success screen.
  useEffect(() => {
    if (status === 'done') {
      navigate.navigate('ChildLinkSuccess');
    }
  }, [status, navigate]);

  if (isEnded) {
    return <ChildLinkError />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('settings.childAccounts.pairing.title')} />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.pairing.sasTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.pairing.sasSubtitle')}
        />
        <View style={styles.boxes}>
          {sas.split('').map((digit, index) => (
            <View
              key={index}
              style={[styles.box, { backgroundColor: backgroundOffset }]}
            >
              <ThemeText styles={styles.boxText} content={digit} />
            </View>
          ))}
        </View>
        <ThemeText
          styles={styles.hint}
          content={t('settings.childAccounts.pairing.sasHint')}
        />

        <View style={{ flex: 1 }} />
        {!isEnded && (
          <CustomButton
            buttonStyles={styles.button}
            useLoading={status === 'granting'}
            textContent={t('settings.childAccounts.pairing.confirmMatch')}
            actionFunction={confirmMatch}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: SIZES.xLarge,
    includeFontPadding: false,
  },
  hint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
  },
  message: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 20,
  },
  button: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
