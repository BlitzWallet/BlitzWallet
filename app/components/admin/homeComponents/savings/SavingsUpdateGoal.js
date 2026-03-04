import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH, WINDOWWIDTH } from '../../../../constants/theme';
import IconActionCircle from '../../../../functions/CustomElements/actionCircleContainer';

export default function SavingsUpdateGoal(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { savingsGoals } = useSavings();
  const goalId = props?.route?.params?.goalId;
  const selectedGoal = savingsGoals.find(goal => goal.id === goalId) || null;

  const { theme, darkModeType } = useGlobalThemeContext();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('savings.updateGoal.screenTitle')} />

      <View style={styles.container}>
        <View style={styles.content}>
          <IconActionCircle bottomOffset={32} icon={'RefreshCcw'} />
          <ThemeText
            styles={styles.title}
            content={t('savings.updateGoal.title')}
          />
          <ThemeText
            styles={styles.body}
            content={t('savings.updateGoal.body')}
          />
        </View>

        <View style={styles.actions}>
          <CustomButton
            actionFunction={() =>
              navigate.navigate('SavingsRemoveGoalConfirm', {
                goalId: selectedGoal?.id,
              })
            }
            textContent={t('savings.updateGoal.removeButton')}
          />

          <CustomButton
            buttonStyles={{
              backgroundColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            }}
            textStyles={{
              color:
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText,
            }}
            actionFunction={() => {
              navigate.navigate('SavingsGoalAmount', {
                mode: 'update',
                goalId: selectedGoal?.id,
                emoji: selectedGoal?.emoji,
                goalName: selectedGoal?.name,
              });
            }}
            textContent={t('savings.updateGoal.updateButton')}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    justifyContent: 'space-between',
    ...CENTER,
  },
  content: {
    marginTop: 56,
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  body: {
    textAlign: 'center',
    opacity: 0.75,
    includeFontPadding: false,
  },
  actions: {
    gap: 10,
  },
});
