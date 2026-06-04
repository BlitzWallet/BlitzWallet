import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { CENTER, ICONS } from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';

const SWAP_OPTIONS = [
  {
    id: 'liquid',
    icon: 'blockstreamLiquid',
    label: 'settings.viewSwapsHome.liquid',
  },
  {
    id: 'rootstock',
    icon: 'rootstockLogo',
    label: 'settings.viewSwapsHome.rootstock',
  },
];

export default function SelectSwapNetworkHalfModal({
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor } = GetThemeColors();

  const selectNetwork = swapType => {
    handleBackPressFunction(() =>
      navigate.replace('SettingsContentHome', {
        for: 'ViewAllSwaps',
        swapType,
      }),
    );
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large }}
        content={t('settings.viewSwapsHome.selectionTitle')}
      />

      {SWAP_OPTIONS.map(option => (
        <TouchableOpacity
          key={option.id}
          onPress={() => selectNetwork(option.id)}
          style={styles.containerRow}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : COLORS.primary,
              },
            ]}
          >
            <Image
              style={styles.logo}
              source={ICONS[option.icon]}
              contentFit="contain"
            />
          </View>
          <View style={styles.textContainer}>
            <ThemeText styles={styles.optionTitle} content={t(option.label)} />
          </View>
          <View style={styles.chevron}>
            <ThemeIcon iconName="ChevronRight" size={18} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    gap: 15,
  },
  containerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    marginVertical: 5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 25,
    height: 25,
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 15,
  },
  optionTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  chevron: {
    opacity: 0.5,
  },
});
