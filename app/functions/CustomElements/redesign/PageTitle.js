import { StyleSheet } from 'react-native';
import ThemeText from '../textTheme';
import { FONT, TYPE } from '../../../constants';
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
    ...TYPE.pageTitle,
    letterSpacing: -0.56,
    includeFontPadding: false,
  },
});
