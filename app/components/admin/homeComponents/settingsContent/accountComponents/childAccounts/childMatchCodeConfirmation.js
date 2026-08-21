import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { CENTER, FONT, SIZES } from '../../../../../../constants';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../../constants/theme';
import CustomButton from '../../../../../../functions/CustomElements/button';

export default function ChildMatchCodeConfirmation({
  confirmMatch,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();

  const handleConfirmMatch = useCallback(async () => {
    try {
      confirmMatch();
      handleBackPressFunction();
    } catch (err) {
      console.log('err', err);
    }
  }, [confirmMatch]);

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('settings.childAccounts.pairing.areYouSure')}
      />

      <ThemeText
        styles={styles.description}
        content={t('settings.childAccounts.pairing.confirmGate')}
      />

      <View style={styles.buttonContainer}>
        <CustomButton
          buttonStyles={styles.closeButton}
          textContent={t('settings.childAccounts.pairing.confirmBTN')}
          actionFunction={handleConfirmMatch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    marginBottom: 12,
  },
  description: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 'auto',
  },
  closeButton: {
    ...CENTER,
  },
  cancelButton: {
    width: '100%',
    opacity: 0.6,
  },
});
