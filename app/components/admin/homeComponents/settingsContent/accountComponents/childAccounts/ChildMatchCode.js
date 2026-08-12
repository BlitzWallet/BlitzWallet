import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';
import PairingExpiryClock from './pairingExpiryClock';
import SasPatternGrid from './SasPatternGrid';
import { useAppStatus } from '../../../../../../../context-store/appStatus';

export default function ChildMatchCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { textColor } = GetThemeColors();
  const { screenDimensions } = useAppStatus();
  const [isResetting, setIsResetting] = useState(false);
  const { status, sas, confirmMatch, isEnded, declineMatch } =
    useChildPairing();

  // Grant delivered -> show the success screen.
  useEffect(() => {
    if (status === 'done') {
      navigate.navigate('ChildLinkSuccess');
    }
  }, [status, navigate]);

  const handleConfirm = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'childMatchCodeConfirmation',
      confirmMatch,
    });
  };
  const handleNoMatch = async () => {
    setIsResetting(true);
    await declineMatch();
    setIsResetting(false);
    navigate.popTo('SettingsContentHome', {
      for: 'Accounts',
      initialTab: 'linked',
    });
  };

  if (isEnded) {
    return <ChildLinkError />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.childAccounts.pairing.sasTitle')}
        rightContent={<PairingExpiryClock />}
      />
      <ScrollView style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.pairing.sasTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.pairing.sasSubtitle')}
        />
        <SasPatternGrid
          cellSize={Math.round((screenDimensions?.width * 0.75) / 3) - 15}
          sas={sas}
        />
        <ThemeText
          styles={styles.hint}
          content={t('settings.childAccounts.pairing.sasHint')}
        />
      </ScrollView>
      <CustomButton
        buttonStyles={styles.button}
        useLoading={status === 'granting'}
        textContent={t('constants.confirm')}
        actionFunction={handleConfirm}
      />
      <CustomButton
        buttonStyles={[styles.button, { backgroundColor: 'transparent' }]}
        useLoading={isResetting}
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
