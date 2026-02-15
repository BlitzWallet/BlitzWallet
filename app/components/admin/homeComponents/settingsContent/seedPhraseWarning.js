import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import CustomButton from '../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function SeedPhraseWarning(props) {
  const routeMnemonic = props?.route?.params?.mnemonic || props?.mnemonic;
  const routeExtraData = props?.route?.params?.extraData || props?.extraData;
  const fromPage = props?.route?.params?.fromPage || props?.fromPage;

  const { t } = useTranslation();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { backgroundOffset, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();

  const toggleTermsAcceptance = useCallback(() => {
    setTermsAccepted(!termsAccepted);
  }, [termsAccepted]);

  const handleContinue = useCallback(() => {
    if (!termsAccepted) {
      return;
    }

    const extraData = {
      ...routeExtraData,
    };

    if (routeMnemonic) {
      extraData.mnemonic = routeMnemonic;
    }

    navigate.replace('SettingsContentHome', {
      for: 'show seed phrase',
      extraData,
    });
  }, [termsAccepted, routeMnemonic, routeExtraData]);

  const warningPoints = [
    {
      icon: 'Lock',
      text: t('settings.seedPhrase.warning.point1', {
        context: fromPage,
      }),
    },
    {
      icon: 'EyeOff',
      text: t('settings.seedPhrase.warning.point2', {
        context: fromPage,
      }),
    },
    {
      icon: 'Info',
      text: t('settings.seedPhrase.warning.point3', { context: fromPage }),
    },
  ];

  const WarningContent = useCallback(() => {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? COLORS.lightModeText
                      : COLORS.primary,
                },
              ]}
            >
              <ThemeIcon
                iconName="ShieldAlert"
                size={40}
                colorOverride={
                  theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.darkModeText
                }
              />
            </View>

            {/* Title */}
            <ThemeText
              styles={styles.title}
              content={t('settings.seedPhrase.warning.title', {
                context: fromPage,
              })}
            />

            {/* Warning Points */}
            <View style={styles.warningPointsContainer}>
              {warningPoints.map((point, index) => (
                <View key={index} style={styles.warningPoint}>
                  <View style={styles.warningIconContainer}>
                    <View
                      style={[
                        {
                          padding: 5,
                          borderRadius: 8,
                          backgroundColor:
                            theme && darkModeType
                              ? COLORS.darkModeText
                              : COLORS.primary,
                        },
                      ]}
                    >
                      <ThemeIcon
                        iconName={point.icon}
                        size={15}
                        colorOverride={
                          theme && darkModeType
                            ? COLORS.lightModeText
                            : COLORS.darkModeText
                        }
                      />
                    </View>
                  </View>
                  <ThemeText
                    styles={[styles.warningText, { color: textColor }]}
                    content={point.text}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Checkbox */}
        <TouchableOpacity
          onPress={toggleTermsAcceptance}
          style={styles.checkboxContainer}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: textColor },
              termsAccepted && {
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
                borderColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
          >
            {termsAccepted && (
              <ThemeIcon
                size={12}
                colorOverride={
                  theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                }
                iconName={'Check'}
              />
            )}
          </View>
          <ThemeText
            styles={[styles.checkboxText, { color: textColor }]}
            content={t('settings.seedPhrase.warning.checkbox')}
          />
        </TouchableOpacity>

        {/* Continue Button */}
        <CustomButton
          buttonStyles={{
            ...styles.continueButton,
            opacity: termsAccepted ? 1 : 0.6,
          }}
          textContent={t('settings.seedPhrase.warning.continueButton')}
          actionFunction={handleContinue}
        />
      </View>
    );
  }, [
    warningPoints,
    termsAccepted,
    toggleTermsAcceptance,
    handleContinue,
    textColor,
    theme,
    darkModeType,
  ]);

  if (fromPage === 'settings') {
    return <WarningContent />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <WarningContent />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    ...CENTER,
    paddingTop: 20,
    width: INSET_WINDOW_WIDTH,
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 30,
  },
  warningPointsContainer: {
    width: '100%',
    gap: 20,
  },
  warningPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningIconContainer: {
    paddingTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  checkboxContainer: {
    paddingTop: CONTENT_KEYBOARD_OFFSET,
    paddingBottom: 15,
    paddingLeft: 20,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 3,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxText: {
    fontSize: SIZES.small,
    flex: 1,
    includeFontPadding: false,
  },
  continueButton: {
    width: 145,
    ...CENTER,
  },
});
