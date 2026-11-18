import { StyleSheet, View } from 'react-native';
import PageTitle from './PageTitle';
import ThemeText from '../textTheme';
import { FONT, SIZES } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';

export default function PageHeader({
  title,
  titleStyles,
  sub,
  subStyles,
  showSub = true,
  // Page-level header (onboarding): 28/34 title, 15/22 muted sub.
  large = false,
}) {
  const { tokens } = useTheme();
  return (
    <View>
      <PageTitle
        text={title}
        titleStyles={{
          ...(large ? styles.titleLarge : styles.title),
          ...titleStyles,
        }}
      />
      {showSub && (
        <ThemeText
          content={sub}
          styles={[
            large
              ? [styles.subtitleLarge, { color: tokens.muted }]
              : styles.subtitle,
            subStyles,
          ].flat()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
    marginTop: 20,
    marginBottom: 8,
  },
  titleLarge: { marginTop: 28 },
  subtitleLarge: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
});
