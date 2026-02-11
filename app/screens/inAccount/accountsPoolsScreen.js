import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../constants';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { usePools } from '../../../context-store/poolContext';
import AccountCard from '../../components/admin/homeComponents/accounts/accountCard';
import useCustodyAccountList from '../../hooks/useCustodyAccountsList';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import CircularProgress from '../../components/admin/homeComponents/pools/circularProgress';
import CustomButton from '../../functions/CustomElements/button';
import AccountProfileImage from '../../components/admin/homeComponents/accounts/accountProfileImage';
import { initWallet } from '../../functions/initiateWalletConnection';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ManageAccountsPoolsScreen() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { setSparkInformation } = useSparkWallet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { activePoolsArray, poolsArray } = usePools();
  const accounts = useCustodyAccountList();
  const {
    currentWalletMnemoinc,
    selectedAltAccount,
    getAccountMnemonic,
    updateAccountCacheOnly,
    toggleIsUsingNostr,
    isUsingNostr,
  } = useActiveCustodyAccount();
  const [isSwitchingAccount, setISwitchingAccount] = useState({
    accountBeingLoaded: '',
    isLoading: '',
  });

  const handleSettingsNavigation = useCallback(() => {
    navigate.navigate('SettingsHome', {});
  }, []);

  const handleProfileNavigation = useCallback(() => {
    navigate.navigate('ShowProfileQrSlideRight', {});
  }, []);

  const handleViewAllPools = useCallback(() => {
    navigate.navigate('SettingsContentHome', {
      for: 'pools',
    });
  }, []);

  const handleNavigateError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', { errorMessage });
    },
    [navigate],
  );

  const handleAccountPress = useCallback(
    async account => {
      try {
        const accountMnemonic = await getAccountMnemonic(account);
        if (currentWalletMnemoinc === accountMnemonic) return;

        setISwitchingAccount({
          accountBeingLoaded: account.uuid || account.name,
          isLoading: true,
        });

        await new Promise(resolve => setTimeout(resolve, 250));

        const initResponse = await initWallet({
          setSparkInformation,
          mnemonic: accountMnemonic,
        });

        if (!initResponse.didWork) {
          handleNavigateError(initResponse.error);
          return;
        }

        const isMainWallet = account.name === 'Main Wallet';
        const isNWC = account.name === 'NWC';

        if (isMainWallet || isNWC) {
          if (selectedAltAccount[0]) {
            await updateAccountCacheOnly({
              ...selectedAltAccount[0],
              isActive: false,
            });
          }
          toggleIsUsingNostr(isNWC);
        } else {
          await updateAccountCacheOnly({ ...account, isActive: true });
          toggleIsUsingNostr(false);
        }
      } catch (error) {
        handleNavigateError(error.message || 'An error occurred');
      } finally {
        setISwitchingAccount({
          accountBeingLoaded: '',
          isLoading: false,
        });
      }
    },
    [currentWalletMnemoinc, selectedAltAccount],
  );

  const handleAccountEdit = useCallback(account => {
    navigate.navigate('EditAccountPage', { account });
  }, []);

  const handleAddAccount = useCallback(() => {
    navigate.navigate('SelectCreateAccountType', {});
  }, []);

  // Show max 2 pools
  const displayedPools = activePoolsArray.slice(0, 2);
  const hasMorePools = activePoolsArray.length > 2;
  const remainingPoolsCount = activePoolsArray.length - 2;

  const activeAccount = accounts.find(
    item => currentWalletMnemoinc === item.mnemoinc || item.isActive,
  );
  const activeAltAccount = selectedAltAccount[0];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={navigate.goBack}>
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>
        <View style={styles.accountContainer}>
          <View
            style={{
              alignItems: 'flex-end',
            }}
          >
            <ThemeText
              styles={styles.accountName}
              content={activeAccount?.name || ''}
            />
            <ThemeText
              styles={styles.accountType}
              content={activeAccount?.accountType || ''}
            />
          </View>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundOffset,
              },
            ]}
          >
            <AccountProfileImage imageSize={40} account={activeAccount} />
          </View>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Profile and Settings Buttons */}
        <View style={styles.settingsContainer}>
          <TouchableOpacity
            onPress={handleProfileNavigation}
            style={[
              styles.settingsItem,
              {
                backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              },
            ]}
          >
            <ThemeIcon iconName={'User'} />
            <ThemeText
              styles={styles.settingsText}
              content={t('settings.accountsPoolsScreen.profileButton')}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSettingsNavigation}
            style={[
              styles.settingsItem,
              {
                backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              },
            ]}
          >
            <ThemeIcon iconName={'Settings'} />
            <ThemeText
              styles={styles.settingsText}
              content={t('settings.accountsPoolsScreen.settingsButton')}
            />
          </TouchableOpacity>
        </View>

        {/* Pools Section */}

        <TouchableOpacity
          onPress={handleViewAllPools}
          activeOpacity={1}
          style={[
            styles.section,
            {
              gap: 6,
              backgroundColor: backgroundOffset,
            },
          ]}
        >
          <ThemeText
            styles={styles.sectionTitle}
            content={t('settings.accountsPoolsScreen.poolsTitle')}
          />
          {activePoolsArray.length > 0 ? (
            <>
              {displayedPools.map(pool => (
                <View
                  key={pool.poolId}
                  style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}
                >
                  <CircularProgress
                    current={pool.currentAmount}
                    goal={pool.goalAmount}
                    size={25}
                    strokeWidth={3}
                    showPercentage={false}
                  />
                  <ThemeText
                    styles={{ fontSize: SIZES.large, fontWeight: 500 }}
                    content={pool.poolTitle}
                  />
                </View>
              ))}
              {hasMorePools && (
                <ThemeText
                  styles={styles.viewAllText}
                  content={`+${remainingPoolsCount} more`}
                />
              )}
            </>
          ) : (
            <ThemeText
              content={
                !poolsArray.length
                  ? t('settings.accountsPoolsScreen.noPoolsMessage')
                  : t('settings.accountsPoolsScreen.noActivePools')
              }
            />
          )}
        </TouchableOpacity>

        {/* Accounts Section */}
        <View
          style={[
            styles.section,
            {
              gap: 0,
              padding: 0,
            },
          ]}
        >
          <ThemeText
            styles={[styles.sectionTitle]}
            content={t('settings.accountsPoolsScreen.yourAccountsTitle')}
          />
          {accounts.map((account, index) => {
            const isMainWallet = account.name === 'Main Wallet';
            const isNWC = account.name === 'NWC';
            const isActive = isNWC
              ? isUsingNostr
              : isMainWallet
              ? !activeAltAccount && !isUsingNostr
              : activeAltAccount?.uuid === account.uuid;
            return (
              <AccountCard
                key={account.uuid || `account-${index}`}
                account={account}
                isActive={isActive}
                onPress={() => handleAccountPress(account)}
                onEdit={() => handleAccountEdit(account)}
                isLoading={
                  isSwitchingAccount.accountBeingLoaded ===
                    (account.uuid || account.name) &&
                  isSwitchingAccount.isLoading
                }
              />
            );
          })}
        </View>
      </ScrollView>
      {/* Add Account Button */}
      <CustomButton
        actionFunction={handleAddAccount}
        buttonStyles={{
          backgroundColor: theme ? backgroundOffset : COLORS.primary,
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
        }}
        textStyles={styles.addAccountText}
        textContent={t('settings.accountsPoolsScreen.addAccountButton')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  topbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    marginBottom: 10,
    minHeight: 30,
  },
  accountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  accountName: {
    fontSize: SIZES.smedium,
    lineHeight: SIZES.smedium + 2,
    includeFontPadding: false,
    textAlign: 'right',
  },
  accountType: {
    fontSize: SIZES.xSmall,
    lineHeight: SIZES.xSmall + 2,
    includeFontPadding: false,
    opacity: HIDDEN_OPACITY,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    gap: 20,
    flexGrow: 1,
    paddingTop: 30,
    paddingBottom: 20,
    alignItems: 'center',
  },
  profileImage: {
    position: 'relative',
    width: 35,
    height: 35,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsContainer: { flexDirection: 'row', gap: 10 },
  settingsItem: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  settingsText: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
  },
  section: {
    width: '100%',
    gap: 12,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontWeight: '500',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  viewAllText: {
    fontSize: SIZES.small,
    opacity: 0.7,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  addAccountText: {
    fontSize: SIZES.medium,
    fontWeight: '500',
    color: COLORS.darkModeText,
  },
});
