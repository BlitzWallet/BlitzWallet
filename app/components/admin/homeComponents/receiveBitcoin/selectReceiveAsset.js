import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { CENTER, ICONS } from '../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';

export default function SelectReceiveAsset({
  endReceiveType,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();

  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const selectSendingBalance = term => {
    handleBackPressFunction(() =>
      navigate.popTo(
        'ReceiveBTC',
        {
          endReceiveType: term,
          receiveAmount: 0,
          description: '',
        },
        { merge: true },
      ),
    );
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large }}
        content={t('screens.inAccount.receiveBtcPage.selectReceiveAssetHead')}
      />

      <TouchableOpacity
        onPress={() => selectSendingBalance('BTC')}
        style={styles.containerRow}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: theme
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
          isActive={endReceiveType === 'BTC'}
          containerSize={25}
          switchDarkMode={true}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => selectSendingBalance('USD')}
        style={styles.containerRow}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: theme
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
          isActive={endReceiveType === 'USD'}
          containerSize={25}
          switchDarkMode={true}
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
    paddingVertical: 15,
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 15,
  },
  iconSize: {
    fontSize: SIZES.xxLarge,
  },
  balanceTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  amountText: {
    opacity: 0.7,
    includeFontPadding: false,
  },

  tokenContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  tickerText: { marginRight: 'auto', includeFontPadding: false },
  balanceText: { includeFontPadding: false },
  tokenInitialContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  tokenImage: {
    width: 45,
    height: 45,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
