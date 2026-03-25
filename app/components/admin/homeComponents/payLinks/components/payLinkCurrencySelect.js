import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import GetThemeColors from '../../../../../hooks/themeColors';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import { CENTER, COLORS, ICONS } from '../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

export default function PayLinkCurrencySelect({
  currentCurrency,
  onSelectCurrency,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();

  useEffect(() => {
    setContentHeight(375);
  }, []);

  const onSelect = currency => {
    handleBackPressFunction(() => {
      navigate.goBack();
      onSelectCurrency?.(currency);
    });
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large, marginBottom: 15 }}
        content={t('wallet.payLinks.requestHeader')}
      />

      <TouchableOpacity
        onPress={() => onSelect('BTC')}
        style={styles.containerRow}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.bitcoinOrange,
            },
          ]}
        >
          <ThemeImage
            styles={{ width: 25, height: 25 }}
            lightModeIcon={ICONS.bitcoinIcon}
            darkModeIcon={ICONS.bitcoinIcon}
            lightsOutIcon={ICONS.bitcoinIcon}
          />
        </View>
        <View style={styles.textContainer}>
          <ThemeText
            styles={styles.balanceTitle}
            content={t('constants.bitcoin_upper')}
          />
        </View>
        <CheckMarkCircle
          isActive={currentCurrency === 'BTC'}
          containerSize={25}
          switchDarkMode={theme && darkModeType ? true : false}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onSelect('USD')}
        style={styles.containerRow}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.dollarGreen,
            },
          ]}
        >
          <ThemeImage
            styles={{ width: 25, height: 25 }}
            lightModeIcon={ICONS.dollarIcon}
            darkModeIcon={ICONS.dollarIcon}
            lightsOutIcon={ICONS.dollarIcon}
          />
        </View>
        <View style={styles.textContainer}>
          <ThemeText
            styles={styles.balanceTitle}
            content={t('constants.dollars_upper')}
          />
        </View>
        <CheckMarkCircle
          isActive={currentCurrency === 'USD'}
          containerSize={25}
          switchDarkMode={theme && darkModeType ? true : false}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  containerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingVertical: 10,
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 15,
  },
  balanceTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
