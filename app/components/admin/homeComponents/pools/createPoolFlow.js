import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useKeysContext } from '../../../../../context-store/keys';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import PoolAmountKeypad from './components/poolAmountKeypad';
import { createPoolDocument } from './poolCreationSharedLogic';

const STEP_HEIGHTS = { amount: 720, name: 400 };

/**
 * Create Pool sheet (CustomHalfModal content): goal amount → pool name.
 */
export default function CreatePoolFlow({
  setContentHeight,
  handleBackPressFunction,
  navigate,
}) {
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { fiatStats } = useNodeContext();

  const [currentStep, setCurrentStep] = useState('amount');
  const [direction, setDirection] = useState(1);
  const [goalAmount, setGoalAmount] = useState(0);
  const [poolTitle, setPoolTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  useStepSheetHeight(setContentHeight, STEP_HEIGHTS[currentStep]);

  const goTo = useCallback(
    step => {
      setDirection(step === 'name' ? 1 : -1);
      growThenStep(
        setContentHeight,
        STEP_HEIGHTS[currentStep],
        STEP_HEIGHTS[step],
        () => setCurrentStep(step),
      );
    },
    [currentStep, setContentHeight],
  );

  const handleBackPress = useCallback(() => {
    if (isCreatingRef.current) return true;
    if (currentStep === 'name') {
      goTo('amount');
      return true;
    }
    return false;
  }, [currentStep, goTo]);
  useHandleBackPressNew(handleBackPress);

  const isValid = poolTitle.trim().length > 0 && goalAmount > 0;

  const handleCreatePool = async () => {
    if (!isValid || isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const pool = await createPoolDocument({
        masterInfoObject,
        accountMnemoinc,
        globalContactsInformation,
        poolTitle,
        goalAmount,
      });
      handleBackPressFunction(() => {
        navigate.replace('PoolsStack', {
          screen: 'PoolDetailScreen',
          params: { poolId: pool.poolId, pool, shouldSave: true },
        });
      });
    } catch (err) {
      console.log('Error creating pool:', err);
      isCreatingRef.current = false;
      setIsCreating(false);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={currentStep === 'amount'}
        direction={direction}
        exitsBack={false}
      >
        <PoolAmountKeypad
          label={t('wallet.pools.poolGoal')}
          buttonText={sats =>
            sats ? t('wallet.pools.addDescription') : t('constants.back')
          }
          onContinue={sats => {
            if (!sats) {
              handleBackPressFunction();
              return;
            }
            setGoalAmount(sats);
            goTo('name');
          }}
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentStep === 'name'}
        direction={direction}
        exitsBack={true}
      >
        <TopBar
          onBack={() => !isCreatingRef.current && goTo('amount')}
          shouldDismissKeyboard={true}
        />
        <SheetHeader
          title={t('wallet.pools.whatIsPoolFor')}
          sub={`${t('wallet.pools.goal')}${displayCorrectDenomination({
            amount: goalAmount,
            masterInfoObject,
            fiatStats,
          })}`}
        />
        <UserInput
          value={poolTitle}
          onChangeText={setPoolTitle}
          placeholder={t('wallet.pools.examplePlaceholder')}
          maxLength={100}
          autoFocus={true}
        />
        <CustomButton
          buttonStyles={styles.button}
          textContent={
            isCreating
              ? t('wallet.pools.creatingPool')
              : t('wallet.pools.createPool')
          }
          actionFunction={handleCreatePool}
          disabled={!isValid || isCreating}
          size="regular"
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  button: {
    width: '100%',
    marginTop: 'auto',
  },
});
