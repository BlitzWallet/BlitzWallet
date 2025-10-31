import { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ICONS, SIZES } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import LiquidSwapsPage from './swapsComponents/liquidSwapsPage';
import RoostockSwapsPage from './swapsComponents/rootstockSwaps';
import BitcoinSwapsPage from './swapsComponents/onchainSwapsPage';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function ViewSwapsHome() {
  const [selectedPage, setSelectedPage] = useState(null);
  const { t } = useTranslation();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();

  if (!selectedPage) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar label={t('settings.viewSwapsHome.swaps')} />

        <View style={styles.container1}>
          <View style={styles.headerContainer1}>
            <ThemeText
              content={t('settings.viewSwapsHome.selectionTitle')}
              styles={styles.headerText1}
            />
          </View>

          <View style={styles.optionsContainer1}>
            {/* Bitcoin Option */}
            <TouchableOpacity
              onPress={() => setSelectedPage('bitcoin')}
              style={[
                styles.optionCard1,
                {
                  borderColor: backgroundOffset,
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent1}>
                <ThemeText
                  content={t('settings.viewSwapsHome.bitcoin')}
                  styles={styles.optionTitle1}
                />
              </View>
              <View style={styles.arrow1}>
                <ThemeImage
                  styles={{ transform: [{ rotate: '180deg' }] }}
                  lightModeIcon={ICONS.leftCheveronIcon}
                  darkModeIcon={ICONS.leftCheveronIcon}
                  lightsOutIcon={ICONS.leftCheveronLight}
                />
              </View>
            </TouchableOpacity>
            {/* Liquid Option */}
            <TouchableOpacity
              onPress={() => setSelectedPage('liquid')}
              style={[
                styles.optionCard1,
                {
                  borderColor: backgroundOffset,
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent1}>
                <ThemeText
                  content={t('settings.viewSwapsHome.liquid')}
                  styles={styles.optionTitle1}
                />
              </View>
              <View style={styles.arrow1}>
                <ThemeImage
                  styles={{ transform: [{ rotate: '180deg' }] }}
                  lightModeIcon={ICONS.leftCheveronIcon}
                  darkModeIcon={ICONS.leftCheveronIcon}
                  lightsOutIcon={ICONS.leftCheveronLight}
                />
              </View>
            </TouchableOpacity>

            {/* Rootstock Option */}
            <TouchableOpacity
              onPress={() => setSelectedPage('rootstock')}
              style={[
                styles.optionCard1,
                {
                  borderColor: backgroundOffset,
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent1}>
                <ThemeText
                  content={t('settings.viewSwapsHome.rootstock')}
                  styles={styles.optionTitle1}
                />
              </View>
              <View style={styles.arrow1}>
                <ThemeImage
                  styles={{ transform: [{ rotate: '180deg' }] }}
                  lightModeIcon={ICONS.leftCheveronIcon}
                  darkModeIcon={ICONS.leftCheveronIcon}
                  lightsOutIcon={ICONS.leftCheveronLight}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={
          selectedPage === 'liquid'
            ? t('settings.viewSwapsHome.liquid')
            : selectedPage === 'roostock'
            ? t('settings.viewSwapsHome.rootstock')
            : t('settings.viewSwapsHome.bitcoin')
        }
        customBackFunction={() => setSelectedPage(null)}
      />
      {selectedPage === 'liquid' ? (
        <LiquidSwapsPage />
      ) : selectedPage === 'rootstock' ? (
        <RoostockSwapsPage />
      ) : (
        <BitcoinSwapsPage />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  // Style Toggle
  styleToggle: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    marginVertical: 10,
  },
  toggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  container1: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.medium,
  },
  headerContainer1: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerText1: {
    fontSize: SIZES.large,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  optionsContainer1: {
    gap: SIZES.medium,
  },
  optionCard1: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.large,
    paddingHorizontal: SIZES.medium,

    borderRadius: 16,
    borderWidth: 2,
  },

  cardContent1: {
    flex: 1,
  },
  optionTitle1: {
    fontSize: SIZES.large,
  },
  arrow1: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText1: {
    fontSize: 16,
    fontWeight: '600',
  },
});
