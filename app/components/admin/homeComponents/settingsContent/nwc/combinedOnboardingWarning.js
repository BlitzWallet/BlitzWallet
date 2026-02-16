import { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useKeysContext } from '../../../../../../context-store/keys';
import CustomButton from '../../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  SIZES,
} from '../../../../../constants';
import { useTranslation } from 'react-i18next';
import { initializeNWCSeedInBackground } from './initializeNWCSeed';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { COLORS } from '../../../../../constants/theme';

export default function CombinedOnboardingWarning({ setHasSeenMnemoinc }) {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();

  const handleContinue = async () => {
    setIsInitializing(true);
    setError(null);

    const result = await initializeNWCSeedInBackground(
      accountMnemoinc,
      toggleMasterInfoObject,
    );

    if (result.success) {
      toggleMasterInfoObject({ didViewNWCMessage: true });
      setHasSeenMnemoinc(true);
    } else {
      setIsInitializing(false);
      setError(result.error);
    }
  };

  if (isInitializing) {
    return (
      <FullLoadingScreen
        text={t('settings.nwc.combinedOnboarding.initializingMessage')}
      />
    );
  }

  return (
    <View style={styles.globalContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sectionContainer}>
          <ThemeText
            styles={styles.sectionHeader}
            content={t('settings.nwc.combinedOnboarding.accountFundingHeader')}
          />
          <ThemeText
            styles={styles.sectionMessage}
            content={t('settings.nwc.combinedOnboarding.accountFundingMessage')}
          />
        </View>

        <View
          style={{
            ...styles.divider,
            backgroundColor: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
        />

        <View style={styles.sectionContainer}>
          <ThemeText
            styles={styles.sectionHeader}
            content={t('settings.nwc.combinedOnboarding.securityHeader')}
          />
          <ThemeText
            styles={styles.sectionMessage}
            content={t('settings.nwc.combinedOnboarding.securityMessage')}
          />
        </View>

        {error && (
          <View
            style={{
              ...styles.errorContainer,
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.cancelRed,
            }}
          >
            <ThemeText
              styles={styles.errorTitle}
              content={t('settings.nwc.combinedOnboarding.errorTitle')}
            />
            <ThemeText styles={styles.errorMessage} content={error} />
          </View>
        )}
      </ScrollView>

      <CustomButton
        actionFunction={handleContinue}
        buttonStyles={styles.buttonContainer}
        textContent={
          error
            ? t('settings.nwc.combinedOnboarding.errorRetry')
            : t('settings.nwc.combinedOnboarding.continueButton')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 40,
    paddingBottom: 20,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionHeader: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    marginBottom: 15,
    textAlign: 'center',
  },
  sectionMessage: {
    fontSize: SIZES.medium,
    lineHeight: SIZES.medium * 1.5,
    textAlign: 'center',
  },
  divider: {
    width: '60%',
    height: 1,
    opacity: 0.3,
    alignSelf: 'center',
    marginVertical: 20,
  },
  errorContainer: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
  },
  errorTitle: {
    fontFamily: FONT.Title_Bold,
    fontSize: SIZES.large,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: SIZES.medium,
    textAlign: 'center',
  },
  buttonContainer: {
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
