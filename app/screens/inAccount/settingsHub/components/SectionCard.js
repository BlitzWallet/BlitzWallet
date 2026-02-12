import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { SIZES } from '../../../../constants';

export default function SectionCard({ title, children }) {
  const { backgroundOffset } = GetThemeColors();

  return (
    <View style={styles.wrapper}>
      {title ? <ThemeText styles={styles.title} content={title} /> : null}
      <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  title: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.5,
    marginBottom: 8,
    marginLeft: 4,
    includeFontPadding: false,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
