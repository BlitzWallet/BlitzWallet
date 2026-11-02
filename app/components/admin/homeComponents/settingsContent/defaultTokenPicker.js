import { StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';

export default function DefaultTokenPicker({
  options = [],
  selected,
  handleBackPressFunction,
}) {
  const { toggleMasterInfoObject } = useGlobalContextProvider();

  return (
    // Sheet shell is still today's ground until the P2 halfModal restyle, so no
    // white body and no SheetSurface (cards stay white on the ground shell).
    <View style={styles.container}>
      <ListCard dividerInset={0} style={styles.card}>
        {options.map(option => (
          <PickRow
            key={option.value}
            title={option.label}
            minHeight={52}
            titleStyle={styles.rowTitle}
            selected={option.value?.toLowerCase() === selected?.toLowerCase()}
            onPress={() => {
              toggleMasterInfoObject({ defaultSpendToken: option.value });
              handleBackPressFunction?.();
            }}
          />
        ))}
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 24, marginTop: 20 },
  card: { marginTop: 4 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
