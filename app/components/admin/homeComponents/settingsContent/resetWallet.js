import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useCallback, useMemo, useState } from 'react';
import RNRestart from 'react-native-restart';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useNavigation } from '@react-navigation/native';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import factoryResetWallet from '../../../../functions/factoryResetWallet';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function ResetPage(props) {
  const [wantsToReset, setWantsToReset] = useState(false);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const checkBackground = useMemo(() => {
    return theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  }, [theme, backgroundOffset]);
  const checkColor = useMemo(() => {
    return theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;
  }, [theme, backgroundOffset]);

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
    <View style={styles.resetContainer}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          },
        ]}
      >
        <ThemeIcon
          iconName="ShieldAlert"
          size={40}
          colorOverride={
            theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText
          }
        />
      </View>
      <ThemeText
        styles={styles.title}
        content={t('settings.resetWallet.title')}
      />
      <ThemeText
        styles={styles.descriptionText}
        content={t('settings.resetWallet.dataDeleteDesc')}
      />
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
                backgroundColor: wantsToReset ? checkBackground : 'transparent',
                borderColor: wantsToReset ? checkBackground : textColor,
              },
            ]}
          >
            {wantsToReset && (
              <ThemeIcon
                colorOverride={checkColor}
                size={15}
                iconName={'Check'}
              />
            )}
          </View>
          <ThemeText
            styles={styles.checkboxText}
            content={t('settings.resetWallet.warningText')}
          />
        </TouchableOpacity>
      </View>

      <CustomButton
        buttonStyles={[
          {
            opacity: wantsToReset ? 1 : HIDDEN_OPACITY,
          },
        ]}
        textContent={t('constants.delete')}
        actionFunction={resetWallet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  resetContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    marginTop: 'auto',
  },
  title: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 30,
  },
  descriptionText: {
    opacity: 0.7,
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    gap: 16,
    marginTop: 'auto',
    marginBottom: 5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 3,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: {
    fontSize: SIZES.small,
    flex: 1,
    includeFontPadding: false,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {},
});
