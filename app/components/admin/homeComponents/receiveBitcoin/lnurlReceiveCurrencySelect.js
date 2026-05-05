import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GetThemeColors from '../../../../hooks/themeColors';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { CENTER, ICONS } from '../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import ThemeImage from '../../../../functions/CustomElements/themeImage';

export default function LnurlReceiveCurrencySelect({
  handleBackPressFunction,
  setContentHeight,
}) {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const navigate = useNavigation();

  useEffect(() => {
    setContentHeight(500);
  }, []);

  const onSelect = currency => {
    handleBackPressFunction(() => {
      toggleMasterInfoObject({ lnurlReceiveCurrency: currency });
      navigate.goBack();
    });
  };

  const currentCurrency =
    masterInfoObject.lnurlReceiveCurrency === 'usd' ? 'usd' : 'btc';

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large, marginBottom: 15 }}
        content={'Receive currency'}
      />

      <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
        <TouchableOpacity
          onPress={() => onSelect('btc')}
          style={styles.optionRow}
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
            <ThemeText styles={styles.optionTitle} content={'Bitcoin'} />
            <ThemeText
              styles={styles.optionSubtitle}
              content={'All future payments will be received as bitcoin'}
            />
          </View>
          <CheckMarkCircle
            isActive={currentCurrency === 'btc'}
            containerSize={25}
            switchDarkMode={theme && darkModeType ? true : false}
          />
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity
          onPress={() => onSelect('usd')}
          style={styles.optionRow}
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
            <ThemeText styles={styles.optionTitle} content={'Dollars'} />
            <ThemeText
              styles={styles.optionSubtitle}
              content={'All future payments will be received as dollars'}
            />
          </View>
          <CheckMarkCircle
            isActive={currentCurrency === 'usd'}
            containerSize={25}
            switchDarkMode={theme && darkModeType ? true : false}
          />
        </TouchableOpacity>
      </View>

      <ThemeText
        styles={styles.footnote}
        content={
          'Any requests you initiate will still be received in the requested currency.'
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    gap: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  optionSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 3,
  },
  separator: {
    width: '100%',
    height: 1,
    opacity: 0.1,
    backgroundColor: 'white',
  },
  footnote: {
    marginTop: 15,
    fontSize: SIZES.small,
    opacity: 0.5,
    textAlign: 'center',
  },
});
