import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../functions/CustomElements/scrollView';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import InlineQrScanner from '../../../functions/CustomElements/camera/inlineQrScanner';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  VALID_USERNAME_REGEX,
} from '../../../constants';
import { SIZES } from '../../../constants/theme';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../functions/customNavigation';
import { parsePairingQr } from '../../../functions/accounts/childPairing';
import GetThemeColors from '../../../hooks/themeColors';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import ChildQRWaiting from './childQRWaiting';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import Segmented from '../../../functions/CustomElements/redesign/Segmented';
import UserInput from '../../../functions/CustomElements/redesign/UserInput';

// Statuses in which the camera is live on the Scan tab. While joining /
// awaiting the camera is stopped (isActive=false) and the status content
// renders over the box; error/expired keep the camera alive so a re-scan can
// fire.
const LIVE_SCANNING_STATUSES = ['idle', 'error', 'expired'];

export default function ChildEnterCode() {
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { backgroundOffset, tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          onBack={handleBack}
          title={t(
            isScanTab
              ? 'settings.childAccounts.claim.scanNavTitle'
              : 'settings.childAccounts.claim.codeNavTitle',
          )}
        />

        <View style={styles.toggleWrap}>
          <Segmented
            options={[
              {
                value: 'code',
                label: t('settings.childAccounts.claim.codeOption'),
              },
              {
                value: 'scan',
                label: t('settings.childAccounts.claim.scanOption'),
              },
            ]}
            value={selectedDisplayOption}
            onChange={selectDisplayOption}
          />
        </View>

        {isScanTab ? (
          <View style={styles.content}>
            <ThemeText
              variant="title"
              styles={styles.title}
              content={t('settings.childAccounts.claim.scanTitle')}
            />
            <ThemeText
              variant="body"
              styles={[styles.subtitle, { color: tokens.muted }]}
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
              <ThemeText
                styles={[styles.error, { color: tokens.danger }]}
                content={errorMessage}
              />
            )}
          </View>
        ) : (
          <>
            <CustomScrollView
              style={styles.codeScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ThemeText
                variant="title"
                styles={styles.title}
                content={t('settings.childAccounts.claim.codeTitle')}
              />
              <ThemeText
                variant="body"
                styles={[styles.subtitle, { color: tokens.muted }]}
                content={t('settings.childAccounts.claim.codeSubtitle')}
              />
              <UserInput
                value={name}
                onChangeText={setName}
                maxLength={30}
                placeholder={t('settings.childAccounts.claim.codePlaceholder')}
                onSubmitEditing={goNext}
                onFocus={() => setIsKeyboardActive(true)}
                onBlur={() => setIsKeyboardActive(false)}
                focusRing
              />
            </CustomScrollView>

            <CustomButton
              buttonStyles={styles.button}
              textContent={t('settings.childAccounts.claim.next')}
              actionFunction={goNext}
              size={'regular'}
            />
          </>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { ...CENTER, flex: 1 },
  toggleWrap: { width: '100%', marginTop: 12 },
  content: { flex: 1 },
  codeScroll: { flex: 1 },
  title: {
    letterSpacing: -0.44,
    marginTop: 28,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    textAlign: 'center',
  },
  scannerBox: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: SIZES.smedium,
    textAlign: 'center',
    marginTop: 16,
  },
  button: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
