import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { Fragment, useMemo, useState } from 'react';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import PageTitle from '../../../../functions/CustomElements/redesign/PageTitle';

export default function SavingsRemoveGoalConfirm(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const goalId = props?.route?.params?.goalId;
  const { savingsGoals, removeSavingsGoal } = useSavings();
  const { mode, tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [isRemoving, setIsRemoving] = useState(false);

  const selectedGoal = useMemo(() => {
    return savingsGoals.find(goal => goal.id === goalId) || null;
  }, []);

  const warningPoints = [
    {
      icon: 'Target',
      text: t('savings.removeGoalConfirm.warningProgressLost', {
        goalName:
          selectedGoal?.name || t('savings.goalDetails.screenTitleFallback'),
      }),
    },
    {
      icon: 'Wallet',
      text: t('savings.removeGoalConfirm.warningMoneyReturned'),
    },
  ];

  const handleRemove = async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    const response = await removeSavingsGoal(selectedGoal?.id);
    setIsRemoving(false);
    if (!response?.didWork) {
      navigate.navigate('ErrorScreen', {
        errorMessage:
          response?.error ||
          t('savings.removeGoalConfirm.errors.unableToRemoveGoal'),
      });
      return;
    }
    navigate.navigate('SavingsGoalRemovedSuccess');
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar />

        <View style={styles.content}>
          <Disc
            icon={'Trash2'}
            tone={mode !== 'dim' ? 'danger' : 'white'}
            size={56}
            iconSize={24}
          />
          <PageTitle
            titleStyles={styles.titleText}
            text={t('savings.removeGoalConfirm.title')}
          />

          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            {warningPoints.map((point, index) => (
              <Fragment key={point.icon}>
                {index > 0 && (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: tokens.divider },
                    ]}
                  />
                )}
                <View style={styles.point}>
                  <Disc icon={point.icon} size={32} iconSize={16} />
                  <ThemeText
                    variant={'body'}
                    styles={styles.pointText}
                    content={point.text}
                  />
                </View>
              </Fragment>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <CustomButton
            actionFunction={navigate.goBack}
            textContent={t('constants.cancel')}
            size={'regular'}
            tone={'secondary'}
          />

          <CustomButton
            actionFunction={handleRemove}
            useLoading={isRemoving}
            textContent={t('savings.removeGoalConfirm.removeButton')}
            size={'regular'}
            tone={'danger'}
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
  titleText: { marginTop: 16 },
  card: {
    marginTop: 20,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  pointText: {
    flex: 1,
    marginTop: 5,
  },
  divider: {
    height: 1,
  },
  actions: {
    gap: 12,
  },
});
