import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  SIZES,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';

export default function CreateGiftDescription(props) {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor } = GetThemeColors();

  const { amount, amountValue, dollarAmount, giftDenomination, giftQuantity } =
    props.route.params || {};

  const [description, setDescription] = useState('');

  const isOverLimit = description.length >= 150;
  const characterCountColor = isOverLimit
    ? theme && darkModeType
      ? textColor
      : COLORS.cancelRed
    : textColor;

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('screens.inAccount.giftPages.createGift.header')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <ThemeText
            styles={styles.title}
            content={t(
              'screens.inAccount.giftPages.createGift.descriptionTitle',
            )}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t(
              'screens.inAccount.giftPages.createGift.descriptionSubtitle',
            )}
          />
          <CustomSearchInput
            inputText={description}
            setInputText={setDescription}
            placeholderText={t(
              'screens.inAccount.giftPages.createGift.inputPlaceholder',
            )}
            textInputMultiline={true}
            maxLength={150}
            onFocusFunction={() => setIsKeyboardActive(true)}
            onBlurFunction={() => setIsKeyboardActive(false)}
            textInputStyles={styles.textArea}
            textAlignVertical="top"
          />
          <ThemeText
            styles={{
              textAlign: 'right',
              color: characterCountColor,
              marginTop: 6,
            }}
            content={`${description.length} / 150`}
          />
        </View>
      </ScrollView>
      <CustomButton
        buttonStyles={styles.button}
        actionFunction={() => {
          if (!description.trim()) {
            keyboardNavigate(() => {
              navigate.navigate('CreateGiftDuration', {
                amount,
                amountValue,
                dollarAmount,
                giftDenomination,
                giftQuantity,
                description: '',
              });
            });
          } else {
            keyboardNavigate(() => {
              navigate.navigate('CreateGiftDuration', {
                amount,
                amountValue,
                dollarAmount,
                giftDenomination,
                giftQuantity,
                description: description.trim(),
              });
            });
          }
        }}
        textContent={
          !description.trim()
            ? t('constants.skip', { defaultValue: 'Skip' })
            : t('constants.continue')
        }
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scroll: {
    flexGrow: 1,
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
    marginBottom: 20,
  },
  textArea: {
    minHeight: 120,
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
