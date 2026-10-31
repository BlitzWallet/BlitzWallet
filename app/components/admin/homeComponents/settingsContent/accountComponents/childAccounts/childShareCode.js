import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { useTheme } from '../../../../../../../context-store/theme';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';
import PairingExpiryClock from './pairingExpiryClock';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../../functions/CustomElements/redesign/PageHeader';

export default function ChildShareCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { status, pairingCode, isEnded, resetSession } = useChildPairing();

  // Child joined and the SAS is ready -> move to the verify screen.
  useEffect(() => {
    if (status === 'confirm') {
      navigate.navigate('ChildMatchCode');
    }
  }, [status, navigate]);

  const firstHalf = pairingCode?.slice(0, 3);
  const secondHalf = pairingCode?.slice(3);

  const handleGoBack = useCallback(() => {
    resetSession();
    navigate.goBack();
    return true;
  }, [resetSession, navigate]);

  useHandleBackPressNew(isEnded ? null : handleGoBack);

  if (isEnded) {
    return <ChildLinkError />;
  }
  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.childAccounts.pairing.codeNavTitle')}
          onBack={handleGoBack}
          right={status === 'preparing' ? null : <PairingExpiryClock />}
        />
        {status === 'preparing' ? (
          <FullLoadingScreen showText={false} />
        ) : (
          <View style={styles.content}>
            <PageHeader
              title={t('settings.childAccounts.pairing.codeTitle')}
              sub={t('settings.childAccounts.pairing.codeSubtitle')}
            />
            <View style={[styles.card, { backgroundColor: tokens.surface }]}>
              <ThemeText
                CustomNumberOfLines={1}
                adjustsFontSizeToFit={true}
                styles={styles.codeValue}
                content={firstHalf + ' ' + secondHalf}
              />
            </View>
            <View style={styles.waiting}>
              <ActivityIndicator size="small" color={tokens.muted} />
              <ThemeText
                styles={[styles.hint, { color: tokens.muted }]}
                content={t('settings.childAccounts.pairing.waiting')}
              />
            </View>
          </View>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  content: { flex: 1 },
  card: {
    minHeight: 72,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeValue: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 1,
    includeFontPadding: false,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
