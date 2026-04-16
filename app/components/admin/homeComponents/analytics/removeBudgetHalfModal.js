import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, FONT, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContextProvider } from '../../../../../context-store/context';

export default function RemoveBudgetHalfModal({
  setContentHeight,
  handleBackPressFunction,
}) {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const isMounted = useRef(true);
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setContentHeight(400);
    return () => {
      isMounted.current = false;
    };
  }, []);

  const removeBudget = async () => {
    setIsLoading(true);
    await toggleMasterInfoObject({ monthlyBudget: null });
    handleBackPressFunction();
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('analytics.budget.removeBudgetTitle')}
      />

      <ThemeText
        styles={styles.description}
        content={t('analytics.budget.removeBudgetSub')}
      />

      <View style={styles.buttonContainer}>
        <CustomButton
          buttonStyles={styles.closeButton}
          textContent={t('constants.remove')}
          actionFunction={removeBudget}
          useLoading={isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    marginBottom: 12,
  },
  description: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 24,
    lineHeight: 22,
  },
  detailsBox: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: SIZES.medium,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Bold,
    maxWidth: '60%',
    textAlign: 'right',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 'auto',
  },
  closeButton: {
    ...CENTER,
  },
  cancelButton: {
    width: '100%',
    opacity: 0.6,
  },
});
