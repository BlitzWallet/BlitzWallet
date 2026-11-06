import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import CustomButton from '../../../../functions/CustomElements/button';
import { useSavings } from '../../../../../context-store/savingsContext';

export default function SavingsActionButtons({
  savingsBalance,
  selectedGoalUUID = null,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { savingsGoals } = useSavings();

  const addLabel = t('savings.actionButtons.addMoney'); // e.g. "Add funds"
  const withdrawLabel = t('savings.actionButtons.withdraw'); // e.g. "Withdraw"

  return (
    <AdaptiveButtonRow
      labels={[addLabel, withdrawLabel]}
      containerStyle={styles.container}
    >
      {({ buttonStyle }) => (
        <>
          <CustomButton
            buttonStyles={buttonStyle}
            enableElipsis={false}
            textContent={addLabel}
            actionFunction={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'addMoneyToSavings',
                sliderHight: 0.5,
                selectedGoalUUID,
                // The sheet's own provider loads goals after mount.
                hasGoals: savingsGoals.length > 0,
              })
            }
            size={'regular'}
          />
          <CustomButton
            // Dimmed with nothing saved; still opens so rewards can be withdrawn.
            buttonStyles={[
              buttonStyle,
              !(Number(savingsBalance) > 0) && styles.dimmed,
            ]}
            enableElipsis={false}
            textContent={withdrawLabel}
            actionFunction={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'withdrawFromSavings',
                sliderHight: 0.5,
                currentBalance: savingsBalance,
                selectedGoalUUID,
              })
            }
            size={'regular'}
            tone={'secondary'}
          />
        </>
      )}
    </AdaptiveButtonRow>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dimmed: {
    opacity: 0.45,
  },
});
