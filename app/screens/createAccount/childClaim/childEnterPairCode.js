import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../functions/CustomElements/customNumberKeyboard';
import SegmentedCodeInput from '../../../functions/CustomElements/segmentedCodeInput';
import { CENTER, COLORS, CONTENT_KEYBOARD_OFFSET } from '../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../constants/theme';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../functions/customNavigation';

export default function ChildEnterPairCode() {
  const navigate = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { status, errorMessage, submitPairing, resetSession } = useChildClaim();
  const name = route?.params?.name ?? '';
  const [code, setCode] = useState('');

  // Parent joined and the SAS is ready -> move to the verify screen.
  useEffect(() => {
    if (status === 'confirm') {
      keyboardNavigate(() => navigate.navigate('ChildVerifyCode'));
    }
  }, [status, navigate]);

  const handleBack = useCallback(() => {
    resetSession();
    keyboardGoBack(navigate);
  }, [resetSession, navigate]);

  const isValid = /^[0-9]{6}$/.test(code);
  const submit = () => isValid && submitPairing({ name, code });

  const handleKey = useCallback(id => {
    setCode(prev => {
      if (id === null) return prev.slice(0, -1);
      if (id === 'C') return '';
      if (prev.length >= 6) return prev;
      return prev + id;
    });
  }, []);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        customBackFunction={handleBack}
        label={t('settings.childAccounts.claim.pairCodeNavTitle')}
      />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.claim.pairCodeTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.claim.pairCodeSubtitle')}
        />
        <View style={styles.inputWrap}>
          <SegmentedCodeInput value={code} length={6} />
        </View>
        {!!errorMessage && (
          <ThemeText styles={styles.error} content={errorMessage} />
        )}
      </View>
      <CustomNumberKeyboard showDot={false} customFunction={handleKey} />
      <CustomButton
        buttonStyles={styles.button}
        useLoading={status === 'joining'}
        disabled={!isValid}
        textContent={t('settings.childAccounts.claim.next')}
        actionFunction={submit}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
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
  inputWrap: { marginTop: 20 },
  error: {
    fontSize: SIZES.smedium,
    color: COLORS.cancelRed,
    textAlign: 'center',
    marginTop: 16,
  },
  button: { ...CENTER },
});
