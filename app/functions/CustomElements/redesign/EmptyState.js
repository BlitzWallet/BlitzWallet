import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import CustomButton from '../button';

// 64 disc · title 17/24 · line · optional Retry (OQ-56).
export default function EmptyState({ icon, title, sub, onRetry }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={[styles.disc, { backgroundColor: tokens.disc }]}>
        <ThemeIcon redesign iconName={icon} size={28} />
      </View>
      <ThemeText content={title} styles={styles.title} />
      {!!sub && (
        <ThemeText
          variant="body"
          content={sub}
          styles={{ color: tokens.muted, textAlign: 'center' }}
        />
      )}
      {onRetry && (
        <CustomButton
          size="fit"
          textContent={t('constants.retry')}
          actionFunction={onRetry}
          buttonStyles={styles.retry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  retry: { marginTop: 16 },
});
