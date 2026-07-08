import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { COLORS } from '../../../../constants';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';

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

  const depositBg =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  const buttonBg = theme ? backgroundOffset : COLORS.darkModeText;

  return (
    <AdaptiveButtonRow
      labels={[addLabel, withdrawLabel]}
      containerStyle={styles.container}
    >
      {({ buttonStyle }) => (
        <>
          {/* Add funds */}
          <TouchableOpacity
            onPress={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'addMoneyToSavings',
                sliderHight: 0.5,
                selectedGoalUUID,
              })
            }
            style={[styles.button, buttonStyle, { backgroundColor: depositBg }]}
          >
            <ThemeText
              styles={{
                includeFontPadding: false,
                color:
                  theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText,
              }}
              content={addLabel}
            />
          </TouchableOpacity>

          {/* Withdraw */}
          <TouchableOpacity
            onPress={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'withdrawFromSavings',
                sliderHight: 0.5,
                currentBalance: savingsBalance,
                selectedGoalUUID,
              })
            }
            style={[styles.button, buttonStyle, { backgroundColor: buttonBg }]}
          >
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={withdrawLabel}
            />
          </TouchableOpacity>
        </>
      )}
    </AdaptiveButtonRow>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
