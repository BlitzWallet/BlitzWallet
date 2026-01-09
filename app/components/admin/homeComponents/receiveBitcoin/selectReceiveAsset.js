import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { CENTER, ICONS } from '../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import CustomButton from '../../../../functions/CustomElements/button';
import { useState } from 'react';

export default function SelectReceiveAsset({
  endReceiveType,
  selectedRecieveOption,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const [selectedOption, setSeelctedOption] = useState(endReceiveType);

  const selectSendingBalance = term => {
    handleBackPressFunction(() =>
      navigate.popTo(
        'ReceiveBTC',
        {
          endReceiveType: selectedOption,
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

      <ScrollView
        style={{ marginVertical: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => setSeelctedOption('BTC')}
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
            isActive={selectedOption === 'BTC'}
            containerSize={25}
            switchDarkMode={true}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSeelctedOption('USD')}
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
            isActive={selectedOption === 'USD'}
            containerSize={25}
            switchDarkMode={true}
          />
        </TouchableOpacity>

        {selectedOption === 'USD' && selectedRecieveOption === 'lightning' && (
          <ThemeText
            styles={styles.disclaimerText}
            content={t('screens.inAccount.receiveBtcPage.usd_convert_warning')}
          />
        )}
      </ScrollView>
      <CustomButton
        actionFunction={selectSendingBalance}
        buttonStyles={{ marginTop: 'auto' }}
        textContent={t('constants.continue')}
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
  disclaimerText: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginTop: 5,
  },
});
