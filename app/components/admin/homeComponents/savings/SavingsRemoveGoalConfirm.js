import { useNavigation } from '@react-navigation/native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { WINDOWWIDTH } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { useMemo } from 'react';

export default function SavingsRemoveGoalConfirm(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const goalId = props?.route?.params?.goalId;
  const { savingsGoals, removeSavingsGoal } = useSavings();
  const { theme, darkModeType } = useGlobalThemeContext();

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

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('savings.removeGoalConfirm.screenTitle')}
      />
      <View style={styles.container}>
        <View>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
          >
            <ThemeIcon
              iconName={'Trash2'}
              size={26}
              colorOverride={
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText
              }
            />
          </View>

          <ThemeText
            styles={styles.title}
            content={t('savings.removeGoalConfirm.title')}
          />

          <View style={styles.warningPointsContainer}>
            {warningPoints.map(point => (
              <View key={point.text} style={styles.warningPoint}>
                <View style={styles.warningIconContainer}>
                  <View
                    style={[
                      styles.warningIconBadge,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? COLORS.darkModeText
                            : COLORS.primary,
                      },
                    ]}
                  >
                    <ThemeIcon
                      iconName={point.icon}
                      size={15}
                      colorOverride={
                        theme && darkModeType
                          ? COLORS.lightModeText
                          : COLORS.darkModeText
                      }
                    />
                  </View>
                </View>
                <ThemeText styles={styles.warningText} content={point.text} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <CustomButton
            actionFunction={navigate.goBack}
            textContent={t('constants.cancel')}
          />

          <CustomButton
            actionFunction={async () => {
              const response = await removeSavingsGoal(selectedGoal?.id);
              if (!response?.didWork) {
                navigate.navigate('ErrorScreen', {
                  errorMessage:
                    response?.error ||
                    t('savings.removeGoalConfirm.errors.unableToRemoveGoal'),
                });
                return;
              }
              navigate.navigate('SavingsGoalRemovedSuccess');
            }}
            textContent={t('savings.removeGoalConfirm.removeButton')}
            buttonStyles={{
              backgroundColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
            }}
            textStyles={{
              color:
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText,
            }}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
    justifyContent: 'space-between',
    ...CENTER,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 56,
    alignSelf: 'center',
  },
  title: {
    marginTop: 10,
    fontSize: SIZES.large,
    includeFontPadding: false,
    alignSelf: 'center',
  },
  warningPointsContainer: {
    gap: 16,
    marginTop: 20,
  },
  warningPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningIconContainer: {
    marginTop: 2,
  },
  warningIconBadge: {
    padding: 5,
    borderRadius: 8,
  },
  warningText: {
    flex: 1,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  actions: {
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 22,
    backgroundColor: COLORS.lightModeBackgroundOffset,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  dangerButton: {
    borderRadius: 22,
    backgroundColor: COLORS.cancelRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  dangerButtonText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
});
