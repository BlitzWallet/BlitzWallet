import { Platform, StyleSheet, View, ScrollView } from 'react-native';
import { KeyContainer } from '../../../components/login';
import { CENTER, COLORS, SIZES } from '../../../constants';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import LoginNavbar from '../../../components/login/navBar';
import CustomButton from '../../../functions/CustomElements/button';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import { useKeysContext } from '../../../../context-store/keys';
import { useState } from 'react';
import GetThemeColors from '../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../../constants/theme';

const MASKED_WORD = '••••••';

export default function GenerateKey() {
  const { accountMnemoinc } = useKeysContext();
  const mnemonic = accountMnemoinc.split(' ');
  const [showSeed, setShowSeed] = useState(false);

  const { t } = useTranslation();
  const hookNavigate = useNavigation();
  const { backgroundColor } = GetThemeColors();
  const { theme } = useGlobalThemeContext();
  const isWeb = Platform.OS === 'web';

  const isValidMnemonic = mnemonic.length === 12;
  // Web has no later reminder it can rely on (storage may be wiped), so the
  // phrase must be revealed here before continuing.
  const canContinue = isValidMnemonic;

  const handleNextPress = () => {
    if (!canContinue) return;
    if (isWeb) {
      hookNavigate.navigate('PinSetup', { didBackupSeedPhrase: true });
      return;
    }
    hookNavigate.navigate('RestoreWallet', {
      fromPath: 'newWallet',
      goBackName: 'GenerateKey',
    });
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <LoginNavbar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <ThemeText
          styles={styles.title}
          content={t(
            isWeb
              ? 'createAccount.keySetup.generateKey.webHeader'
              : 'createAccount.keySetup.generateKey.header',
          )}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t(
            isWeb
              ? 'createAccount.keySetup.generateKey.webStorageWarning'
              : 'createAccount.keySetup.generateKey.subHeader',
          )}
        />

        {!isValidMnemonic ? (
          <FullLoadingScreen
            showLoadingIcon={false}
            text={t('createAccount.keySetup.generateKey.keyGenError')}
          />
        ) : (
          <View style={styles.seedWrapper}>
            {/* Real words are only rendered once revealed. */}
            <KeyContainer
              keys={showSeed ? mnemonic : mnemonic.map(() => MASKED_WORD)}
            />
            {!showSeed && (
              <View
                style={[
                  styles.overlay,
                  {
                    borderColor: theme
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(255,255,255,0.95)',
                  },
                ]}
              >
                <View style={[styles.overlayVeil, { backgroundColor }]} />
                <View style={styles.overlayContent}>
                  <ThemeIcon iconName="EyeOff" size={24} />
                  <ThemeText
                    styles={styles.revealTitle}
                    content={t(
                      'createAccount.keySetup.generateKey.revealTitle',
                    )}
                  />
                  <ThemeText
                    styles={styles.seedPrivacyMessage}
                    content={t(
                      'createAccount.keySetup.generateKey.seedPrivacyMessage',
                    )}
                  />
                  <CustomButton
                    buttonStyles={styles.revealButton}
                    textStyles={{ color: COLORS.darkModeText }}
                    actionFunction={() => setShowSeed(true)}
                    textContent={t('createAccount.keySetup.generateKey.showIt')}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <ThemeText
          styles={isWeb ? styles.footerText : styles.disclaimer}
          content={t(
            isWeb
              ? 'createAccount.keySetup.generateKey.webSubHeader'
              : 'createAccount.keySetup.generateKey.disclaimer',
          )}
        />
        <CustomButton
          buttonStyles={{
            ...styles.nextButton,
            opacity: canContinue ? 1 : HIDDEN_OPACITY,
          }}
          textContent={t('constants.next')}
          actionFunction={handleNextPress}
          disabled={!canContinue}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingBottom: 20,
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
  seedWrapper: {
    width: '100%',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: -SIZES.small,
    bottom: 0,
    left: -SIZES.small,
    right: -SIZES.small,
    borderRadius: SIZES.large,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...Platform.select({
      web: { backdropFilter: 'blur(18px) saturate(180%)' },
    }),
  },
  overlayVeil: {
    ...StyleSheet.absoluteFillObject,
    opacity: Platform.OS === 'web' ? 0.45 : 0.85,
  },
  overlayContent: {
    padding: SIZES.large,
    gap: SIZES.small,
  },
  revealTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
  },
  seedPrivacyMessage: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: SIZES.small,
  },
  revealButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
  },
  notice: {
    width: '100%',
    borderRadius: 8,
    padding: SIZES.medium,
    marginTop: 10,
    gap: SIZES.small,
  },
  noticeText: {
    fontSize: SIZES.smedium,
    lineHeight: 22,
  },
  footer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    gap: SIZES.medium,
    paddingTop: 10,
  },
  footerText: {
    opacity: 0.6,
    textAlign: 'center',
    fontSize: SIZES.smedium,
    lineHeight: 22,
  },
  disclaimer: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: SIZES.medium,
  },
  nextButton: {
    width: '100%',
  },
});
