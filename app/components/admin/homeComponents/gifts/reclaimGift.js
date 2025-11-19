import React, { useMemo, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { CENTER, ICONS, WEBSITE_REGEX } from '../../../../constants';
import {
  COLORS,
  FONT,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import GetThemeColors from '../../../../hooks/themeColors';
import { useNavigation } from '@react-navigation/native';
import { useGifts } from '../../../../../context-store/giftContext';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import { useTranslation } from 'react-i18next';

export default function ReclaimGift({ theme }) {
  const { expiredGiftsArray } = useGifts();
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
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

  const handleDropdownSelection = item => {
    setEnteredLink(item.data.uuid);
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bottomOffset={0}
      >
        <View style={styles.content}>
          <View style={styles.centerContent}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <ThemeImage
                lightModeIcon={ICONS.rotateLeftBlue}
                darkModeIcon={ICONS.rotateLeftBlue}
                lightsOutIcon={ICONS.rotateLeft}
              />
            </View>

            {/* Title & Description */}
            <ThemeText
              styles={styles.title}
              content={t('screens.inAccount.giftPages.reclaimPage.header')}
            />

            <ThemeText
              styles={styles.description}
              content={t('screens.inAccount.giftPages.reclaimPage.desc')}
            />

            {/* Input Container */}
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
            >
              <TextInput
                value={enteredLink}
                onChangeText={setEnteredLink}
                style={[styles.input, { color: textColor }]}
                placeholder={t(
                  'screens.inAccount.giftPages.reclaimPage.inputPlaceholder',
                )}
                placeholderTextColor="#a3a3a3"
              />

              {!!dropdownData.length && (
                <View style={{ marginTop: 10 }}>
                  <DropdownMenu
                    disableDropdownPress={!dropdownData.length}
                    onSelect={handleDropdownSelection}
                    placeholder={t(
                      'screens.inAccount.giftPages.reclaimPage.dropdownPlaceHolder',
                    )}
                    customButtonStyles={{ backgroundColor }}
                    dropdownItemCustomStyles={{ justifyContent: 'start' }}
                    dropdownTextCustomStyles={{
                      fontSize: SIZES.small,
                    }}
                    options={dropdownData}
                    showClearIcon={false}
                    showVerticalArrowsAbsolute={true}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
      {/* Claim Button */}
      <TouchableOpacity
        onPress={handleClaimGift}
        style={[
          styles.reclaimButton,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            marginBottom: bottomPadding + 80,
          },
        ]}
      >
        <ThemeText
          content={t('screens.inAccount.giftPages.reclaimPage.button')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
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
    marginBottom: 32,
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
});
