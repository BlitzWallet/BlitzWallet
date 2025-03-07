import {View, StyleSheet, Platform, TextInput} from 'react-native';
import {COLORS, FONT, SIZES} from '../../constants';
import {ThemeText} from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';

export function KeyContainer(props) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  let groupedKeys = [];
  let tempArr = [];

  props.keys.forEach((element, id) => {
    tempArr.push([element, id + 1]);
    if (tempArr.length == 2) {
      groupedKeys.push(tempArr);
      tempArr = [];
    }
  });

  const keyElements = groupedKeys.map((keys, id) => {
    return (
      <View style={styles.row} key={id}>
        <View
          key={keys[0][0]}
          style={{
            ...styles.seedItem,
            paddingVertical: Platform.OS === 'ios' ? 10 : 0,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          }}>
          <ThemeText
            styles={{...styles.numberText}}
            content={`${keys[0][1]}.`}
          />

          <TextInput
            readOnly={true}
            value={keys[0][0]}
            cursorColor={COLORS.lightModeText}
            style={{
              ...styles.textInputStyle,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}
          />
        </View>
        <View
          key={keys[1][0]}
          style={{
            ...styles.seedItem,
            paddingVertical: Platform.OS === 'ios' ? 10 : 0,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          }}>
          <ThemeText
            styles={{...styles.numberText}}
            content={`${keys[1][1]}.`}
          />

          <TextInput
            readOnly={true}
            value={keys[1][0]}
            cursorColor={COLORS.lightModeText}
            style={{
              ...styles.textInputStyle,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}
          />
        </View>
      </View>
    );
  });

  return keyElements;
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginBottom: 10,
  },
  key: {
    width: '48%',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 10,
    borderRadius: 8,
  },

  seedItem: {
    width: '48%',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 10,
    borderRadius: 8,
  },
  numberText: {
    fontSize: SIZES.large,
    marginRight: 10,
    includeFontPadding: false,
  },
  textInputStyle: {
    width: '90%',
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
});
