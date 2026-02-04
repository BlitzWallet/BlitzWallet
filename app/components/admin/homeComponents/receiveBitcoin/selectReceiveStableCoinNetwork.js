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

export default function SelectReceiveStableCoinNetwork({
  selectedRecieveOption,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const [selectedOption, setSeelctedOption] = useState(selectedRecieveOption);

  const selectSendingBalance = term => {
    handleBackPressFunction(() =>
      navigate.popTo(
        'ReceiveBTC',
        {
          selectedStablecoinNetwork: selectedOption,
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
        content={t('screens.inAccount.receiveBtcPage.selectStablecoinHead')}
      />

      <ScrollView
        style={{ marginVertical: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => setSeelctedOption('polygon')}
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
                    : COLORS.polygonColor,
              },
            ]}
          >
            <ThemeImage
              contentFit="contain"
              styles={{ height: 25 }}
              lightModeIcon={ICONS.polygonLogo}
              darkModeIcon={ICONS.polygonLogo}
              lightsOutIcon={ICONS.polygonLogo}
            />
          </View>
          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.balanceTitle}
              content={t('screens.inAccount.receiveBtcPage.network_polygon')}
            />
          </View>
          <CheckMarkCircle
            isActive={selectedOption === 'polygon'}
            containerSize={25}
            switchDarkMode={theme && darkModeType ? true : false}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSeelctedOption('ethereum')}
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
                  : COLORS.lightModeText,
              },
            ]}
          >
            <ThemeImage
              contentFit="contain"
              styles={{ height: 25 }}
              lightModeIcon={ICONS.ethLogo}
              darkModeIcon={ICONS.ethLogo}
              lightsOutIcon={ICONS.ethLogo}
            />
          </View>

          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.balanceTitle}
              content={t('screens.inAccount.receiveBtcPage.network_ethereum')}
            />
          </View>
          <CheckMarkCircle
            isActive={selectedOption === 'ethereum'}
            containerSize={25}
            switchDarkMode={theme && darkModeType ? true : false}
          />
        </TouchableOpacity>
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
