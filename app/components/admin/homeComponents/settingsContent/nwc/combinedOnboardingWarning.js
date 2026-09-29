import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function CombinedOnboardingWarning() {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  // The NWC seed is created at login (ensureNWCSeed); this is informational only.
  const handleContinue = () => {
    toggleMasterInfoObject({ didViewNWCMessage: true });
  };

  return (
    <View style={styles.content}>
      <CustomScrollView showsVerticalScrollIndicator={false}>
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

      </CustomScrollView>
      <CustomButton
        buttonStyles={styles.button}
        textContent={t('settings.nwc.combinedOnboarding.continueButton')}
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
});
