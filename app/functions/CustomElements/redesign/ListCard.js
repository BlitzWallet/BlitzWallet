import { Children, createContext, Fragment, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import { useInSheet } from './sheetSurface';

const ListToneContext = createContext('grouped');

// grouped: r20 card, padding 0 16; white on the page, ground inside a sheet.
// flush: no card, rows on the surface, dividers inset 52 (SHARED_FINDINGS C4).
// Dividers go between direct children; inside a FlatList pass
// ItemSeparatorComponent={ListDivider} so the list stays virtualised.
export default function ListCard({ tone = 'grouped', children }) {
  const { tokens } = useTheme();
  const inSheet = useInSheet();
  const items = Children.toArray(children);
  return (
    <ListToneContext.Provider value={tone}>
      <View
        style={
          tone === 'grouped' && [
            styles.grouped,
            { backgroundColor: inSheet ? tokens.ground : tokens.surface },
          ]
        }
      >
        {items.map((child, index) => (
          <Fragment key={child.key}>
            {index > 0 && <ListDivider />}
            {child}
          </Fragment>
        ))}
      </View>
    </ListToneContext.Provider>
  );
}

export function ListDivider() {
  const { tokens } = useTheme();
  const tone = useContext(ListToneContext);
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: tokens.divider,
          marginLeft: tone === 'flush' ? 52 : 0,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  grouped: { borderRadius: 20, paddingHorizontal: 16, overflow: 'hidden' },
  divider: { height: 1 },
});
