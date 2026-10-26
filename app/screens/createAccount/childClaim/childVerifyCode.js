import { useCallback, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../functions/CustomElements/redesign/PageHeader';
import CustomButton from '../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../constants';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import ClaimLinkError from './claimLinkError';
import SasPatternGrid from '../../../components/admin/homeComponents/settingsContent/accountComponents/childAccounts/SasPatternGrid';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';

export default function ChildVerifyCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { status, sas, confirmMatch, isEnded, declineMatch } = useChildClaim();

  // Seed imported -> continue straight to PIN setup (no success screen).
  useEffect(() => {
    if (status === 'done') {
      navigate.navigate('PinSetup');
    }
  }, [status, navigate]);

  const handleNoMatch = useCallback(() => {
    declineMatch();
    navigate.popTo('ChildEnterCode');
    return true;
  }, [declineMatch, navigate]);

  useHandleBackPressNew(isEnded ? null : handleNoMatch);

  if (isEnded) return <ClaimLinkError />;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar onBack={handleNoMatch} />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <PageHeader
            large
            title={t('settings.childAccounts.claim.sasTitle')}
            sub={t('settings.childAccounts.claim.sasSubtitle')}
          />
          <View style={styles.grid}>
            <SasPatternGrid fill sas={sas} />
          </View>
          <ThemeText
            variant="hint"
            styles={styles.hint}
            content={t('settings.childAccounts.claim.sasHint')}
          />
        </CustomScrollView>
        <View style={styles.footer}>
          <CustomButton
            size="regular"
            useLoading={status === 'awaiting'}
            textContent={t('constants.confirm')}
            actionFunction={confirmMatch}
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
  grid: { marginTop: 28 },
  hint: {
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 4,
  },
  footer: { gap: 12, paddingTop: CONTENT_KEYBOARD_OFFSET },
});
