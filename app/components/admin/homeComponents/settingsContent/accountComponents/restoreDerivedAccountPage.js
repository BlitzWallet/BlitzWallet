import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRestorableIndices } from '../../../../../functions/accounts/derivedAccounts';
import { useMemo, useState } from 'react';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import AccountCard from '../../accounts/accountCard';
import { CENTER, MAX_WEB_CONTENT_WIDTH, TYPE } from '../../../../../constants';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import { useTheme } from '../../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { FADE_TOP } from '../../../../../functions/CustomElements/redesign/TopFade';

export default function RestoreDerivedAccountPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { custodyAccounts, restoreDerivedAccount } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const { tokens } = useTheme();
  const { bottomPadding } = useGlobalInsets();
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

    if (isRestoring) return;
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
    const restoring = isRestoring === index;
    return (
      <AccountCard
        key={account.uuid}
        account={account}
        onPress={() => handleRestore(index)}
        showChevron={false}
        trailing={
          <ThemeText
            styles={[
              styles.restoreText,
              { color: restoring ? tokens.muted : tokens.link },
            ]}
            content={t(
              restoring
                ? 'settings.accountComponents.restoreDerivedAccount.restoringLabel'
                : 'settings.accountComponents.restoreDerivedAccount.restoreButton',
            )}
          />
        }
      />
    );
  };

  return (
    <GlobalThemeView
      edgeToEdge={restorableIndices.length > 0}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          fade={restorableIndices.length > 0}
          title={t('settings.accountComponents.restoreDerivedAccount.title')}
        />

        {restorableIndices.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              icon={'Users'}
              title={t(
                'settings.accountComponents.restoreDerivedAccount.emptyStateTitle',
              )}
              sub={t(
                'settings.accountComponents.restoreDerivedAccount.emptyStateMessage',
              )}
            />
          </View>
        ) : (
          <CustomScrollView
            contentContainerStyle={{
              paddingTop: FADE_TOP,
              paddingBottom: bottomPadding,
            }}
          >
            <ThemeText
              content={t(
                'settings.accountComponents.restoreDerivedAccount.subtitle',
              )}
              styles={[styles.subtitle, { color: tokens.muted }]}
            />
            <ListCard dividerInset={68}>
              {restorableElements.map(account =>
                renderAccountCard({ item: account }),
              )}
            </ListCard>
          </CustomScrollView>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
    ...TYPE.label,
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  restoreText: {
    ...TYPE.label,
    includeFontPadding: false,
  },
});
