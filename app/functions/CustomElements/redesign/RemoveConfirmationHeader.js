import { StyleSheet, View } from 'react-native';
import ThemeText from '../textTheme';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import Disc from './Disc';

// Full-page remove confirmation header, shared by Remove account, Remove goal
// and Delete wallet: 56 danger disc, 16 to a 28/34 title, 8 to 15/22 muted body.
export default function RemoveConfirmationHeader({ title, description }) {
  const { tokens } = useTheme();
  return (
    <View>
      <Disc icon="Trash2" tone="danger" size={56} iconSize={24} />
      <ThemeText
        styles={[styles.title, { color: tokens.ink }]}
        content={title}
      />
      {!!description && (
        <ThemeText
          variant="body"
          styles={[styles.description, { color: tokens.muted }]}
          content={description}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
    marginTop: 16,
  },
  description: {
    marginTop: 8,
  },
});
