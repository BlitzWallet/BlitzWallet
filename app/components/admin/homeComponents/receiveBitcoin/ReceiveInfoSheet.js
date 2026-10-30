import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { SheetTitle } from '../savings/savingsSheetParts';

// Explainer for a QR card row (Receive.dc.html "Network fee tapped"):
// the row label as the title, the full explanation as the body.
export default function ReceiveInfoSheet({
  title,
  body,
  setContentHeight,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  useEffect(() => {
    setContentHeight(Math.min(420, 190 + Math.ceil(body.length / 40) * 24));
  }, [body, setContentHeight]);

  return (
    <View style={styles.container}>
      <SheetTitle first title={title} />
      <ThemeText
        styles={[styles.body, { color: tokens.muted }]}
        content={body}
      />
      <CustomButton
        size="regular"
        buttonStyles={styles.button}
        actionFunction={() => handleBackPressFunction()}
        textContent={t('constants.iunderstand')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  button: { marginTop: 'auto' },
});
