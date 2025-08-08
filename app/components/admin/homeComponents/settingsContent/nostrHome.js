import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import {CENTER, ICONS} from '../../../../constants';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNavigation} from '@react-navigation/native';

export default function NostrHome() {
  const navitate = useNavigation();
  const {darkModeType, theme} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.itemRow,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}>
        <View style={styles.itemTextContainer}>
          <ThemeText
            styles={{...styles.itemHeader, marginBottom: 10}}
            content={'Nip5 Verification'}
          />
          <ThemeText
            styles={styles.itemDescription}
            content={'Quickly verify your Nostr identity using Blitz.'}
          />
        </View>
        <TouchableOpacity
          onPress={() => navitate.navigate('Nip5VerificationPage')}
          style={{
            ...styles.clickContainer,
            backgroundColor: theme ? backgroundColor : COLORS.primary,
          }}>
          <ThemeImage
            styles={{transform: [{rotate: '180deg'}]}}
            lightModeIcon={ICONS.leftCheveronLight}
            darkModeIcon={ICONS.leftCheveronLight}
            lightsOutIcon={ICONS.leftCheveronLight}
          />
        </TouchableOpacity>
      </View>
      <View
        style={{
          ...styles.itemRow,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}>
        <View style={styles.itemTextContainer}>
          <View style={styles.itemHeaderContainer}>
            <ThemeText
              styles={styles.itemHeader}
              content={'Nostr Wallet Connect'}
            />
            <ThemeText
              CustomNumberOfLines={1}
              styles={{
                ...styles.itemHeaderDesc,
                color:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              }}
              content={'experimental'}
            />
          </View>
          <ThemeText
            styles={styles.itemDescription}
            content={'Connect your Blitz Wallet to apps using Nostr.'}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            navitate.navigate('NosterWalletConnect');
          }}
          style={{
            ...styles.clickContainer,
            backgroundColor: theme ? backgroundColor : COLORS.primary,
          }}>
          <ThemeImage
            styles={{transform: [{rotate: '180deg'}]}}
            lightModeIcon={ICONS.leftCheveronLight}
            darkModeIcon={ICONS.leftCheveronLight}
            lightsOutIcon={ICONS.leftCheveronLight}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  itemRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  itemTextContainer: {
    flexShrink: 1,
    marginRight: 15,
  },
  itemHeaderContainer: {
    width: '100%',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemHeader: {
    includeFontPadding: false,
  },
  itemHeaderDesc: {
    flexShrink: 1,
    fontSize: SIZES.small,
    marginLeft: 5,
  },

  itemDescription: {fontSize: SIZES.small, includeFontPadding: false},
  clickContainer: {
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
