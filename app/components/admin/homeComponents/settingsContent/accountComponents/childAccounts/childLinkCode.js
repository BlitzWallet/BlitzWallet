import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import QrCard from '../../../../../../functions/CustomElements/redesign/QrCard';
import Disc from '../../../../../../functions/CustomElements/redesign/Disc';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { useTheme } from '../../../../../../../context-store/theme';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';
import PairingExpiryClock from './pairingExpiryClock';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import { copyToClipboard } from '../../../../../../functions';
import { share } from '../../../../../../functions/handleShare';
import { useToast } from '../../../../../../../context-store/toastManager';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import Segmented from '../../../../../../functions/CustomElements/redesign/Segmented';
import PageHeader from '../../../../../../functions/CustomElements/redesign/PageHeader';

export default function ChildLinkCode(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
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
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

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
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar
            title={t('settings.childAccounts.pairing.title')}
            onBack={handleQRDecline}
            right={<PairingExpiryClock />}
          />
          <PageHeader
            title={t('settings.childAccounts.pairing.acceptTitle')}
            sub={t('settings.childAccounts.pairing.acceptSubtitle', {
              name: reshareChild?.name ?? '',
            })}
          />

          <View style={styles.buttonContainer}>
            <CustomButton
              textContent={t('settings.childAccounts.pairing.acceptBTN')}
              actionFunction={acceptPairing}
              size={'regular'}
            />
            <CustomButton
              textContent={t('settings.childAccounts.pairing.declineBTN')}
              actionFunction={handleQRDecline}
              tone={'secondary'}
            />
          </View>
        </View>
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
        styles={[styles.downloadHint, { color: tokens.muted }]}
        content={t('settings.childAccounts.pairing.noBlitz')}
      />
      <TouchableOpacity
        onPress={handleShareDownloadLink}
        accessibilityRole="button"
        style={[styles.downloadLink, { backgroundColor: tokens.surface }]}
      >
        <ThemeIcon redesign iconName="Share2" size={14} />
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
        <PageHeader
          title={t('settings.childAccounts.pairing.qrTitle')}
          sub={t('settings.childAccounts.pairing.qrSubtitle')}
        />
        <QrCard
          value={qrValue}
          size={180}
          badge={<Disc icon={'Zap'} tone="primary" size={40} />}
          style={styles.qrWrap}
        />
        {downloadPrompt}
      </View>
    );

  const codeContent = (
    <View style={styles.tabContent}>
      <PageHeader
        title={t('settings.childAccounts.pairing.usernameTitle')}
        sub={t('settings.childAccounts.pairing.usernameSubtitle')}
      />
      <TouchableOpacity
        onPress={() => copyToClipboard(parentUniqueName, showToast)}
        accessibilityRole="button"
        accessibilityLabel={t('constants.copy')}
        style={[styles.card, { backgroundColor: tokens.surface }]}
      >
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          styles={styles.usernameValue}
          content={parentUniqueName}
        />
        <ThemeIcon
          redesign
          iconName="Copy"
          size={18}
          colorOverride={tokens.muted}
        />
      </TouchableOpacity>
      {downloadPrompt}
    </View>
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.childAccounts.pairing.title')}
          right={<PairingExpiryClock />}
        />
        <View style={styles.toggleWrap}>
          <Segmented
            fit
            capitalizeLabels={false}
            options={[
              {
                value: 'code',
                label: t('settings.childAccounts.pairing.codeOption'),
              },
              {
                value: 'qr',
                label: t('settings.childAccounts.pairing.qrOption'),
              },
            ]}
            value={selectedDisplayOption}
            onChange={setSelectedDisplayOption}
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
            textContent={t('settings.childAccounts.pairing.generateCode')}
            actionFunction={generateCode}
            size={'regular'}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  buttonContainer: {
    marginTop: 'auto',
    gap: 10,
  },
  toggleWrap: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    minHeight: 56,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadPrompt: {
    alignItems: 'center',
  },
  downloadHint: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: 'center',
    marginBottom: 8,
  },
  downloadLink: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadLinkText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  usernameValue: {
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
    flexShrink: 1,
  },
  qrWrap: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
});
