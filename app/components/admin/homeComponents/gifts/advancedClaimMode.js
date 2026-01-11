import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { CENTER } from '../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function AdvancedGiftClaim() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const [giftNumber, setGiftNumber] = useState('');
  const currentGiftIndex = masterInfoObject?.currentDerivedGiftIndex || 1;
  const { t } = useTranslation();

  const handleClaim = async () => {
    const num = parseInt(giftNumber);
    if (!giftNumber || num < 1 || num > currentGiftIndex) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.giftPages.advancedMode.invalidGiftNum',
          {
            currentGiftIndex,
          },
        ),
      });
      return;
    }
    setGiftNumber('');
    keyboardNavigate(() =>
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'ClaimGiftScreen',
        expertMode: true,
        customGiftIndex: num,
        sliderHight: 0.6,
        claimType: 'reclaim',
      }),
    );
  };

  const isValid =
    giftNumber &&
    parseInt(giftNumber) >= 1 &&
    parseInt(giftNumber) <= currentGiftIndex;
  const showError = giftNumber && !isValid;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        customBackFunction={() => keyboardGoBack(navigate)}
        label={t('screens.inAccount.giftPages.advancedMode.header')}
      />

      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        bottomOffset={100}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current Index Card */}
        <View
          style={[
            styles.indexCard,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
            },
          ]}
        >
          <View>
            <ThemeText
              styles={styles.indexLabel}
              content={t(
                'screens.inAccount.giftPages.advancedMode.currentIndexHead',
              )}
            />
            <ThemeText
              styles={[styles.indexNumber]}
              content={currentGiftIndex}
            />
          </View>
          <View style={[styles.indexIcon]}>
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.lightModeText : COLORS.primary
              }
              iconName={'Gift'}
            />
          </View>
        </View>

        {/* Information Container */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
          ]}
        >
          <View style={styles.infoHeader}>
            <ThemeText
              styles={styles.infoTitle}
              content={t('screens.inAccount.giftPages.advancedMode.infoHead')}
            />

            <ThemeText
              styles={styles.infoDescription}
              content={t('screens.inAccount.giftPages.advancedMode.infoDesc1')}
            />

            <ThemeText
              styles={[styles.infoDescription, styles.infoDescriptionSpaced]}
              content={t('screens.inAccount.giftPages.advancedMode.infoDesc2')}
            />
          </View>
        </View>

        {/* Input Card */}
        <View
          style={[
            styles.inputCard,
            { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
          ]}
        >
          <ThemeText
            styles={styles.inputLabel}
            content={t('screens.inAccount.giftPages.advancedMode.inputHead')}
          />
          <CustomSearchInput
            inputText={giftNumber}
            setInputText={setGiftNumber}
            placeholderText={`1 - ${currentGiftIndex}`}
            keyboardType="number-pad"
            textInputStyles={{
              backgroundColor,
              color: textColor,
            }}
            maxLength={String(currentGiftIndex).length}
          />

          {showError && (
            <View
              style={[
                styles.errorContainer,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : COLORS.primary,
                },
              ]}
            >
              <ThemeIcon
                colorOverride={COLORS.darkModeText}
                size={22}
                iconName={'TriangleAlert'}
              />
              <ThemeText
                styles={styles.errorText}
                content={t(
                  'screens.inAccount.giftPages.advancedMode.invalidGiftNum',
                  {
                    currentGiftIndex,
                  },
                )}
              />
            </View>
          )}

          <CustomButton
            buttonStyles={[
              styles.button,
              { backgroundColor: theme ? backgroundColor : COLORS.primary },
              !isValid && styles.buttonDisabled,
            ]}
            textStyles={styles.buttonText}
            actionFunction={handleClaim}
            textContent={t(
              'screens.inAccount.giftPages.advancedMode.restoreGiftBTN',
            )}
          />
        </View>

        {/* Warning Notice */}
        <View style={[styles.warningContainer]}>
          <ThemeText
            styles={styles.warningText}
            content={t(
              'screens.inAccount.giftPages.advancedMode.advancedWarning',
            )}
          />
        </View>
      </KeyboardAwareScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    flexGrow: 1,
    ...CENTER,
  },

  infoCard: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
  },
  infoHeader: {
    gap: 8,
  },
  infoTitle: {
    fontWeight: '500',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: SIZES.smedium,
    lineHeight: 20,
    opacity: 0.6,
  },
  infoDescriptionSpaced: {
    marginTop: 12,
  },
  indexCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  indexLabel: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    marginBottom: 4,
    color: COLORS.darkModeText,
  },
  indexNumber: {
    fontSize: SIZES.huge,
    fontWeight: '500',
    color: COLORS.darkModeText,
  },
  indexIcon: {
    width: 56,
    height: 56,
    borderRadius: 32,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  indexRange: {
    fontSize: SIZES.smedium,
    color: COLORS.darkModeText,
  },
  inputCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
  },
  inputLabel: {
    fontWeight: '500',
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    flexShrink: 1,
    fontSize: SIZES.small,
    color: COLORS.darkModeText,
  },
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: HIDDEN_OPACITY,
  },
  buttonText: {
    color: COLORS.darkModeText,
  },
  warningContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },

  warningText: {
    fontSize: SIZES.small,
    textAlign: 'center',
    opacity: 0.6,
  },
});
