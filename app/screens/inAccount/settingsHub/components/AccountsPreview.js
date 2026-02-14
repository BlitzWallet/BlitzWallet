import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import AccountCard from '../../../../components/admin/homeComponents/accounts/accountCard';
import GetThemeColors from '../../../../hooks/themeColors';
import { SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import {
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../../../../context-store/activeAccount';

export default function AccountsPreview({
  accounts,
  pinnedAccountUUIDs,
  isUsingNostr,
  selectedAltAccount,
  isSwitchingAccount,
  onAccountPress,
  onAccountEdit,
  onViewAll,
}) {
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const { custodyAccountsList, activeAccount } = useActiveCustodyAccount();
  const displayAccounts = getDisplayAccounts(
    custodyAccountsList,
    pinnedAccountUUIDs,
    isUsingNostr,
    selectedAltAccount[0],
    activeAccount,
  );

  const hasMoreAccounts = custodyAccountsList?.length > displayAccounts?.length;

  return (
    <Pressable
      onPress={onViewAll}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: backgroundOffset },
        pressed && styles.pressed,
      ]}
    >
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
          />
        ))}
      </View>

      {hasMoreAccounts && (
        <ThemeText
          styles={styles.moreText}
          content={t('settings.hub.morePoolsCount', {
            count: custodyAccountsList?.length - displayAccounts?.length,
          })}
        />
      )}
    </Pressable>
  );
}

function getDisplayAccounts(
  accounts,
  pinnedAccountUUIDs,
  isUsingNostr,
  activeAltAccount,
) {
  const mainIndex = accounts.findIndex(a => a.uuid === MAIN_ACCOUNT_UUID);

  const orderedAccounts =
    mainIndex > 0
      ? [
          accounts[mainIndex],
          ...accounts.slice(0, mainIndex),
          ...accounts.slice(mainIndex + 1),
        ]
      : accounts;

  const mainAccount = orderedAccounts[0];

  if (pinnedAccountUUIDs?.length) {
    const pinned = pinnedAccountUUIDs
      .map(uuid => orderedAccounts.find(a => (a.uuid || a.name) === uuid))
      .filter(Boolean)
      .filter(a => a.uuid !== MAIN_ACCOUNT_UUID);

    if (pinned.length) {
      return [mainAccount, ...pinned.slice(0, 2)];
    }
  }

  const activeIndex = orderedAccounts.findIndex(account => {
    const isMainWallet = account.uuid === MAIN_ACCOUNT_UUID;
    const isNWC = account.uuid === NWC_ACCOUNT_UUID;

    return isNWC
      ? isUsingNostr
      : isMainWallet
      ? !activeAltAccount && !isUsingNostr
      : activeAltAccount?.uuid === account.uuid;
  });

  const active =
    activeIndex >= 0 ? orderedAccounts[activeIndex] : orderedAccounts[0];

  const next = orderedAccounts.find((_, i) => i !== activeIndex);

  const result = [active, next].filter(Boolean);

  if (result[0]?.uuid !== MAIN_ACCOUNT_UUID) {
    return [
      mainAccount,
      ...result.filter(a => a.uuid !== MAIN_ACCOUNT_UUID),
    ].slice(0, 2);
  }

  return result.slice(0, 2);
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 12,
  },
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
  pressed: {
    opacity: 0.7,
  },
});
