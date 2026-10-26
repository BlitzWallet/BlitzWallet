import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import CustomButton from '../button';

// 64 surface disc · title 17/24 (or 20/26 with size="large") · line · optional
// Retry (OQ-56). `iconTone="ink"` matches the D305/D306 empty states.
export default function EmptyState({
  icon,
  title,
  sub,
  onRetry,
  size = 'default',
  iconTone = 'muted',
  retryText = '',
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const large = size === 'large';
  const isMuted = iconTone === 'muted';
  const isDanger = iconTone === 'danger';
  const iconColor = isMuted
    ? tokens.muted
    : isDanger
    ? tokens.danger
    : tokens.ink;

  const background = isDanger ? tokens.dangerBg : tokens.surface;
  return (
    <View style={styles.container}>
      <View style={[styles.disc, { backgroundColor: background }]}>
        <ThemeIcon
          redesign
          iconName={icon}
          size={26}
          colorOverride={iconColor}
        />
      </View>
      <ThemeText
        content={title}
        styles={[
          styles.title,
          large && styles.titleLarge,
          { color: tokens.ink },
        ]}
      />
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
          textContent={retryText || t('constants.retry')}
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
  titleLarge: {
    fontSize: 20,
    lineHeight: 26,
  },
  sub: { textAlign: 'center', marginTop: 6 },
  retry: { marginTop: 16 },
});
