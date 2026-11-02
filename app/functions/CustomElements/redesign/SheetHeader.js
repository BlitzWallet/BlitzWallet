import { StyleSheet, View } from 'react-native';
import ThemeText from '../textTheme';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';

// Half modal title block: 20/26 Medium title, optional 15/22 muted sub, 16 to
// the first content block. Sets no width: the shell owns the 20 gutter.
// Top margin: `first` = 20 under the grab handle, `afterIcon` = 16 under a
// Disc, neither = 4 under a TopBar or back button.
export default function SheetHeader({
  title,
  sub,
  first = false,
  afterIcon = false,
  centered = false,
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.container,
        first && styles.first,
        afterIcon && styles.afterIcon,
      ]}
    >
      <ThemeText
        styles={[styles.title, centered && styles.centered]}
        content={title}
      />
      {!!sub && (
        <ThemeText
          variant={'body'}
          styles={[
            styles.sub,
            { color: tokens.muted },
            centered && styles.centered,
          ]}
          content={sub}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 16 },
  first: { marginTop: 20 },
  afterIcon: { marginTop: 16 },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  sub: { marginTop: 4 },
  centered: { textAlign: 'center' },
});
