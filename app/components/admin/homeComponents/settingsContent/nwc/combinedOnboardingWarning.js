import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function CombinedOnboardingWarning({ setHasSeenMnemoinc }) {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const { backgroundOffset, backgroundColor } = GetThemeColors();

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
    <View style={styles.content}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ThemeText
          styles={styles.title}
          content={t('settings.nwc.combinedOnboarding.infoTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.nwc.combinedOnboarding.infoSubtitle')}
        />

        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          {[
            {
              icon: 'Wallet',
              label: t('settings.nwc.combinedOnboarding.row1Label'),
              desc: t('settings.nwc.combinedOnboarding.row1Description'),
            },
            {
              icon: 'ShieldCheck',
              label: t('settings.nwc.combinedOnboarding.row2Label'),
              desc: t('settings.nwc.combinedOnboarding.row2Description'),
            },
            {
              icon: 'KeyRound',
              label: t('settings.nwc.combinedOnboarding.row3Label'),
              desc: t('settings.nwc.combinedOnboarding.row3Description'),
            },
          ].map(({ icon, label, desc }, index) => (
            <View
              key={icon}
              style={[
                styles.infoRow,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: backgroundColor,
                },
              ]}
            >
              <View style={styles.infoIcon}>
                <ThemeIcon size={20} iconName={icon} />
              </View>
              <View style={styles.infoText}>
                <ThemeText styles={styles.infoLabel} content={label} />
                <ThemeText styles={styles.infoDesc} content={desc} />
              </View>
            </View>
          ))}
        </View>

        {error && (
          <View
            style={[
              styles.errorContainer,
              { backgroundColor: backgroundOffset },
            ]}
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
        buttonStyles={styles.button}
        textContent={
          error
            ? t('settings.nwc.combinedOnboarding.errorRetry')
            : t('settings.nwc.combinedOnboarding.continueButton')
        }
        actionFunction={handleContinue}
      />
    </View>
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
    marginBottom: 32,
  },
  button: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 'auto',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    gap: 3,
  },
  infoLabel: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.small,
    opacity: 0.65,
    includeFontPadding: false,
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
});
