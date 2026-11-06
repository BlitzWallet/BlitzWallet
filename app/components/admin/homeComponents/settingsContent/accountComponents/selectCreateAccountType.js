import { GlobalThemeView } from '../../../../../functions/CustomElements';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRestorableIndices } from '../../../../../functions/accounts/derivedAccounts';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

export default function SelectCreateAccountType() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { custodyAccounts } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const restorableIndices = getRestorableIndices(
    custodyAccounts,
    masterInfoObject.nextAccountDerivationIndex,
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('settings.accounts.tabs.personal')} />
        <ListCard style={{ marginTop: 20 }}>
          <ListRow
            onPress={() => navigate.navigate('CreateCustodyAccount')}
            lead={<Disc icon={'Plus'} />}
            title={t(
              'settings.accountComponents.selectCreateAccountType.createNewAccountTitle',
            )}
            sub={t(
              'settings.accountComponents.selectCreateAccountType.createNewAccountDescription',
            )}
            titleStyle={styles.rowTitle}
            minHeight={64}
            showChevron={true}
          />
        </ListCard>
        <ListCard style={{ marginTop: 10 }}>
          <ListRow
            onPress={() => {
              if (!restorableIndices.length) return;
              navigate.navigate('RestoreDerivedAccount');
            }}
            lead={<Disc icon={'RotateCcw'} />}
            title={t(
              'settings.accountComponents.selectCreateAccountType.recoverRecoveryPhraseTitle',
            )}
            sub={t(
              'settings.accountComponents.selectCreateAccountType.recoverRecoveryPhraseDescription',
            )}
            titleStyle={styles.rowTitle}
            minHeight={64}
            showChevron={true}
            tone={!restorableIndices.length ? 'hidden' : 'regular'}
          />
        </ListCard>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
