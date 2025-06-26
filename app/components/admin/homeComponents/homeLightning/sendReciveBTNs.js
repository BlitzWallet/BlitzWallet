import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, ICONS} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {memo, useCallback, useMemo} from 'react';
import CustomSendAndRequsetBTN from '../../../../functions/CustomElements/sendRequsetCircleBTN';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';

export function SendRecieveBTNs({
  theme,
  darkModeType,
  isConnectedToTheInternet,
}) {
  console.log('Loading send and receive btns componeent');
  const navigate = useNavigation();
  const {t} = useTranslation();

  const handleSettingsCheck = useCallback(() => {
    try {
      if (!isConnectedToTheInternet) throw new Error('Not Connected To Node');
      return true;
    } catch (err) {
      return false;
    }
  }, [isConnectedToTheInternet]);

  const buttonElements = ['send', 'camera', 'receive'].map(btnType => {
    const isArrow = btnType === 'send' || btnType === 'receive';
    if (isArrow) {
      return CustomSendAndRequsetBTN({
        btnType,
        btnFunction: () => {
          crashlyticsLogReport(
            `Running in send and receive buttons on homepage for button type: ${btnType}`,
          );
          const areSettingsSet = handleSettingsCheck();
          if (!areSettingsSet) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('constants.internetError'),
            });
            return;
          }
          if (btnType === 'send') {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'sendOptions',
              sliderHight: 0.5,
            });
          } else {
            navigate.navigate('ReceiveBTC', {
              from: 'homepage',
            });
          }
        },
        arrowColor: theme
          ? darkModeType
            ? COLORS.lightsOutBackground
            : COLORS.darkModeBackground
          : COLORS.primary,
        containerBackgroundColor: COLORS.darkModeText,
      });
    }
    return (
      <TouchableOpacity
        key={btnType}
        onPress={() => {
          crashlyticsLogReport(
            `Running in send and receive buttons on homepage for button send BTC page`,
          );
          const areSettingsSet = handleSettingsCheck();
          if (!areSettingsSet) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('constants.internetError'),
            });
            return;
          }

          navigate.navigate('SendBTC');
        }}>
        <View
          style={{
            ...styles.scanQrIcon,
            backgroundColor: theme
              ? darkModeType
                ? COLORS.lightsOutBackgroundOffset
                : COLORS.darkModeBackgroundOffset
              : COLORS.primary,
          }}>
          <ThemeImage
            darkModeIcon={ICONS.scanQrCodeLight}
            lightsOutIcon={ICONS.scanQrCodeLight}
            lightModeIcon={ICONS.scanQrCodeLight}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return <View style={styles.container}>{buttonElements}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 70,
    ...CENTER,
  },

  scanQrIcon: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
});
