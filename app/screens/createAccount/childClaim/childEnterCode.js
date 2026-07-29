import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../functions/CustomElements/button';
import SegmentedCodeInput from '../../../functions/CustomElements/segmentedCodeInput';
import { CENTER, COLORS } from '../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../constants/theme';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../functions/customNavigation';

const CODE_LENGTH = 6;

export default function ChildEnterCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { status, errorMessage, submitCode, resetSession } = useChildClaim();
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
  }, [resetSession]);

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      useStandardWidth={true}
      isKeyboardActive={true}
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
          <SegmentedCodeInput
            value={code}
            onChangeText={setCode}
            length={CODE_LENGTH}
          />
        </View>
        {!!errorMessage && (
          <ThemeText styles={styles.error} content={errorMessage} />
        )}
        <View style={{ flex: 1 }} />
        <CustomButton
          buttonStyles={styles.button}
          useLoading={status === 'joining'}
          textContent={t('settings.childAccounts.claim.next')}
          actionFunction={() => submitCode(code)}
        />
      </View>
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
    color: COLORS.cancelRed,
    textAlign: 'center',
    marginTop: 16,
  },
  button: {
    width: '100%',
    ...CENTER,
  },
});
