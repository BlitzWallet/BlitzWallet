import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';

export default function RemoveBudgetHalfModal({
  setContentHeight,
  handleBackPressFunction,
}) {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const isMounted = useRef(true);
  const { t } = useTranslation();

  const cancelButton = t('constants.cancel');
  const removeButton = t('constants.remove');

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const removeBudget = async () => {
    await toggleMasterInfoObject({ monthlyBudget: null });
    handleBackPressFunction();
  };

  return (
    <View
      style={styles.container}
      onLayout={e =>
        // Sheet chrome: grab area (10 + 5) + 34 bottom padding.
        setContentHeight(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <Disc icon={'Trash2'} tone="danger" size={56} iconSize={24} />
      <SheetHeader
        afterIcon
        title={t('analytics.budget.removeBudgetTitle')}
        sub={t('analytics.budget.removeBudgetSub')}
      />
      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={cancelButton}
          actionFunction={handleBackPressFunction}
          size={'regular'}
          tone="secondary"
        />
        <CustomButton
          textContent={removeButton}
          actionFunction={removeBudget}
          size={'regular'}
          tone="danger"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 15,
  },
  buttonContainer: {
    gap: 10,
    marginTop: 24,
  },
});
