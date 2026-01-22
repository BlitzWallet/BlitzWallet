import { StyleSheet, View, ScrollView } from 'react-native';
import { KeyContainer } from '../../../components/login';
import { CENTER, COLORS, FONT, SIZES } from '../../../constants';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import LoginNavbar from '../../../components/login/navBar';
import CustomButton from '../../../functions/CustomElements/button';
import { copyToClipboard } from '../../../functions';
import { useNavigation } from '@react-navigation/native';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import { crashlyticsRecordErrorReport } from '../../../functions/crashlyticsLogs';
import { useKeysContext } from '../../../../context-store/keys';
import { useToast } from '../../../../context-store/toastManager';
import { useState } from 'react';
import GetThemeColors from '../../../hooks/themeColors';
import { HIDDEN_OPACITY } from '../../../constants/theme';

export default function GenerateKey() {
  const { showToast } = useToast();
  const { accountMnemoinc } = useKeysContext();
  const mnemonic = accountMnemoinc.split(' ');
  const [showSeed, setShowSeed] = useState(false);
  const [keyContainerDimensions, setKeyContainerDimensions] = useState({
    height: 0,
    width: 0,
  });
  const [scrollViewDimensions, setScrollViewDimensions] = useState({
    height: 0,
    width: 0,
  });
  const [warningViewDimensions, setWarningViewDimensions] = useState({
    height: 0,
    width: 0,
  });

  const { t } = useTranslation();
  const hookNavigate = useNavigation();
  const { backgroundColor } = GetThemeColors();

  const handleScrollViewLayout = e => {
    setScrollViewDimensions(e.nativeEvent.layout);
  };

  const handleKeyContainerLayout = e => {
    setKeyContainerDimensions(e.nativeEvent.layout);
  };

  const handleWarningMessageLayout = e => {
    setWarningViewDimensions(e.nativeEvent.layout);
  };

  const handleCopyPress = () => {
    if (mnemonic.length !== 12) {
      crashlyticsRecordErrorReport(
        'Not able to generate valid seed on create account path',
      );
      hookNavigate.navigate('ErrorScreen', {
        errorMessage: 'createAccount.keySetup.generateKey.invalidSeedError',
      });
      return;
    }
    copyToClipboard(mnemonic.join(' '), showToast);
  };

  const handleNextPress = () => {
    if (mnemonic.length !== 12) return;
    hookNavigate.navigate('RestoreWallet', {
      fromPath: 'newWallet',
      goBackName: 'GenerateKey',
    });
  };

  const isValidMnemonic = mnemonic.length === 12;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <LoginNavbar />
      <View style={styles.container}>
        <ThemeText
          styles={styles.header}
          content={t('createAccount.keySetup.generateKey.header')}
        />

        {!isValidMnemonic ? (
          <FullLoadingScreen
            showLoadingIcon={false}
            text={t('createAccount.keySetup.generateKey.keyGenError')}
          />
        ) : (
          <View style={styles.contentWrapper}>
            <ScrollView
              onLayout={handleScrollViewLayout}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={styles.scrollViewContainer}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <View onLayout={handleKeyContainerLayout}>
                <KeyContainer keys={mnemonic} />
              </View>
            </ScrollView>

            {!showSeed && (
              <View
                style={[
                  styles.overlay,
                  {
                    height: keyContainerDimensions.height + 20,
                    width: keyContainerDimensions.width,
                    backgroundColor,
                  },
                ]}
              >
                <View
                  onLayout={handleWarningMessageLayout}
                  style={[
                    styles.warningContainer,
                    {
                      top: Math.max(
                        0,
                        (scrollViewDimensions.height -
                          warningViewDimensions.height) /
                          2,
                      ),
                    },
                  ]}
                >
                  <ThemeText
                    styles={styles.seedPrivacyMessage}
                    content={t(
                      'createAccount.keySetup.generateKey.seedPrivacyMessage',
                    )}
                  />
                  <CustomButton
                    actionFunction={() => setShowSeed(true)}
                    buttonStyles={{ ...styles.revealButton, backgroundColor }}
                    textContent={t('createAccount.keySetup.generateKey.showIt')}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.footerContent}>
          <ThemeText
            styles={styles.subHeader}
            content={t('createAccount.keySetup.generateKey.subHeader')}
          />
          <ThemeText
            styles={styles.disclaimer}
            content={t('createAccount.keySetup.generateKey.disclaimer')}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <CustomButton
            buttonStyles={{
              ...styles.actionButton,
              opacity: isValidMnemonic ? 1 : HIDDEN_OPACITY,
            }}
            textContent={t('constants.copy')}
            actionFunction={handleCopyPress}
          />
          <CustomButton
            buttonStyles={{
              ...styles.actionButton,
              ...styles.nextButton,
              opacity: isValidMnemonic ? 1 : HIDDEN_OPACITY,
            }}
            textStyles={styles.nextButtonText}
            textContent={t('constants.next')}
            actionFunction={handleNextPress}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SIZES.medium,
    paddingTop: SIZES.large,
  },

  header: {
    width: '100%',
    textAlign: 'center',
    marginBottom: SIZES.xLarge,
    marginTop: 30,
  },

  contentWrapper: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },

  scrollViewContainer: {
    flex: 1,
    width: '100%',
  },

  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: SIZES.small,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  warningContainer: {
    backgroundColor: COLORS.darkModeText,
    padding: SIZES.large,
    borderRadius: SIZES.small,
    position: 'absolute',
    marginHorizontal: SIZES.medium,
  },

  revealButton: {
    marginTop: SIZES.small,
  },

  seedPrivacyMessage: {
    textAlign: 'center',
    marginBottom: SIZES.medium,
    lineHeight: SIZES.large,
  },

  footerContent: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: SIZES.medium,
    gap: SIZES.small,
  },

  subHeader: {
    width: '90%',
    textAlign: 'center',
    fontSize: SIZES.medium,
    lineHeight: SIZES.large,
  },

  disclaimer: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: SIZES.medium,
  },

  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SIZES.small,
  },

  actionButton: {
    flex: 1,
    maxWidth: 145,
    minHeight: 48,
    borderRadius: SIZES.small,
  },

  nextButton: {
    backgroundColor: COLORS.primary,
  },

  nextButtonText: {
    color: COLORS.darkModeText,
  },
});
