import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import GetThemeColors from '../../../../hooks/themeColors';

export default function SavingsUpdateGoal(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { savingsGoals } = useSavings();
  const { tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const goalId = props?.route?.params?.goalId;
  const selectedGoal = savingsGoals.find(goal => goal.id === goalId) || null;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={selectedGoal?.name || t('savings.updateGoal.screenTitle')}
        />

        <View style={styles.content}>
          <Disc icon={'RefreshCcw'} tone="white" size={56} iconSize={24} />
          <ThemeText
            variant={'title'}
            styles={styles.title}
            content={t('savings.updateGoal.title')}
          />
          <ThemeText
            variant={'body'}
            styles={[styles.body, { color: tokens.muted }]}
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
            size={'regular'}
            tone={'secondary'}
          />

          <CustomButton
            actionFunction={() => {
              navigate.navigate('SavingsGoalAmount', {
                mode: 'update',
                goalId: selectedGoal?.id,
                emoji: selectedGoal?.emoji,
                goalName: selectedGoal?.name,
              });
            }}
            textContent={t('savings.updateGoal.updateButton')}
            size={'regular'}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  content: {
    marginTop: 24,
    flex: 1,
  },
  title: {
    marginTop: 20,
  },
  body: {
    marginTop: 8,
  },
  actions: {
    gap: 12,
  },
});
