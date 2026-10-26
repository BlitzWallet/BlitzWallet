import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../functions/CustomElements/scrollView';
import { KeyContainer } from '../../../components/login';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../constants';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import { useKeysContext } from '../../../../context-store/keys';
import { useState } from 'react';
import GetThemeColors from '../../../hooks/themeColors';
import { HIDDEN_OPACITY } from '../../../constants/theme';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../functions/CustomElements/redesign/PageHeader';

const MASKED_WORD = '••••••';

export default function GenerateKey() {
  const { accountMnemoinc } = useKeysContext();
  const mnemonic = accountMnemoinc.split(' ');
  const [showSeed, setShowSeed] = useState(false);

  const { t } = useTranslation();
  const hookNavigate = useNavigation();
  const { tokens } = GetThemeColors();
  const isWeb = Platform.OS === 'web';
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

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
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <PageHeader
            large
            title={t(
              isWeb
                ? 'createAccount.keySetup.generateKey.webHeader'
                : 'createAccount.keySetup.generateKey.header',
            )}
            sub={t(
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
                    // ground at 86 % so the masked tiles show through.
                    { backgroundColor: `${tokens.ground}DB` },
                  ]}
                >
                  <View style={styles.overlayContent}>
                    <ThemeIcon
                      redesign
                      iconName="EyeOff"
                      size={28}
                      colorOverride={tokens.ink}
                    />
                    <ThemeText
                      styles={styles.revealTitle}
                      content={t(
                        'createAccount.keySetup.generateKey.revealTitle',
                      )}
                    />
                    <ThemeText
                      styles={[
                        styles.seedPrivacyMessage,
                        { color: tokens.muted },
                      ]}
                      content={t(
                        'createAccount.keySetup.generateKey.seedPrivacyMessage',
                      )}
                    />
                    <CustomButton
                      actionFunction={() => setShowSeed(true)}
                      textContent={t(
                        'createAccount.keySetup.generateKey.showIt',
                      )}
                      size={'small'}
                      buttonStyles={styles.revealButton}
                      textStyles={styles.revealButtonText}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </CustomScrollView>

        <View style={styles.footer}>
          <ThemeText
            styles={[
              isWeb ? styles.footerText : styles.disclaimer,
              { color: tokens.muted },
            ]}
            content={t(
              isWeb
                ? 'createAccount.keySetup.generateKey.webSubHeader'
                : 'createAccount.keySetup.generateKey.disclaimer',
            )}
          />
          <CustomButton
            buttonStyles={{
              opacity: canContinue ? 1 : HIDDEN_OPACITY,
            }}
            textContent={t('constants.next')}
            actionFunction={handleNextPress}
            disabled={!canContinue}
            size={'regular'}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  seedWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: 24,
  },
  overlay: {
    position: 'absolute',
    top: -6,
    bottom: 4,
    left: -6,
    right: -6,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 28,
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  overlayContent: {
    alignItems: 'center',
  },
  revealTitle: {
    fontSize: 17,
    lineHeight: 24,
    marginTop: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },
  seedPrivacyMessage: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  revealButton: { paddingHorizontal: 24 },
  revealButtonText: { fontSize: 15 },
  footer: {
    gap: 12,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    includeFontPadding: false,
  },
  disclaimer: {
    textAlign: 'center',
  },
});
