import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../functions/CustomElements/button';
import CustomSearchInput from '../../../functions/CustomElements/searchInput';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  VALID_USERNAME_REGEX,
} from '../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../constants/theme';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../functions/customNavigation';

export default function ChildEnterCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { errorMessage, resetSession } = useChildClaim();
  const [name, setName] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(true);

  const handleBack = useCallback(() => {
    resetSession();
    keyboardGoBack(navigate);
  }, [resetSession, navigate]);

  const isValid = VALID_USERNAME_REGEX.test(name.trim());

  const goNext = useCallback(() => {
    if (!isValid) return;
    keyboardNavigate(() =>
      navigate.navigate('ChildEnterPairCode', { name: name.trim() }),
    );
  }, [isValid, name, navigate]);

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      useStandardWidth={true}
      isKeyboardActive={isKeyboardActive}
      useTouchableWithoutFeedback={true}
    >
      <CustomSettingsTopBar
        customBackFunction={handleBack}
        label={t('settings.childAccounts.claim.codeNavTitle')}
      />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.claim.codeTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.claim.codeSubtitle')}
        />
        <View style={styles.inputWrap}>
          <CustomSearchInput
            inputText={name}
            setInputText={setName}
            maxLength={30}
            autoFocus={true}
            placeholderText={t('settings.childAccounts.claim.codePlaceholder')}
            onSubmitEditingFunction={goNext}
            onFocusFunction={() => {
              setIsKeyboardActive(true);
            }}
            onBlurFunction={() => setIsKeyboardActive(false)}
          />
        </View>
        {!!errorMessage && (
          <ThemeText styles={styles.error} content={errorMessage} />
        )}
      </View>
      <CustomButton
        buttonStyles={styles.button}
        textContent={t('settings.childAccounts.claim.next')}
        actionFunction={goNext}
      />
    </CustomKeyboardAvoidingView>
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
    marginBottom: 20,
  },
  inputWrap: {
    marginTop: 20,
  },
  error: {
    fontSize: SIZES.smedium,
    color: COLORS.cancelRed,
    textAlign: 'center',
    marginTop: 16,
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});