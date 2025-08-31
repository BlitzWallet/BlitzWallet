import {useState} from 'react';
import {StyleSheet, View, TouchableOpacity} from 'react-native';
import {ICONS, SIZES} from '../../../../constants';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useTranslation} from 'react-i18next';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import LiquidSwapsPage from './swapsComponents/liquidSwapsPage';
import RoostockSwapsPage from './swapsComponents/rootstockSwaps';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useGlobalThemeContext} from '../../../../../context-store/theme';

export default function ViewSwapsHome() {
  const [selectedPage, setSelectedPage] = useState(null);
  const {t} = useTranslation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

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
              activeOpacity={0.7}>
              <View
                style={[
                  styles.gradientCircle,
                  {
                    backgroundColor:
                      theme && darkModeType ? backgroundColor : '#4285F4',
                  },
                ]}>
                <View style={styles.iconPlaceholder1}>
                  <ThemeText
                    content={t('settings.viewSwapsHome.liquid')[0]}
                    styles={styles.iconText1}
                  />
                </View>
              </View>
              <View style={styles.cardContent1}>
                <ThemeText
                  content={t('settings.viewSwapsHome.liquid')}
                  styles={styles.optionTitle1}
                />
              </View>
              <View style={styles.arrow1}>
                <ThemeImage
                  styles={{transform: [{rotate: '180deg'}]}}
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
              activeOpacity={0.7}>
              <View
                style={[
                  styles.gradientCircle,
                  {
                    backgroundColor:
                      theme && darkModeType ? backgroundColor : '#FF6B35',
                  },
                ]}>
                <View style={styles.iconPlaceholder1}>
                  <ThemeText
                    content={t('settings.viewSwapsHome.rootstock')[0]}
                    styles={styles.iconText1}
                  />
                </View>
              </View>
              <View style={styles.cardContent1}>
                <ThemeText
                  content={t('settings.viewSwapsHome.rootstock')}
                  styles={styles.optionTitle1}
                />
              </View>
              <View style={styles.arrow1}>
                <ThemeImage
                  styles={{transform: [{rotate: '180deg'}]}}
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
        label={t('settings.viewSwapsHome.pageTitle', {
          type:
            selectedPage === 'liquid'
              ? t('settings.viewSwapsHome.liquid')
              : t('settings.viewSwapsHome.rootstock'),
        })}
        customBackFunction={() => setSelectedPage(null)}
      />
      {selectedPage === 'liquid' ? <LiquidSwapsPage /> : <RoostockSwapsPage />}
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
  gradientCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.medium,
  },
  liquidGradient: {
    backgroundColor: '#4285F4',
  },
  rootstockGradient: {
    backgroundColor: '#FF6B35',
  },
  iconPlaceholder1: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText1: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
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
