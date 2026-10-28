import { useCallback, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../../functions/CustomElements/redesign/PageHeader';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../../constants';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';
import PairingExpiryClock from './pairingExpiryClock';
import SasPatternGrid from './SasPatternGrid';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';

export default function ChildMatchCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { status, sas, confirmMatch, isEnded, declineMatch } =
    useChildPairing();

  // Grant delivered -> show the success screen.
  useEffect(() => {
    if (status === 'done') {
      navigate.navigate('ChildLinkSuccess');
    }
  }, [status, navigate]);

  // The confirm gate is a root-level modal (CustomHalfModal) mounted outside
  // ChildPairingProvider, so it has no idea the session ended. When the child
  // declines (or the TTL expires) while the modal is open, the session lands on
  // a terminal state beneath it — pop the modal so the rejection/expiry screen
  // is revealed and the stale Match button disappears. Guarded to only pop when
  // the modal really is the top route.
  useEffect(() => {
    if (!isEnded) return;
    const root = navigate.getParent()?.getState();
    const top = root?.routes?.[root.index];
    if (top?.name === 'CustomHalfModal') navigate.getParent()?.goBack();
  }, [isEnded, navigate]);

  const handleConfirm = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'childMatchCodeConfirmation',
      confirmMatch,
    });
  };
  const handleNoMatch = useCallback(() => {
    declineMatch();
    navigate.popTo('EditAccountPage', undefined, { merge: true });
    return true;
  }, [declineMatch, navigate]);

  useHandleBackPressNew(isEnded ? null : handleNoMatch);

  if (isEnded) {
    return <ChildLinkError />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.childAccounts.pairing.sasNavTitle')}
          onBack={handleNoMatch}
          right={<PairingExpiryClock />}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <PageHeader
            title={t('settings.childAccounts.pairing.sasTitle')}
            sub={t('settings.childAccounts.pairing.sasSubtitle')}
          />
          <View style={styles.grid}>
            <SasPatternGrid fill sas={sas} />
          </View>
          <ThemeText
            variant="hint"
            styles={styles.hint}
            content={t('settings.childAccounts.pairing.sasHint')}
          />
        </CustomScrollView>
        <View style={styles.footer}>
          <CustomButton
            size="regular"
            useLoading={status === 'granting'}
            textContent={t('constants.confirm')}
            actionFunction={handleConfirm}
          />
          <CustomButton
            size="regular"
            tone="secondary"
            textContent={t('settings.childAccounts.dontMatch')}
            actionFunction={handleNoMatch}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  contentContainer: { flexGrow: 1, paddingBottom: 20 },
  grid: { marginTop: 20 },
  hint: {
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 4,
  },
  footer: { gap: 12, paddingTop: CONTENT_KEYBOARD_OFFSET },
});
