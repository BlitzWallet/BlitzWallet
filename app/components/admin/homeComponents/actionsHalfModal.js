import { Fragment, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ListDivider } from '../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import Spinner from '../../../functions/CustomElements/redesign/Spinner';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../functions/CustomElements/redesign/AnimatedStep';
import { useTheme } from '../../../../context-store/theme';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';

// Sheet chrome around the content: grab area (10 + 5 + 5) + 34 bottom padding.
const SHEET_CHROME = 54;
const ROW_HEIGHT = 64;

// Reusable list-of-actions sheet. Open it with
//   navigate.navigate('CustomHalfModal', { wantedContent: 'ActionsHalfModal', actions })
// where each action is `{ icon, title, onPress }` or `{ icon, title, stepHeight, renderStep }`.
// - `onPress` may be async: the row shows a spinner, then the sheet closes. It may
//   return a function, which runs once the sheet has closed (navigate, set a note…).
// - `renderStep({ onBack, setContentHeight, handleBackPressFunction })` swaps the
//   menu for a taller step inside the same sheet, `stepHeight` px high.
export default function ActionsHalfModal({
  setContentHeight,
  handleBackPressFunction,
  actions = [],
}) {
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const [busyIndex, setBusyIndex] = useState(null);
  const [stepIndex, setStepIndex] = useState(null);

  const menuHeight =
    14 + ROW_HEIGHT * actions.length + (actions.length - 1) + SHEET_CHROME;
  const activeStep = stepIndex === null ? null : actions[stepIndex];

  useStepSheetHeight(
    setContentHeight,
    activeStep ? activeStep.stepHeight : menuHeight,
  );

  const backToMenu = useCallback(() => setStepIndex(null), []);

  useHandleBackPressNew(
    useCallback(() => {
      if (stepIndex === null) return false;
      backToMenu();
      return true;
    }, [stepIndex, backToMenu]),
  );

  const handlePress = async (action, index) => {
    if (busyIndex !== null) return;
    if (action.renderStep) {
      growThenStep(setContentHeight, menuHeight, action.stepHeight, () =>
        setStepIndex(index),
      );
      return;
    }
    setBusyIndex(index);
    let afterClose;
    try {
      afterClose = await action.onPress();
    } catch (err) {
      console.log(err);
    }
    handleBackPressFunction(() => {
      navigate.goBack();
      if (typeof afterClose === 'function') afterClose();
    });
  };

  return (
    <View style={styles.container}>
      <AnimatedStep active={stepIndex === null} direction={-1}>
        <View style={styles.menu}>
          {actions.map((action, index) => (
            <Fragment key={action.title}>
              {index > 0 && <ListDivider inset={68} />}
              <ListRow
                minHeight={ROW_HEIGHT}
                titleStyle={styles.rowTitle}
                lead={<Disc icon={action.icon} size={40} />}
                title={action.title}
                onPress={() => handlePress(action, index)}
                showChevron={busyIndex !== index}
                trailing={
                  busyIndex === index && (
                    <Spinner size="small" color={tokens.muted} />
                  )
                }
              />
            </Fragment>
          ))}
        </View>
      </AnimatedStep>
      <AnimatedStep active={activeStep !== null} direction={1} exitsBack={true}>
        {activeStep?.renderStep({
          onBack: backToMenu,
          setContentHeight,
          handleBackPressFunction,
        })}
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  menu: { marginTop: 14 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
