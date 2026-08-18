import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import WordsQrToggle from '../../../../../../functions/CustomElements/wordsQrToggle';
import QrCodeWrapper from '../../../../../../functions/CustomElements/QrWrapper';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { CENTER } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';
import PairingExpiryClock from './pairingExpiryClock';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import { copyToClipboard } from '../../../../../../functions';
import { share } from '../../../../../../functions/handleShare';
import { useToast } from '../../../../../../../context-store/toastManager';

export default function ChildLinkCode(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset, textColor } = GetThemeColors();
  const {
    parentUniqueName,
    startPairing,
    resetSession,
    acceptPairing,
    declineMatch,
    status,
    qrValue,
    isEnded,
  } = useChildPairing();
  const { showToast } = useToast();
  const reshareChild = props?.route?.params?.reshareChild ?? null;
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('code');

  const isQrTab = selectedDisplayOption === 'qr';

  // QR mode opens a session as soon as the QR tab is active (including the
  // mount-time auto-select from WordsQrToggle's canViewOption2 unlock).
  // startPairing guards double-start, so re-toggling is safe.
  useEffect(() => {
    if (!isQrTab) return;
    startPairing(reshareChild, 'qr');
  }, [isQrTab, startPairing, reshareChild]);

  // Toggling back to Code tears the QR session down.
  useEffect(() => {
    if (isQrTab) return;
    resetSession();
  }, [isQrTab, resetSession]);

  // QR path terminal: the grant was delivered → success screen.
  useEffect(() => {
    if (isQrTab && status === 'done') {
      navigate.navigate('ChildLinkSuccess');
    }
  }, [isQrTab, status, navigate]);

  const generateCode = () => {
    // startPairing guards double-start, so re-pressing after returning from the
    // code screen is a no-op while a session is live.
    startPairing(reshareChild);
    navigate.navigate('ChildShareCode');
  };

  const handleShareDownloadLink = useCallback(() => {
    share({ message: 'https://blitzwalletapp.com/managed' });
  }, []);

  // Security gate (QR path): the child connected, so the parent must consciously
  // grant. An Accept prompt arriving before the real child scanned is a visible
  // anomaly the parent declines — this is what makes seed theft via a
  // photographed QR timed and visible instead of silent and automatic.
  const handleQRDecline = useCallback(() => {
    if (!isQrTab) return false;
    declineMatch();
    navigate.goBack();
    return true;
  }, [isQrTab, isEnded, declineMatch]);

  useHandleBackPressNew(
    !isQrTab || (isQrTab && isEnded) ? null : handleQRDecline,
  );

  if (isQrTab && isEnded) {
    return <ChildLinkError />;
  }

  if (isQrTab && status === 'accept') {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          label={t('settings.childAccounts.pairing.title')}
          customBackFunction={handleQRDecline}
          rightContent={<PairingExpiryClock />}
        />
        <View style={styles.content}>
          <ThemeText
            styles={[styles.title, { textAlign: 'left' }]}
            content={t('settings.childAccounts.pairing.acceptTitle')}
          />
          <ThemeText
            styles={[styles.subtitle, { textAlign: 'left' }]}
            content={t('settings.childAccounts.pairing.acceptSubtitle', {
              name: reshareChild?.name ?? '',
            })}
          />
        </View>
        <CustomButton
          buttonStyles={styles.button}
          textContent={t('settings.childAccounts.pairing.acceptBTN')}
          actionFunction={acceptPairing}
        />
        <CustomButton
          buttonStyles={styles.declineButton}
          textContent={t('settings.childAccounts.pairing.declineBTN')}
          actionFunction={handleQRDecline}
          textStyles={{ color: textColor }}
        />
      </GlobalThemeView>
    );
  }

  // Adding done to list to remove qr flicker when swtching from granting to
  // done
  const isPreparing =
    status === 'preparing' ||
    status === 'granting' ||
    status === 'idle' ||
    status === 'done';

  const downloadPrompt = (
    <View style={styles.downloadPrompt}>
      <ThemeText
        styles={styles.downloadHint}
        content={t('settings.childAccounts.pairing.noBlitz')}
      />
      <TouchableOpacity
        onPress={handleShareDownloadLink}
        style={[styles.downloadLink, { backgroundColor: backgroundOffset }]}
      >
        <ThemeText
          styles={styles.downloadLinkText}
          content={t('settings.childAccounts.pairing.downloadLink')}
        />
      </TouchableOpacity>
    </View>
  );

  const qrContent =
    isPreparing || !qrValue ? (
      <View style={styles.tabContent}>
        <FullLoadingScreen
          showText={false}
          text={t('settings.childAccounts.creating.loadingText')}
        />
      </View>
    ) : (
      <View style={styles.tabContent}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.pairing.qrTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.pairing.qrSubtitle')}
        />
        <View style={styles.qrWrap}>
          <QrCodeWrapper QRData={qrValue} />
        </View>
        {downloadPrompt}
      </View>
    );

  const codeContent = (
    <View style={styles.tabContent}>
      <ThemeText
        styles={styles.title}
        content={t('settings.childAccounts.pairing.usernameTitle')}
      />
      <ThemeText
        styles={styles.subtitle}
        content={t('settings.childAccounts.pairing.usernameSubtitle')}
      />
      <TouchableOpacity
        onPress={() => copyToClipboard(parentUniqueName, showToast)}
        style={[styles.card, { backgroundColor: backgroundOffset }]}
      >
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          styles={styles.usernameValue}
          content={parentUniqueName}
        />
      </TouchableOpacity>
      {downloadPrompt}
    </View>
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.childAccounts.pairing.title')}
        rightContent={<PairingExpiryClock />}
      />
      <View style={styles.toggleWrap}>
        <WordsQrToggle
          option1Text={t('settings.childAccounts.pairing.codeOption')}
          option2Text={t('settings.childAccounts.pairing.qrOption')}
          option1Value="code"
          option2Value="qr"
          setSelectedDisplayOption={setSelectedDisplayOption}
          selectedDisplayOption={selectedDisplayOption}
        />
      </View>
      <View style={styles.content}>
        {isQrTab ? (
          <Animated.View
            key="qr"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={StyleSheet.absoluteFill}
          >
            {qrContent}
          </Animated.View>
        ) : (
          <Animated.View
            key="code"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={StyleSheet.absoluteFill}
          >
            {codeContent}
          </Animated.View>
        )}
      </View>

      {!isQrTab && (
        <CustomButton
          buttonStyles={styles.button}
          textContent={t('settings.childAccounts.pairing.generateCode')}
          actionFunction={generateCode}
        />
      )}
    </GlobalThemeView>
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
  tabContent: {
    ...StyleSheet.absoluteFill,
    ...CENTER,
    alignItems: 'center',
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
  card: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  downloadPrompt: {
    alignItems: 'center',
    marginBottom: 20,
  },
  downloadHint: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    textAlign: 'center',
    marginBottom: 10,
  },
  downloadLink: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  downloadLinkText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    textAlign: 'center',
  },
  usernameValue: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
    textAlign: 'center',
  },
  qrWrap: {
    marginTop: 12,
    marginBottom: 16,
  },
  hint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
  },
  button: { width: INSET_WINDOW_WIDTH, ...CENTER, marginTop: 'auto' },
  declineButton: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    backgroundColor: 'transparent',
    marginTop: 12,
    marginBottom: 8,
  },
});
