import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../functions/CustomElements/customNumberKeyboard';
import SegmentedCodeInput from '../../../functions/CustomElements/segmentedCodeInput';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../constants';
import { SIZES } from '../../../constants/theme';
import { useTheme } from '../../../../context-store/theme';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../functions/customNavigation';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../functions/CustomElements/redesign/PageHeader';

export default function ChildEnterPairCode() {
  const navigate = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { status, errorMessage, submitPairing, resetSession } = useChildClaim();
  const name = route?.params?.name ?? '';
  const [code, setCode] = useState('');
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  // Parent joined and the SAS is ready -> move to the verify screen.
  useEffect(() => {
    if (status === 'confirm') {
      keyboardNavigate(() => navigate.navigate('ChildVerifyCode'));
    }
  }, [status, navigate]);

  const handleBack = useCallback(() => {
    resetSession();
    keyboardGoBack(navigate);
    return true;
  }, [resetSession, navigate]);

  useHandleBackPressNew(handleBack);

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
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          onBack={handleBack}
          title={t('settings.childAccounts.claim.pairCodeNavTitle')}
        />
        <PageHeader
          large
          title={t('settings.childAccounts.claim.pairCodeTitle')}
          sub={t('settings.childAccounts.claim.pairCodeSubtitle')}
        />
        <View style={styles.inputWrap}>
          <SegmentedCodeInput redesign value={code} length={6} />
        </View>
        {!!errorMessage && (
          <ThemeText
            styles={[styles.error, { color: tokens.danger }]}
            content={errorMessage}
          />
        )}
        <CustomNumberKeyboard
          redesign
          pinPad
          showDot={false}
          customFunction={handleKey}
        />
        <CustomButton
          buttonStyles={styles.button}
          useLoading={status === 'joining'}
          disabled={!isValid}
          textContent={t('settings.childAccounts.claim.next')}
          actionFunction={submit}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  inputWrap: { marginTop: 28 },
  error: {
    fontSize: SIZES.smedium,
    textAlign: 'center',
    marginTop: 16,
  },
  button: { marginTop: 12 },
});
