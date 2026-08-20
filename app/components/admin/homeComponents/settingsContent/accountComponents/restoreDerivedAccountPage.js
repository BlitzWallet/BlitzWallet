import { FlatList, StyleSheet } from 'react-native';
import { GlobalThemeView } from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRestorableIndices } from '../../../../../functions/accounts/derivedAccounts';
import { useMemo, useState } from 'react';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import AccountCard from '../../accounts/accountCard';
import NoContentSceen from '../../../../../functions/CustomElements/noContentScreen';

export default function RestoreDerivedAccountPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { custodyAccounts, restoreDerivedAccount } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();

  const [isRestoring, setIsRestoring] = useState(0);

  const restorableIndices = getRestorableIndices(
    custodyAccounts,
    masterInfoObject.nextAccountDerivationIndex,
  );

  const restorableElements = useMemo(() => {
    return restorableIndices.map(index => ({
      uuid: `restorable-${index}`,
      name: t('accountCard.fallbackAccountName', { index }),
      derivationIndex: index,
    }));
  }, [restorableIndices, t]);

  const handleRestore = async index => {
    if (!index) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'settings.accountComponents.restoreDerivedAccount.errorMessage',
        ),
      });
      return;
    }

    setIsRestoring(index);

    try {
      const result = await restoreDerivedAccount(
        t('accountCard.fallbackAccountName', {
          index,
        }),
        index,
      );

      if (result.didWork) {
        // Navigate back to show the restored account
        navigate.popTo('SettingsContentHome', {
          for: 'Accounts',
          initialTab: 'personal',
        });
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage:
            result.error ||
            t('settings.accountComponents.restoreDerivedAccount.errorMessage'),
        });
      }
    } catch (err) {
      console.log('Restore error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'settings.accountComponents.restoreDerivedAccount.errorMessage',
        ),
      });
    } finally {
      setIsRestoring(0);
    }
  };

  const renderAccountCard = ({ item: account }) => {
    const index = account.derivationIndex;
    return (
      <AccountCard
        account={account}
        onPress={() => handleRestore(index)}
        isLoading={isRestoring === index}
        isAccountSwitching={isRestoring === index}
      />
    );
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.accountComponents.restoreDerivedAccount.title')}
      />

      {restorableIndices.length === 0 ? (
        <NoContentSceen
          iconName="Users"
          titleText={t(
            'settings.accountComponents.restoreDerivedAccount.emptyStateTitle',
          )}
          subTitleText={t(
            'settings.accountComponents.restoreDerivedAccount.emptyStateMessage',
          )}
        />
      ) : (
        <FlatList
          data={restorableElements}
          renderItem={renderAccountCard}
          keyExtractor={item => `restorable-${item.derivationIndex}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
});
