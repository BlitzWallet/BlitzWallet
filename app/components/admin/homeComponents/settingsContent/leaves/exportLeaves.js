import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';

// Opens the export flow in a half modal so the (slow) leaf snapshot and exit-node
// fetch can surface simple per-phase progress messages. The full export logic
// and bundle schema live in exportLeavesProgress.js.
export default function ExportLeaves({ onExported }) {
  const { t } = useTranslation();
  const navigate = useNavigation();

  const handleExport = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'exportLeavesProgress',
      onExported,
      sliderHight: 0.4,
    });
  }, [navigate, onExported]);

  return (
    <View style={styles.container}>
      <CustomButton
        actionFunction={handleExport}
        textContent={t('screens.inAccount.walletLeaves.exportButton')}
        buttonStyles={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  button: {
    width: '100%',
  },
  note: {
    fontSize: SIZES.small,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 10,
    includeFontPadding: false,
  },
});
