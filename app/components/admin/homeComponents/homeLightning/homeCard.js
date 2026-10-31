import { StyleSheet } from 'react-native';
import { FONT } from '../../../../constants';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

// Home's single-row cards: backup, connection error, tokens.
export default function HomeCard({ lead, title, sub, trailing, onPress }) {
  return (
    <ListCard style={styles.card}>
      <ListRow
        onPress={onPress}
        lead={lead}
        title={title}
        sub={sub}
        trailing={trailing}
        showChevron={!trailing}
        chevronSize={18}
        minHeight={44}
        paddingVertical={0}
        titleStyle={styles.title}
        subStyle={styles.sub}
      />
    </ListCard>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 14, paddingVertical: 14 },
  title: {
    fontSize: 15,
  },
  sub: { fontSize: 13, includeFontPadding: false },
});
