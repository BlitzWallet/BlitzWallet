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
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import IconActionCircle from '../../../../functions/CustomElements/actionCircleContainer';

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
          <IconActionCircle bottomOffset={32} size={80} icon={'RotateCcw'} />
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
              { backgroundColor: backgroundOffset },
            ]}
          >
            {!hasExpiredGift && (
              <ThemeText
                styles={styles.noReclaimsText}
                content={t(
                  'screens.inAccount.giftPages.reclaimPage.noReclaimsMessage',
                )}
              />
            )}
            {hasExpiredGift && (
              <CustomSearchInput
                inputText={enteredLink}
                setInputText={setEnteredLink}
                textInputStyles={{
                  backgroundColor: theme
                    ? backgroundColor
                    : COLORS.darkModeText,
                }}
                placeholderText={t(
                  'screens.inAccount.giftPages.reclaimPage.inputPlaceholder',
                )}
                onFocusFunction={() => setIsKeyboardActive(true)}
                onBlurFunction={() => setIsKeyboardActive(false)}
              />
            )}

            {hasExpiredGift && (
              <View style={styles.dropdownWrapper}>
                <DropdownMenu
                  disableDropdownPress={!dropdownData.length}
                  onSelect={handleDropdownSelection}
                  placeholder={t(
                    'screens.inAccount.giftPages.reclaimPage.dropdownPlaceHolder',
                  )}
                  customButtonStyles={{
                    backgroundColor: theme
                      ? backgroundColor
                      : COLORS.darkModeText,
                  }}
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
  scrollView: {
    flex: 1,
  },
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
    borderRadius: 8,
    padding: 16,
    justifyContent: 'center',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
  },
  noReclaimsText: {
    textAlign: 'center',
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  dropdownWrapper: {
    marginTop: 8,
  },
  advancedContainer: {
    backgroundColor: 'unset',
    marginBottom: 20,
  },
  advancedText: {
    textDecorationLine: 'underline',
  },
});
