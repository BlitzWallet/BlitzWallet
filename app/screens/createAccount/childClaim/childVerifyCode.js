import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../constants/theme';
import GetThemeColors from '../../../hooks/themeColors';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import ClaimLinkError from './claimLinkError';
import SasPatternGrid from '../../../components/admin/homeComponents/settingsContent/accountComponents/childAccounts/SasPatternGrid';
import { useAppStatus } from '../../../../context-store/appStatus';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';

export default function ChildVerifyCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { textColor } = GetThemeColors();
  const { status, sas, confirmMatch, isEnded, declineMatch } = useChildClaim();
  const { screenDimensions } = useAppStatus();

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
      <CustomSettingsTopBar
        label={t('settings.childAccounts.claim.sasNavTitle')}
        customBackFunction={handleNoMatch}
      />

      <ScrollView style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.claim.sasTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.claim.sasSubtitle')}
        />
        <SasPatternGrid
          cellSize={Math.round((screenDimensions?.width * 0.75) / 3) - 15}
          sas={sas}
        />
        <ThemeText
          styles={styles.hint}
          content={t('settings.childAccounts.claim.sasHint')}
        />
      </ScrollView>
      <CustomButton
        buttonStyles={styles.button}
        useLoading={status === 'awaiting'}
        textContent={t('constants.confirm')}
        actionFunction={confirmMatch}
      />
      <CustomButton
        buttonStyles={[styles.button, { backgroundColor: 'transparent' }]}
        textStyles={{ color: textColor }}
        textContent={t('settings.childAccounts.dontMatch')}
        actionFunction={handleNoMatch}
      />
    </GlobalThemeView>
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
  hint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
  },
  message: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 20,
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
