import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { COLORS } from '../../../../constants';
import useAdaptiveButtonLayout from '../../../../hooks/useAdaptiveButtonLayout';

export default function SavingsActionButtons({
  savingsBalance,
  selectedGoalUUID = null,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();

  const addLabel = t('savings.actionButtons.addMoney'); // e.g. "Add funds"
  const withdrawLabel = t('savings.actionButtons.withdraw'); // e.g. "Withdraw"

  const { shouldStack, containerProps, getLabelProps } =
    useAdaptiveButtonLayout([addLabel, withdrawLabel]);

  const depositBg =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  const buttonBg = theme ? backgroundOffset : COLORS.darkModeText;
  const canWithdraw = savingsBalance > 0;

  return (
    <View
      {...containerProps}
      style={[
        styles.container,
        shouldStack ? styles.containerStacked : styles.containerRow,
      ]}
    >
      {/* Add funds */}
      <TouchableOpacity
        onPress={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'addMoneyToSavings',
            sliderHight: 0.5,
            selectedGoalUUID,
          })
        }
        style={[
          styles.button,
          shouldStack ? styles.buttonStacked : styles.buttonColumn,
          { backgroundColor: depositBg },
        ]}
      >
        <ThemeText
          styles={{
            includeFontPadding: false,
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          {...getLabelProps(0)}
          content={addLabel}
        />
      </TouchableOpacity>

      {/* Withdraw */}
      <TouchableOpacity
        onPress={() => {
          if (!canWithdraw) return;
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'withdrawFromSavings',
            sliderHight: 0.5,
            currentBalance: savingsBalance,
            selectedGoalUUID,
          });
        }}
        disabled={!canWithdraw}
        style={[
          styles.button,
          shouldStack ? styles.buttonStacked : styles.buttonColumn,
          { backgroundColor: buttonBg },
          !canWithdraw && styles.disabled,
        ]}
      >
        <ThemeText
          styles={{ includeFontPadding: false }}
          {...getLabelProps(1)}
          content={withdrawLabel}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  containerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonColumn: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
});
