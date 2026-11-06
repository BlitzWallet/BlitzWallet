import { Children, createContext, Fragment, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import { useInSheet } from './sheetSurface';

const ListToneContext = createContext({ tone: 'grouped' });

// grouped: r20 card, padding 0 16; white on the page, ground inside a sheet.
// flush: no card, rows on the surface, dividers inset 52 (SHARED_FINDINGS C4).
// Dividers go between direct children; inside a FlatList pass
// ItemSeparatorComponent={ListDivider} so the list stays virtualised.
export default function ListCard({
  tone = 'grouped',
  dividerInset,
  children,
  style,
  forceSheetColor,
}) {
  const { tokens } = useTheme();
  const inSheet = useInSheet();
  const items = Children.toArray(children);
  return (
    <ListToneContext.Provider value={{ tone, dividerInset }}>
      <View
        style={[
          tone === 'grouped' && [
            styles.grouped,
            {
              backgroundColor:
                inSheet || forceSheetColor ? tokens.ground : tokens.surface,
            },
          ],
          style,
        ]}
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

export function ListDivider({ inset }) {
  const { tokens } = useTheme();
  const context = useContext(ListToneContext);
  const tone = context?.tone || 'grouped';
  const rawInset = inset ?? context?.dividerInset;
  // The inset is measured from the card edge; grouped cards already add 16
  // horizontal padding, so subtract it here (flush cards have no padding).
  const insetValue =
    tone === 'flush' ? rawInset ?? 52 : Math.max(0, (rawInset ?? 0) - 16);
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: tokens.divider,
          marginLeft: insetValue,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  grouped: { borderRadius: 20, paddingHorizontal: 16, overflow: 'hidden' },
  divider: { height: 1 },
});
