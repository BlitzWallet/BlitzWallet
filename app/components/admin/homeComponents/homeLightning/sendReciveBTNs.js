import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS, ICONS } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useCallback } from 'react';
import CustomSendAndRequsetBTN from '../../../../functions/CustomElements/sendRequsetCircleBTN';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { ArrowUpDown } from 'lucide-react-native';

export function SendRecieveBTNs({
  theme,
  darkModeType,
  isConnectedToTheInternet,
  isNWCWallet = false,
  scrollPosition,
}) {
  console.log('Loading send and receive btns componeent');
  const navigate = useNavigation();
  const { t } = useTranslation();

  const handleSettingsCheck = useCallback(() => {
    try {
      if (!isConnectedToTheInternet)
        throw new Error(t('errormessages.nointernet'));
      return true;
    } catch (err) {
      return false;
    }
  }, [isConnectedToTheInternet]);

  const buttonElements = ['send', 'receive', 'camera', 'swap'].map(btnType => {
    if (isNWCWallet && btnType === 'camera') return;
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
              errorMessage: t('errormessages.nointernet'),
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
              initialReceiveType: scrollPosition === 'usd' ? 'USD' : 'BTC',
            });
          }
        },
        arrowColor: theme
          ? darkModeType
            ? COLORS.lightsOutBackground
            : COLORS.darkModeText
          : COLORS.darkModeText,
        containerBackgroundColor:
          theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
      });
    }
    return (
      <TouchableOpacity
        key={btnType}
        onPress={() => {
          const areSettingsSet = handleSettingsCheck();
          if (!areSettingsSet) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('errormessages.nointernet'),
            });
            return;
          }
          if (btnType === 'swap') {
            navigate.navigate('SwapsPage');
          } else {
            crashlyticsLogReport(
              `Running in send and receive buttons on homepage for button send BTC page`,
            );

            navigate.navigate('SendBTC');
          }
        }}
      >
        <View
          style={{
            ...styles.scanQrIcon,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
        >
          {btnType === 'swap' ? (
            <ArrowUpDown
              color={
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText
              }
              size={30}
            />
          ) : (
            <ThemeImage
              darkModeIcon={ICONS.scanQrCodeLight}
              lightsOutIcon={ICONS.scanQrCodeDark}
              lightModeIcon={ICONS.scanQrCodeLight}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View
      style={{
        ...styles.container,
        marginBottom: isNWCWallet ? 0 : 50,
      }}
    >
      {buttonElements}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    ...CENTER,
  },

  scanQrIcon: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    overflow: 'hidden',
  },
});
