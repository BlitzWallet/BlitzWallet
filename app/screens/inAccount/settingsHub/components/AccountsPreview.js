import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import AccountCard from '../../../../components/admin/homeComponents/accounts/accountCard';
import { SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import {
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../../../../context-store/activeAccount';
import WidgetCard from './WidgetCard';

export default function AccountsPreview({
  pinnedAccountUUIDs,
  isUsingNostr,
  selectedAltAccount,
  isSwitchingAccount,
  onAccountPress,
  onAccountEdit,
  onViewAll,
  onLongPress,
}) {
  const { t } = useTranslation();
  const { custodyAccountsList, activeAccount } = useActiveCustodyAccount();
  const accountList = custodyAccountsList || [];
  const displayAccounts = getDisplayAccounts(
    accountList,
    pinnedAccountUUIDs,
    isUsingNostr,
    selectedAltAccount?.[0],
    activeAccount,
  );

  const hasMoreAccounts = accountList.length > displayAccounts.length;

  return (
    <WidgetCard onPress={onViewAll} onLongPress={onLongPress}>
      {/* Header becomes just visual */}
      <View style={styles.header}>
        <ThemeText
          styles={styles.headerTitle}
          content={t('settings.hub.accounts')}
        />
        <ThemeText
          styles={styles.viewAll}
          content={t('settings.hub.viewAll')}
        />
      </View>

      <View pointerEvents="box-none">
        {displayAccounts.map((account, index) => (
          <AccountCard
            key={account.uuid || `account-${index}`}
            account={account}
            isActive={activeAccount.uuid === account.uuid}
            onPress={() => onAccountPress(account)}
            onEdit={() => onAccountEdit(account)}
            isLoading={
              isSwitchingAccount.accountBeingLoaded ===
                (account.uuid || account.name) && isSwitchingAccount.isLoading
            }
            fromSettings
            isAccountSwitching={isSwitchingAccount.isLoading}
          />
        ))}
      </View>

      {hasMoreAccounts && (
        <ThemeText
          styles={styles.moreText}
          content={t('settings.hub.morePoolsCount', {
            count: accountList.length - displayAccounts.length,
          })}
        />
      )}
    </WidgetCard>
  );
}

function getDisplayAccounts(
  accounts,
  pinnedAccountUUIDs,
  isUsingNostr,
  activeAltAccount,
) {
  if (!accounts?.length) return [];

  const mainAccount = accounts.find(a => a.uuid === MAIN_ACCOUNT_UUID);
  const nwcAccount = accounts.find(a => a.uuid === NWC_ACCOUNT_UUID);

  const activeAccount =
    accounts.find(account => {
      const isMain = account.uuid === MAIN_ACCOUNT_UUID;
      const isNWC = account.uuid === NWC_ACCOUNT_UUID;

      if (isNWC) return isUsingNostr;
      if (isMain) return !activeAltAccount && !isUsingNostr;

      return activeAltAccount?.uuid === account.uuid;
    }) ||
    mainAccount ||
    accounts[0];

  const result = [];
  const used = new Set();

  const add = account => {
    if (!account) return;
    if (used.has(account.uuid)) return;
    used.add(account.uuid);
    result.push(account);
  };

  add(mainAccount);

  if (activeAccount.uuid !== MAIN_ACCOUNT_UUID) {
    add(activeAccount);
  }

  if (pinnedAccountUUIDs?.length) {
    const pinnedAccounts = pinnedAccountUUIDs
      .map(uuid => accounts.find(a => (a.uuid || a.name) === uuid))
      .filter(Boolean);

    for (const acc of pinnedAccounts) {
      add(acc);
    }
  }

  if (!pinnedAccountUUIDs?.length) {
    for (const acc of accounts) {
      add(acc);
    }
  }

  return result.slice(0, 3);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  viewAll: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
  },
  moreText: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 4,
    includeFontPadding: false,
  },
});
