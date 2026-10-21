import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import CustomButton from '../button';

// 64 surface disc · title 17/24 · line · optional Retry (OQ-56).
export default function EmptyState({ icon, title, sub, onRetry }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={[styles.disc, { backgroundColor: tokens.surface }]}>
        <ThemeIcon
          redesign
          iconName={icon}
          size={26}
          colorOverride={tokens.muted}
        />
      </View>
      <ThemeText content={title} styles={styles.title} />
      {!!sub && (
        <ThemeText
          variant="body"
          content={sub}
          styles={[styles.sub, { color: tokens.muted }]}
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
  container: { alignItems: 'center', paddingHorizontal: 16 },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 16,
  },
  sub: { textAlign: 'center', marginTop: 6 },
  retry: { marginTop: 16 },
});
