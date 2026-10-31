import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import { FONT } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import CustomButton from '../../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

// "Your code" sheet (CustomHalfModal 'viewSMSCode').
export default function ViewSmsReceiveCode({
  code,
  title,
  setContentHeight,
  handleBackPressFunction,
}) {
  const { showToast } = useToast();
  const { tokens } = GetThemeColors();
  const { t } = useTranslation();

  useEffect(() => {
    setContentHeight(400);
  }, [setContentHeight]);

  return (
    <View style={styles.container}>
      <ThemeText
        styles={[styles.label, { color: tokens.muted }]}
        content={
          title
            ? t('apps.sms4sats.viewSMSReceiveCode.headerFor', { title })
            : t('apps.sms4sats.viewSMSReceiveCode.header')
        }
      />
      <ThemeText
        adjustsFontSizeToFit={true}
        CustomNumberOfLines={1}
        styles={styles.code}
        content={code}
      />
      <CustomButton
        size="small"
        tone="secondary"
        icon="Copy"
        textContent={t('constants.copy')}
        actionFunction={() => copyToClipboard(code, showToast)}
      />
      <View style={styles.warning}>
        <ThemeIcon
          redesign
          iconName="ShieldAlert"
          size={18}
          colorOverride={tokens.muted}
        />
        <ThemeText
          styles={[styles.warningText, { color: tokens.muted }]}
          content={t('apps.sms4sats.viewSMSReceiveCode.dontShare')}
        />
      </View>
      <CustomButton
        buttonStyles={styles.done}
        size="regular"
        textContent={t('constants.done')}
        actionFunction={handleBackPressFunction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  label: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  code: {
    fontFamily: FONT.Title_Medium,
    fontSize: 44,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    marginVertical: 12,
    includeFontPadding: false,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
    includeFontPadding: false,
  },
  done: {
    width: '100%',
    marginTop: 'auto',
  },
});
