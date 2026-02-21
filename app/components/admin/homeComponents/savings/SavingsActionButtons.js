import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function SavingsActionButtons({
  savingsBalance,
  selectedGoalUUID = null,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  return (
    <View style={styles.actionsRow}>
      <CustomButton
        buttonStyles={[
          styles.actionButton,
          {
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          },
        ]}
        actionFunction={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'addMoneyToSavings',
            sliderHight: 0.5,
            selectedGoalUUID,
          })
        }
        textContent={t('savings.actionButtons.addMoney')}
        textStyles={[
          styles.primaryActionText,
          {
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          },
        ]}
      />

      <CustomButton
        buttonStyles={[
          styles.actionButton,
          { backgroundColor: backgroundOffset },
          savingsBalance <= 0 && styles.disabledAction,
        ]}
        textStyles={{ color: textColor }}
        disabled={savingsBalance <= 0}
        actionFunction={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'withdrawFromSavings',
            sliderHight: 0.5,
            currentBalance: savingsBalance,
            selectedGoalUUID,
          })
        }
        textContent={t('savings.actionButtons.withdraw')}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
  },
  secondaryAction: {
    backgroundColor: COLORS.lightModeBackgroundOffset,
  },
  disabledAction: {
    opacity: 0.5,
  },
});
