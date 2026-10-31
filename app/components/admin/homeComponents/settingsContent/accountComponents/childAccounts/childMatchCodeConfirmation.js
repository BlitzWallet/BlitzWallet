import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { CENTER } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../../constants/theme';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useTheme } from '../../../../../../../context-store/theme';
import { SheetTitle } from '../../../savings/savingsSheetParts';

// "Are you sure?" gate (D270). Swiping down goes back to the pattern.
export default function ChildMatchCodeConfirmation({
  confirmMatch,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  useEffect(() => {
    setContentHeight?.(320);
  }, [setContentHeight]);

  const handleConfirmMatch = useCallback(async () => {
    try {
      confirmMatch();
      handleBackPressFunction();
    } catch (err) {
      console.log('err', err);
    }
  }, [confirmMatch, handleBackPressFunction]);

  return (
    <View style={styles.container}>
      <SheetTitle
        title={t('settings.childAccounts.pairing.areYouSure')}
        first={true}
      />
      <ThemeText
        styles={[styles.description, { color: tokens.muted }]}
        content={t('settings.childAccounts.pairing.confirmGate')}
      />
      <CustomButton
        buttonStyles={styles.button}
        textContent={t('settings.childAccounts.pairing.confirmBTN')}
        actionFunction={handleConfirmMatch}
        size={'regular'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  description: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    marginTop: 'auto',
  },
});
