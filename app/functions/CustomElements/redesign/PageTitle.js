import { StyleSheet } from 'react-native';
import ThemeText from '../textTheme';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';

export default function PageTitle({ text = '', titleStyles = {} }) {
  const { tokens } = useTheme();
  return (
    <ThemeText
      styles={[styles.title, { color: tokens.ink }, titleStyles]}
      content={text}
    />
  );
}
const styles = StyleSheet.create({
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
  },
});
