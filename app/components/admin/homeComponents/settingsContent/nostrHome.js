import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function NostrHome() {
  const navitate = useNavigation();
  const { darkModeType, theme } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.itemRow,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}
      >
        <View style={styles.itemTextContainer}>
          <ThemeText
            styles={{ ...styles.itemHeader, marginBottom: 10 }}
            content={t('settings.nostrHome.nip5Title')}
          />
          <ThemeText
            styles={styles.itemDescription}
            content={t('settings.nostrHome.nip5Desc')}
          />
        </View>
        <TouchableOpacity
          onPress={() => navitate.navigate('Nip5VerificationPage')}
          style={{
            ...styles.clickContainer,
            backgroundColor: theme ? backgroundColor : COLORS.primary,
          }}
        >
          <ThemeIcon
            colorOverride={COLORS.darkModeText}
            iconName={'ChevronRight'}
          />
        </TouchableOpacity>
      </View>
      <View
        style={{
          ...styles.itemRow,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}
      >
        <View style={styles.itemTextContainer}>
          <View style={styles.itemHeaderContainer}>
            <ThemeText
              styles={styles.itemHeader}
              content={t('settings.nostrHome.nwcTitle')}
            />
            <ThemeText
              CustomNumberOfLines={1}
              styles={{
                ...styles.itemHeaderDesc,
                color:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              }}
              content={t('constants.experimentalLower')}
            />
          </View>
          <ThemeText
            styles={styles.itemDescription}
            content={t('settings.nostrHome.nwcDesc')}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            navitate.navigate('NosterWalletConnect');
          }}
          style={{
            ...styles.clickContainer,
            backgroundColor: theme ? backgroundColor : COLORS.primary,
          }}
        >
          <ThemeIcon
            colorOverride={COLORS.darkModeText}
            iconName={'ChevronRight'}
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
    includeFontPadding: false,
  },

  itemDescription: { fontSize: SIZES.small, includeFontPadding: false },
  clickContainer: {
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
