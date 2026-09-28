import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import AccountProfileImage from '../../../../components/admin/homeComponents/accounts/accountProfileImage';
import {
  BASIC_ACCOUNT_NAME_REGEX,
  COLORS,
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
  SIZES,
} from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import WidgetCard from './WidgetCard';

export default function AccountsPreview({ onViewAll }) {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { custodyAccountsList } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const accountList = [
    ...(custodyAccountsList || []),
    ...(masterInfoObject?.childAccounts || []),
  ];
  const displayAccounts = accountList.slice(0, 4);

  const hasMoreAccounts = accountList.length > displayAccounts.length;

  if (accountList.length === 1) {
    return (
      <WidgetCard onPress={onViewAll}>
        <View style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.header, { marginBottom: 0 }]}>
              <ThemeText
                styles={styles.headerTitle}
                content={t('settings.hub.accounts')}
              />
            </View>

            <ThemeText
              styles={styles.rateText}
              content={t('settings.hub.accountsEmptyDesc')}
            />
          </View>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor:
                  theme && darkModeType
                    ? darkModeType
                      ? backgroundColor
                      : backgroundOffset
                    : COLORS.primary,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={COLORS.darkModeText}
              iconName={'Users'}
              size={22}
            />
          </View>
        </View>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard onPress={onViewAll}>
      <View style={styles.header}>
        <ThemeText
          styles={styles.headerTitle}
          content={t('settings.hub.accounts')}
        />
        {hasMoreAccounts && (
          <ThemeText
            styles={styles.viewAll}
            content={t('settings.hub.viewAll')}
          />
        )}
      </View>

      <View style={styles.gridContainer}>
        {displayAccounts.map((account, index) => {
          const accountIndex =
            account.uuid === MAIN_ACCOUNT_UUID
              ? 1
              : account.uuid === NWC_ACCOUNT_UUID
              ? 2
              : account.derivationIndex;
          const displayName = !BASIC_ACCOUNT_NAME_REGEX.test(account.name)
            ? account.name
            : t('accountCard.fallbackAccountName', { index: accountIndex });

          return (
            <View
              key={account.uuid || `account-${index}`}
              style={styles.avatarWrapper}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor }]}>
                  <AccountProfileImage imageSize={52} account={account} />
                </View>
              </View>
              <ThemeText
                CustomNumberOfLines={1}
                CustomEllipsizeMode="tail"
                styles={styles.avatarName}
                content={displayName}
              />
            </View>
          );
        })}
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  avatarWrapper: {
    width: '25%',
    alignItems: 'center',
  },
  avatarContainer: {
    width: '100%',
    maxWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '70%',
    // height: 52,
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: {
    width: '85%',
    fontSize: SIZES.small,
    textAlign: 'center',
    flexShrink: 1,
    marginTop: 6,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  left: {
    flexShrink: 1,
  },
  rateText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
