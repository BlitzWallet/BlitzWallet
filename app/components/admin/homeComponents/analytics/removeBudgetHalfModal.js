import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function RemoveBudgetHalfModal({
  setContentHeight,
  handleBackPressFunction,
}) {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { mode } = useGlobalThemeContext();
  const isMounted = useRef(true);
  const { t } = useTranslation();

  const cancelButton = t('constants.cancel');
  const removeButton = t('constants.remove');

  useEffect(() => {
    setContentHeight(400);
    return () => {
      isMounted.current = false;
    };
  }, []);

  const removeBudget = async () => {
    await toggleMasterInfoObject({ monthlyBudget: null });
    handleBackPressFunction();
  };

  return (
    <View style={styles.container}>
      <Disc
        icon={'Trash2'}
        tone={mode !== 'dim' ? 'danger' : 'regular'}
        size={56}
        iconSize={24}
      />
      <SheetHeader
        afterIcon
        title={t('analytics.budget.removeBudgetTitle')}
        sub={t('analytics.budget.removeBudgetSub')}
      />
      <AdaptiveButtonRow
        labels={[cancelButton, removeButton]}
        containerStyle={styles.buttonContainer}
      >
        {({ buttonStyle }) => (
          <>
            <CustomButton
              buttonStyles={[styles.actionButton, buttonStyle]}
              enableElipsis={false}
              textContent={cancelButton}
              actionFunction={handleBackPressFunction}
              size={'regular'}
              tone="secondary"
            />
            <CustomButton
              buttonStyles={[styles.actionButton, buttonStyle]}
              enableElipsis={false}
              textContent={removeButton}
              actionFunction={removeBudget}
              size={'regular'}
              tone={mode !== 'dim' ? 'danger' : 'regular'}
            />
          </>
        )}
      </AdaptiveButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 15,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
    marginTop: 'auto',
  },
});
