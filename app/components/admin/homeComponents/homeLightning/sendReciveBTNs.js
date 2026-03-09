import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import useAdaptiveFontSize from '../../../../hooks/useAdaptiveFontSIze';

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
  const { backgroundOffset, textColor } = GetThemeColors();

  const handleSettingsCheck = useCallback(() => {
    try {
      if (!isConnectedToTheInternet)
        throw new Error(t('errormessages.nointernet'));
      return true;
    } catch (err) {
      return false;
    }
  }, [isConnectedToTheInternet]);

  const arrowIconColor = COLORS.darkModeText;
  const handleSend = useCallback(() => {
    crashlyticsLogReport(
      'Running in send and receive buttons on homepage for button type: send',
    );
    const areSettingsSet = handleSettingsCheck();
    if (!areSettingsSet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'sendOptions',
      sliderHight: 0.8,
    });
  }, [handleSettingsCheck, navigate, t]);

  const handleReceive = useCallback(() => {
    crashlyticsLogReport(
      'Running in send and receive buttons on homepage for button type: receive',
    );
    const areSettingsSet = handleSettingsCheck();
    if (!areSettingsSet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('CustomHalfModal', {
      scrollPosition: scrollPosition === 'usd' ? 'USD' : 'BTC',
      wantedContent: 'receiveOptions',
      sliderHight: 0.8,
    });
  }, [handleSettingsCheck, navigate, scrollPosition, t]);

  const handleCamera = useCallback(() => {
    const areSettingsSet = handleSettingsCheck();
    if (!areSettingsSet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    crashlyticsLogReport(
      'Running in send and receive buttons on homepage for button send BTC page',
    );
    navigate.navigate('SendBTC');
  }, [handleSettingsCheck, navigate, t]);

  const handleSwap = useCallback(() => {
    const areSettingsSet = handleSettingsCheck();
    if (!areSettingsSet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'swapFlow',
      sliderHight: 0.5,
    });
  }, [handleSettingsCheck, navigate, t]);

  const { fontSize, getLabelProps } = useAdaptiveFontSize(
    [
      t('constants.send'),
      t('constants.receive'),
      t('constants.scan'),
      t('constants.swap'),
    ],
    SIZES.small,
    5,
  );

  return (
    <View style={styles.container}>
      {/* Send — primary */}
      <TouchableOpacity
        style={styles.buttonWrapper}
        onPress={handleSend}
        activeOpacity={1}
      >
        <View
          style={[
            styles.btn,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
            },
          ]}
        >
          <ThemeIcon
            size={25}
            iconName="ArrowUp"
            colorOverride={arrowIconColor}
          />
        </View>
        <ThemeText
          content={t('constants.send')}
          styles={[styles.labelSecondary, { fontSize }]}
          {...getLabelProps(0)}
        />
      </TouchableOpacity>

      {/* Receive — primary */}
      <TouchableOpacity
        style={styles.buttonWrapper}
        onPress={handleReceive}
        activeOpacity={1}
      >
        <View
          style={[
            styles.btn,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
            },
          ]}
        >
          <ThemeIcon
            size={25}
            iconName="ArrowDown"
            colorOverride={arrowIconColor}
          />
        </View>
        <ThemeText
          content={t('constants.receive')}
          styles={[styles.labelSecondary, { fontSize }]}
          {...getLabelProps(1)}
        />
      </TouchableOpacity>

      {/* Camera/Scan — secondary */}
      {!isNWCWallet && (
        <TouchableOpacity
          style={styles.buttonWrapper}
          activeOpacity={1}
          onPress={handleCamera}
        >
          <View
            style={[
              styles.btn,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
              },
            ]}
          >
            <ThemeIcon
              size={25}
              iconName="ScanQrCode"
              colorOverride={arrowIconColor}
            />
          </View>
          <ThemeText
            content={t('constants.scan')}
            styles={[styles.labelSecondary, { fontSize }]}
            {...getLabelProps(2)}
          />
        </TouchableOpacity>
      )}

      {/* Swap — secondary */}
      <TouchableOpacity
        style={styles.buttonWrapper}
        activeOpacity={1}
        onPress={handleSwap}
      >
        <View
          style={[
            styles.btn,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
            },
          ]}
        >
          <ThemeIcon
            size={25}
            iconName="ArrowRightLeft"
            colorOverride={arrowIconColor}
          />
        </View>
        <ThemeText
          content={t('constants.swap')}
          styles={[styles.labelSecondary, { fontSize }]}
          {...getLabelProps(3)}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 350,
    width: '85%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    ...CENTER,
  },
  buttonWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  btn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  labelSecondary: {
    width: '100%',
    fontSize: SIZES.small,
    includeFontPadding: false,
    marginTop: 7,
    textAlign: 'center',
    opacity: 0.5,
  },
});
