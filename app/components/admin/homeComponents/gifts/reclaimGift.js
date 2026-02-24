import React, { useCallback, useMemo, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { CENTER } from '../../../../constants';
import {
  COLORS,
  FONT,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { useNavigation } from '@react-navigation/native';
import { useGifts } from '../../../../../context-store/giftContext';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function ReclaimGift() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { expiredGiftsArray } = useGifts();
  const navigate = useNavigation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [enteredLink, setEnteredLink] = useState('');
  const { textColor } = GetThemeColors();
  const { t } = useTranslation();

  const handleClaimGift = () => {
    if (!enteredLink) return;
    setEnteredLink('');
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'ClaimGiftScreen',
      url: enteredLink,
      sliderHight: 0.6,
      claimType: 'reclaim',
    });
  };

  const dropdownData = useMemo(() => {
    if (!expiredGiftsArray || !expiredGiftsArray.length) return [];

    return expiredGiftsArray?.map(item => ({
      label: item.uuid,
      value: item.uuid,
      data: item,
    }));
  }, [expiredGiftsArray]);

  const hasExpiredGift = !!dropdownData.length;

  const handleDropdownSelection = item => {
    setEnteredLink(item.data.uuid);
  };

  const handleAdvancedMode = () => {
    navigate.navigate('AdvancedGiftClaim');
  };

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
    >
      <CustomSettingsTopBar
        label={t('screens.inAccount.giftPages.claimPage.reclaimButton')}
      />
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <View style={styles.centerContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.lightModeText : COLORS.primary
              }
              iconName={'RotateCcw'}
            />
          </View>

          {/* Title & Description */}
          <ThemeText
            styles={styles.title}
            content={t('screens.inAccount.giftPages.reclaimPage.header')}
          />

          {hasExpiredGift && (
            <ThemeText
              styles={styles.description}
              content={t('screens.inAccount.giftPages.reclaimPage.desc')}
            />
          )}

          {/* Input Container */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              },
            ]}
          >
            {!hasExpiredGift && (
              <ThemeText
                styles={{
                  textAlign: 'center',
                  fontSize: SIZES.small,
                  includeFontPadding: false,
                }}
                content={t(
                  'screens.inAccount.giftPages.reclaimPage.noReclaimsMessage',
                )}
              />
            )}
            {hasExpiredGift && (
              <TextInput
                value={enteredLink}
                onChangeText={setEnteredLink}
                style={[
                  styles.input,
                  { color: textColor, includeFontPadding: false },
                ]}
                placeholder={t(
                  'screens.inAccount.giftPages.reclaimPage.inputPlaceholder',
                )}
                placeholderTextColor="#a3a3a3"
                onFocus={() => setIsKeyboardActive(true)}
                onBlur={() => setIsKeyboardActive(false)}
              />
            )}

            {hasExpiredGift && (
              <View style={{ marginTop: 10 }}>
                <DropdownMenu
                  disableDropdownPress={!dropdownData.length}
                  onSelect={handleDropdownSelection}
                  placeholder={t(
                    'screens.inAccount.giftPages.reclaimPage.dropdownPlaceHolder',
                  )}
                  customButtonStyles={{ backgroundColor }}
                  dropdownItemCustomStyles={{
                    justifyContent: 'flex-start',
                  }}
                  dropdownTextCustomStyles={{
                    fontSize: SIZES.small,
                    margin: 0,
                    padding: 0,
                  }}
                  options={dropdownData}
                  showClearIcon={false}
                  showFlag={false}
                  showVerticalArrowsAbsolute={true}
                />
              </View>
            )}
          </View>
          <CustomButton
            buttonStyles={styles.advancedContainer}
            textStyles={{ ...styles.advancedText, color: textColor }}
            textContent={t(
              'screens.inAccount.giftPages.reclaimPage.advancedModeBTN',
            )}
            actionFunction={handleAdvancedMode}
          />
        </View>

        {/* Claim Button */}
        {hasExpiredGift && (
          <CustomButton
            actionFunction={handleClaimGift}
            textContent={t('screens.inAccount.giftPages.reclaimPage.button')}
          />
        )}
      </KeyboardAwareScrollView>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
    marginTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: SIZES.small,
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 384,
    lineHeight: 20,
    opacity: 0.7,
  },
  inputContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
  },

  reclaimButton: {
    width: INSET_WINDOW_WIDTH,
    paddingVertical: 15,
    marginVertical: 10,
    ...CENTER,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  advancedContainer: {
    backgroundColor: 'unset',
    marginBottom: 20,
  },
  advancedText: {
    textDecorationLine: 'underline',
  },
});
