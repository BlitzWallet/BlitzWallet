import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { ListDivider } from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTheme } from '../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { exportTransactionsCsv } from '../exportTransactions/exportTracker';
import TxFilterHalfModal from '../homeLightning/txFilterHalfModal';

// Sheet chrome around the content: grab area (10 + 5) + 34 bottom padding.
const SHEET_CHROME = 49;
// 14 top gap + two 64 rows + divider.
const MENU_HEIGHT = 14 + 64 * 2 + 1 + SHEET_CHROME;
const FILTER_HEIGHT = 680;

export default function ExportOrFilterHalfModal({
  setContentHeight,
  handleBackPressFunction,
  currentFilter,
  onSelectFilter,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { tokens } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [step, setStep] = useState('menu');
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  useStepSheetHeight(
    setContentHeight,
    step === 'filter' ? FILTER_HEIGHT : MENU_HEIGHT,
  );

  const backToMenu = useCallback(() => setStep('menu'), []);

  useHandleBackPressNew(
    useCallback(() => {
      if (step !== 'filter') return false;
      backToMenu();
      return true;
    }, [step, backToMenu]),
  );

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    let errorMessage = null;
    try {
      const response = await exportTransactionsCsv({
        accountId: sparkInformation.identityPubKey,
        masterInfoObject,
        t,
      });
      if (response && !response.success) errorMessage = response.error;
    } catch (err) {
      console.log(err);
      errorMessage = 'errormessages.createTransactionsFileError';
    }
    handleBackPressFunction(() => {
      navigate.goBack();
      if (errorMessage) {
        navigate.navigate('ErrorScreen', {
          errorMessage,
          useTranslationString: true,
        });
      }
    });
  };

  const handleFilter = () => {
    if (isExporting) return;
    growThenStep(setContentHeight, MENU_HEIGHT, FILTER_HEIGHT, () =>
      setStep('filter'),
    );
  };

  return (
    <View style={styles.container}>
      <AnimatedStep active={step === 'menu'} direction={-1}>
        <View style={[styles.menu, { width: contentWidth }]}>
          <ListRow
            minHeight={64}
            titleStyle={styles.rowTitle}
            lead={<Disc icon="Download" size={40} />}
            title={t('screens.inAccount.viewAllTxPage.exportTitle')}
            onPress={handleExport}
            showChevron={!isExporting}
            trailing={isExporting && <ActivityIndicator color={tokens.muted} />}
          />
          <ListDivider inset={68} />
          <ListRow
            minHeight={64}
            titleStyle={styles.rowTitle}
            lead={<Disc icon="ListFilter" size={40} />}
            title={t('screens.inAccount.viewAllTxPage.filterTitle')}
            onPress={handleFilter}
            showChevron={true}
          />
        </View>
      </AnimatedStep>
      <AnimatedStep active={step === 'filter'} direction={1} exitsBack={true}>
        <TxFilterHalfModal
          currentFilter={currentFilter}
          onSelectFilter={onSelectFilter}
          handleBackPressFunction={handleBackPressFunction}
          setContentHeight={setContentHeight}
          onBack={backToMenu}
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  menu: { marginTop: 14, ...CENTER },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
