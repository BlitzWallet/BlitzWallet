import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../functions/CustomElements/button';
import CustomSearchInput from '../../../functions/CustomElements/searchInput';
import WordsQrToggle from '../../../functions/CustomElements/wordsQrToggle';
import InlineQrScanner from '../../../functions/CustomElements/camera/inlineQrScanner';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
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
import { parsePairingQr } from '../../../functions/accounts/childPairing';
import GetThemeColors from '../../../hooks/themeColors';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import ChildQRWaiting from './childQRWaiting';

// Statuses in which the camera is live on the Scan tab. While joining /
// awaiting the camera is stopped (isActive=false) and the status content
// renders over the box; error/expired keep the camera alive so a re-scan can
// fire.
const LIVE_SCANNING_STATUSES = ['idle', 'error', 'expired'];

export default function ChildEnterCode() {
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { status, errorMessage, submitPairing, resetSession, sessionRef } =
    useChildClaim();
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('code');
  const [resetToken, setResetToken] = useState(0);
  const [name, setName] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const handledSession = useRef(null);

  const isScanTab = selectedDisplayOption === 'scan';

  const isLiveScanning =
    LIVE_SCANNING_STATUSES.includes(status) ||
    (status === 'done' && !sessionRef?.current?.eph);
  const isValid = VALID_USERNAME_REGEX.test(name.trim());

  const handleBack = useCallback(() => {
    resetSession();
    keyboardGoBack(navigate);
    return true;
  }, [resetSession, navigate]);

  useHandleBackPressNew(handleBack);

  const goNext = useCallback(() => {
    if (!isValid) return;
    keyboardNavigate(() =>
      navigate.navigate('ChildEnterPairCode', { name: name.trim() }),
    );
  }, [isValid, name, navigate]);

  // QR path terminal: seed imported → continue straight to PIN setup.
  useEffect(() => {
    if (
      isScanTab &&
      status === 'done' &&
      handledSession.current !== sessionRef?.current?.sessionId
    ) {
      handledSession.current = sessionRef?.current?.sessionId;
      navigate.navigate('PinSetup');
    }
  }, [isScanTab, status, navigate]);

  // A tamper / error re-scan re-arms the scanner's single-fire guard. Claim
  // failures on the QR path land on 'idle' with an error message (never
  // 'error'), so re-arm those too.
  useEffect(() => {
    if (!isScanTab) return;
    if (status === 'error' || status === 'expired') {
      setResetToken(prev => prev + 1);
    } else if (status === 'idle' && errorMessage) {
      setResetToken(prev => prev + 1);
    }
  }, [isScanTab, status, errorMessage]);

  const handleScan = useCallback(
    raw => {
      const parsed = parsePairingQr(raw);
      if (!parsed) return; // foreign/invalid QR — keep scanning
      submitPairing({
        name: parsed.name,
        code: parsed.code,
        scannedParentPub: parsed.parentEphPub,
      });
    },
    [submitPairing],
  );

  const selectDisplayOption = useCallback(
    option => {
      KeyboardController.dismiss();
      setIsKeyboardActive(false);
      if (errorMessage) {
        resetSession();
      }
      setSelectedDisplayOption(option);
    },
    [resetSession, errorMessage],
  );

  const scannerActive = isScanTab && isFocused && isLiveScanning;

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      useStandardWidth={true}
      isKeyboardActive={!isScanTab && isKeyboardActive}
      useTouchableWithoutFeedback={!isScanTab}
    >
      <CustomSettingsTopBar
        customBackFunction={handleBack}
        label={t(
          isScanTab
            ? 'settings.childAccounts.claim.scanNavTitle'
            : 'settings.childAccounts.claim.codeNavTitle',
        )}
      />

      <View style={styles.toggleWrap}>
        <WordsQrToggle
          option1Text={t('settings.childAccounts.claim.codeOption')}
          option2Text={t('settings.childAccounts.claim.scanOption')}
          option1Value="code"
          option2Value="scan"
          setSelectedDisplayOption={selectDisplayOption}
          selectedDisplayOption={selectedDisplayOption}
        />
      </View>

      {isScanTab ? (
        <View style={styles.content}>
          <ThemeText
            styles={styles.title}
            content={t('settings.childAccounts.claim.scanTitle')}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('settings.childAccounts.claim.scanSubtitle')}
          />
          <View
            style={[styles.scannerBox, { backgroundColor: backgroundOffset }]}
          >
            {isLiveScanning && (
              <InlineQrScanner
                onScan={handleScan}
                isActive={scannerActive}
                resetToken={resetToken}
                hintText={t('settings.childAccounts.claim.scanHint')}
              />
            )}
            {(status === 'joining' || status === 'confirm') && (
              <FullLoadingScreen
                text={t('settings.childAccounts.claim.connectingMessage')}
              />
            )}
            {status === 'awaiting' && <ChildQRWaiting />}
          </View>
          {!!errorMessage && (
            <ThemeText styles={styles.error} content={errorMessage} />
          )}
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.codeScroll}
            contentContainerStyle={styles.codeScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
                placeholderText={t(
                  'settings.childAccounts.claim.codePlaceholder',
                )}
                onSubmitEditingFunction={goNext}
                onFocusFunction={() => setIsKeyboardActive(true)}
                onBlurFunction={() => setIsKeyboardActive(false)}
              />
            </View>
          </ScrollView>
          <CustomButton
            buttonStyles={styles.button}
            textContent={t('settings.childAccounts.claim.next')}
            actionFunction={goNext}
          />
        </>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  toggleWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  codeScroll: {
    flex: 1,
  },
  codeScrollContent: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  scannerBox: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteCenterText: {
    width: '80%',
    textAlign: 'center',
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
