import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useCallback, useMemo, useState } from 'react';
import RNRestart from 'react-native-restart';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../../../functions/CustomElements/Icon';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../../../context-store/appStatus';
import factoryResetWallet from '../../../../functions/factoryResetWallet';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';

export default function ResetPage(props) {
  const [wantsToReset, setWantsToReset] = useState(false);
  const { screenDimensions } = useAppStatus();
  const { totalSatValue } = useUserBalanceContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { liquidNodeInformation } = useNodeContext();
  const [contentHeight, setContentHeight] = useState(0);
  const { backgroundOffset, textColor } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const backgroundColor = useMemo(() => {
    return theme ? backgroundOffset : COLORS.darkModeText;
  }, [theme, backgroundOffset]);
  const checkBackground = useMemo(() => {
    return theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  }, [theme, backgroundOffset]);
  const checkColor = useMemo(() => {
    return theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;
  }, [theme, backgroundOffset]);

  const isDoomsday = props.isDoomsday;

  const handleSelectedItems = useCallback(() => {
    setWantsToReset(prev => !prev);
  }, []);

  const resetWallet = useCallback(async () => {
    if (!wantsToReset) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.resetWallet.boxNotChecked'),
      });
      return;
    }

    try {
      const resetResponse = await factoryResetWallet();

      if (!resetResponse)
        throw Error(t('settings.resetWallet.secureStorageError'));

      RNRestart.restart();
    } catch (err) {
      const errorMessage = err.message;
      navigate.navigate('ErrorScreen', { errorMessage: errorMessage });
    }
  }, [wantsToReset]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: contentHeight > screenDimensions.height ? 0 : 1,
        width: INSET_WINDOW_WIDTH,
        ...CENTER,
        paddingTop: 24,
      }}
    >
      <View
        style={{
          width: '100%',
          alignItems: 'center',
          flexGrow: contentHeight > screenDimensions.height ? 0 : 1,
          gap: 16,
        }}
        onLayout={e => {
          if (!e.nativeEvent.layout.height) return;
          setContentHeight(e.nativeEvent.layout.height);
        }}
      >
        <ThemeText
          styles={{
            ...styles.warningHeader,
            color: theme ? COLORS.darkModeText : COLORS.cancelRed,
          }}
          content={t('settings.resetWallet.header')}
        />

        <View
          style={[
            styles.contentCard,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          <ThemeText
            styles={styles.sectionTitle}
            content={t('settings.resetWallet.dataDeleteHeader')}
          />
          <ThemeText
            styles={styles.descriptionText}
            content={t('settings.resetWallet.dataDeleteDesc')}
          />

          {/* Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              onPress={handleSelectedItems}
              style={styles.optionRow}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: wantsToReset
                      ? checkBackground
                      : 'transparent',
                    borderColor: wantsToReset ? checkBackground : textColor,
                  },
                ]}
              >
                {wantsToReset && (
                  <Icon
                    width={14}
                    height={14}
                    color={checkColor}
                    name={'expandedTxCheck'}
                  />
                )}
              </View>
              <ThemeText
                styles={styles.optionLabel}
                content={t('settings.resetWallet.seedAndPinOpt')}
              />
            </TouchableOpacity>

            {/* <TouchableOpacity
              onPress={() => handleSelectedItems('localStoredItems')}
              style={styles.optionRow}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: selectedOptions.localStoredItems
                      ? checkBackground
                      : 'transparent',
                    borderColor: selectedOptions.localStoredItems
                      ? checkBackground
                      : textColor,
                  },
                ]}
              >
                {selectedOptions.localStoredItems && (
                  <Icon
                    width={14}
                    height={14}
                    color={checkColor}
                    name={'expandedTxCheck'}
                  />
                )}
              </View>
              <ThemeText
                styles={styles.optionLabel}
                content={t('settings.resetWallet.localData')}
              />
            </TouchableOpacity> */}
          </View>
        </View>

        {!isDoomsday && (
          <View
            style={[
              styles.balanceCard,
              {
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ThemeText
              styles={styles.balanceLabel}
              content={t('settings.resetWallet.balanceText')}
            />
            <FormattedSatText
              styles={styles.balanceAmount}
              neverHideBalance={true}
              balance={totalSatValue + liquidNodeInformation.userBalance}
            />
          </View>
        )}

        <CustomButton
          buttonStyles={{
            opacity: wantsToReset ? 1 : HIDDEN_OPACITY,
            marginTop: 'auto',
            alignSelf: 'center',
          }}
          actionFunction={resetWallet}
          textContent={t('constants.reset')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  warningHeader: {
    fontSize: SIZES.large,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  contentCard: {
    width: '100%',
    padding: 20,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: SIZES.medium,
  },
  balanceCard: {
    width: '100%',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: SIZES.small,
    opacity: 0.7,
    marginBottom: 5,
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: SIZES.xLarge,
  },
});
