import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { WINDOWWIDTH } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../functions/customNavigation';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';

export default function SavingsGoalDescribe(props) {
  const [isKeyboardActive, setIsKeyboardActive] = useState(true);
  const navigate = useNavigation();
  const { t } = useTranslation();
  const emoji = props?.route?.params?.emoji || '🎯';

  const [goalName, setGoalName] = useState('');
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor } = GetThemeColors();

  const isOverLimit = goalName.length >= 50;
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
      <CustomSettingsTopBar shouldDismissKeyboard={true} label={t('savings.goalDescribe.screenTitle')} />
      <View style={styles.container}>
        <View>
          <ThemeText styles={styles.title} content={t('savings.goalDescribe.title')} />

          <CustomSearchInput
            containerStyles={styles.inputWrap}
            placeholderText={t('savings.goalDescribe.placeholder')}
            setInputText={setGoalName}
            inputText={goalName}
            onFocusFunction={() => setIsKeyboardActive(true)}
            onBlurFunction={() => setIsKeyboardActive(false)}
            autoFocus={true}
            maxLength={50}
          />
          <ThemeText
            styles={{
              textAlign: 'right',
              color: characterCountColor,
              marginTop: 5,
            }}
            content={`${goalName.length} / ${50}`}
          />
        </View>

        <CustomButton
          buttonStyles={[styles.primaryButton]}
          actionFunction={() => {
            if (!goalName.trim()) {
              keyboardGoBack(navigate);
            } else {
              keyboardNavigate(() => {
                navigate.navigate('SavingsGoalAmount', {
                  emoji,
                  goalName: goalName.trim(),
                  mode: 'create',
                });
              });
            }
          }}
          textContent={!goalName.trim() ? t('constants.back') : t('constants.continue')}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
    justifyContent: 'space-between',
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginTop: 28,
  },
  inputWrap: {
    marginTop: 20,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: COLORS.lightModeText,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
});
