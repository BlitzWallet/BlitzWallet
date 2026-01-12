import React, { useState, useCallback, useMemo } from 'react';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { initWallet } from '../../../../functions/initiateWalletConnection';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import useCustodyAccountList from '../../../../hooks/useCustodyAccountsList';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../context-store/webViewContext';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

const AccountRow = React.memo(
  ({
    account,
    theme,
    darkModeType,
    textColor,
    currentWalletMnemoinc,
    isLoading,
    expandedAccount,
    onToggleExpand,
    onNavigateView,
    onNavigateEdit,
    onSelectAccount,
    t,
  }) => {
    const isMainWallet = account.name === 'Main Wallet';
    const isNWC = account.name === 'NWC';
    const isSpecialAccount = isMainWallet;
    const isActive = currentWalletMnemoinc === account.mnemoinc;
    const isAccountLoading =
      isLoading.accountBeingLoaded === account.mnemoinc && isLoading.isLoading;
    const isExpanded = expandedAccount === account.mnemoinc;

    const expandHeight = useSharedValue(0);
    const chevronRotation = useSharedValue(0);

    React.useEffect(() => {
      expandHeight.value = withTiming(isExpanded ? 1 : 0, {
        stiffness: 300,
      });
      chevronRotation.value = withTiming(isExpanded ? 1 : 0, {
        duration: 200,
      });
    }, [isExpanded]);

    const expandedStyle = useAnimatedStyle(() => ({
      height: expandHeight.value * (50 * (isNWC ? 1 : 2)),
      opacity: expandHeight.value,
    }));

    const chevronStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
    }));

    return (
      <View style={styles.row}>
        <View style={styles.fullRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.rowTouchable}
            onPress={() => {
              if (isActive && !isSpecialAccount) {
                onToggleExpand(account.mnemoinc);
              } else if (!isActive) {
                onSelectAccount(account);
              }
            }}
          >
            <View style={styles.rowContent}>
              <View style={styles.leftSection}>
                {isActive && (
                  <View
                    style={[
                      styles.activeDot,
                      {
                        backgroundColor:
                          theme && darkModeType ? COLORS.white : COLORS.primary,
                      },
                    ]}
                  />
                )}
                <View>
                  <ThemeText
                    styles={[styles.accountText, isActive && styles.activeText]}
                    content={
                      account.name === 'Main Wallet'
                        ? t('settings.accounts.mainWalletPlace')
                        : account.name
                    }
                  />
                  {isActive && (
                    <ThemeText
                      styles={[styles.activeTextFlag]}
                      content={t('constants.active')}
                    />
                  )}
                </View>
              </View>

              <View style={styles.rightSection}>
                {isActive && !isSpecialAccount && (
                  <Animated.View style={chevronStyle}>
                    <ThemeIcon size={25} iconName={'ChevronDown'} />
                  </Animated.View>
                )}

                {!isActive && !isAccountLoading && (
                  <ThemeText
                    styles={[styles.selectText, { color: textColor }]}
                    content={t('constants.select')}
                  />
                )}

                {isAccountLoading && (
                  <FullLoadingScreen
                    showText={false}
                    size="small"
                    containerStyles={{ flex: 0 }}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
          {!isActive && !isSpecialAccount && (
            <TouchableOpacity
              style={styles.expandIcon}
              onPress={() => {
                if (!isSpecialAccount) {
                  onToggleExpand(account.mnemoinc);
                }
              }}
            >
              <ThemeIcon iconName={'Menu'} />
            </TouchableOpacity>
          )}
        </View>

        {!isSpecialAccount && (
          <Animated.View style={[styles.expanded, expandedStyle]}>
            <TouchableOpacity
              style={styles.expandedAction}
              onPress={() => onNavigateView(account)}
            >
              <ThemeIcon
                size={16}
                styles={styles.actionIcon}
                iconName={'Lock'}
              />
              <ThemeText
                styles={styles.actionText}
                content={t('settings.accountComponents.homepage.viewSeed')}
              />
            </TouchableOpacity>

            {!isNWC && (
              <TouchableOpacity
                style={styles.expandedAction}
                onPress={() => onNavigateEdit(account)}
              >
                <ThemeIcon
                  size={16}
                  styles={styles.actionIcon}
                  iconName={'Settings'}
                />
                <ThemeText
                  styles={styles.actionText}
                  content={t('settings.accountComponents.homepage.editAccount')}
                />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        <View style={[styles.divider, { backgroundColor: textColor }]} />
      </View>
    );
  },
);

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const {
    selectedAltAccount,
    updateAccountCacheOnly,
    currentWalletMnemoinc,
    toggleIsUsingNostr,
  } = useActiveCustodyAccount();
  const { setSparkInformation } = useSparkWallet();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: false,
  });
  const { t } = useTranslation();
  const accounts = useCustodyAccountList();
  const { sendWebViewRequest } = useWebView();

  const filteredAccounts = useMemo(() => {
    if (!searchInput.trim()) return accounts;
    const searchTerm = searchInput.toLowerCase();
    return accounts.filter(account =>
      account.name?.toLowerCase()?.includes(searchTerm),
    );
  }, [accounts, searchInput]);

  const handleToggleExpand = useCallback(mnemonic => {
    setExpandedAccount(prev => (prev === mnemonic ? null : mnemonic));
  }, []);

  const handleNavigateView = useCallback(
    account => {
      navigate.navigate('ViewCustodyAccount', { account });
    },
    [navigate],
  );

  const handleNavigateEdit = useCallback(
    account => {
      navigate.navigate('CreateCustodyAccount', { account });
    },
    [navigate],
  );

  const handleNavigateError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', { errorMessage });
    },
    [navigate],
  );

  const handleNavigateAddAccount = useCallback(() => {
    navigate.navigate('CreateCustodyAccount', {});
  }, [navigate]);

  const handleNavigateSwap = useCallback(() => {
    console.log(accounts);
    if (accounts.length < 2) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.accountComponents.homepage.swapAccountError'),
      });
      return;
    }

    navigate.navigate('CustodyAccountPaymentPage');
  }, [navigate, accounts]);

  const handleSelectAccount = useCallback(
    async account => {
      if (currentWalletMnemoinc === account.mnemoinc) return;

      setIsLoading({
        accountBeingLoaded: account.mnemoinc,
        isLoading: true,
      });

      try {
        await new Promise(resolve => setTimeout(resolve, 250));

        const initResponse = await initWallet({
          setSparkInformation,
          mnemonic: account.mnemoinc,
          sendWebViewRequest,
        });

        if (!initResponse.didWork) {
          handleNavigateError(initResponse.error);
          return;
        }

        const isMainWallet = account.name === 'Main Wallet';
        const isNWC = account.name === 'NWC';

        if (isMainWallet || isNWC) {
          await updateAccountCacheOnly({
            ...selectedAltAccount[0],
            isActive: false,
          });
          toggleIsUsingNostr(isNWC);
        } else {
          await updateAccountCacheOnly({ ...account, isActive: true });
          toggleIsUsingNostr(false);
        }
      } catch (error) {
        handleNavigateError(error.message || 'An error occurred');
      } finally {
        setIsLoading({
          accountBeingLoaded: '',
          isLoading: false,
        });
      }
    },
    [
      currentWalletMnemoinc,
      setSparkInformation,
      selectedAltAccount,
      updateAccountCacheOnly,
      toggleIsUsingNostr,
      handleNavigateError,
      sendWebViewRequest,
    ],
  );

  const accountElements = useMemo(() => {
    return filteredAccounts.map((account, index) => (
      <AccountRow
        key={`${account.mnemoinc}-${index}`}
        account={account}
        theme={theme}
        darkModeType={darkModeType}
        textColor={textColor}
        currentWalletMnemoinc={currentWalletMnemoinc}
        isLoading={isLoading}
        expandedAccount={expandedAccount}
        onToggleExpand={handleToggleExpand}
        onNavigateView={handleNavigateView}
        onNavigateEdit={handleNavigateEdit}
        onSelectAccount={handleSelectAccount}
        t={t}
      />
    ));
  }, [
    filteredAccounts,
    theme,
    textColor,
    currentWalletMnemoinc,
    isLoading,
    expandedAccount,
    handleToggleExpand,
    handleNavigateView,
    handleNavigateEdit,
    handleSelectAccount,
    t,
  ]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('constants.accounts')} />

      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor }}>
          <CustomSearchInput
            containerStyles={{
              backgroundColor,
              marginBottom: 20,
            }}
            inputText={searchInput}
            setInputText={setSearchInput}
            placeholderText={t('settings.accounts.inputPlaceholder')}
          />

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundOffset : COLORS.primary,
                },
              ]}
              onPress={handleNavigateSwap}
            >
              <ThemeIcon
                size={20}
                colorOverride={COLORS.darkModeText}
                iconName={'ArrowUpDown'}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.actionButtonText}
                content={t('settings.accountComponents.homepage.swap')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundOffset : COLORS.primary,
                },
              ]}
              onPress={handleNavigateAddAccount}
            >
              <ThemeIcon
                colorOverride={COLORS.darkModeText}
                size={20}
                iconName={'Plus'}
              />
              <ThemeText
                styles={styles.actionButtonText}
                CustomNumberOfLines={1}
                content={t('settings.accountComponents.homepage.addNewAccount')}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listContainer}>
          {accountElements.length > 0 ? (
            accountElements
          ) : (
            <View style={styles.empty}>
              <ThemeText
                styles={styles.emptyText}
                content={t(
                  'settings.accountComponents.homepage.noAccountsFound',
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: MAX_CONTENT_WIDTH,
    ...CENTER,
    paddingTop: 20,
  },
  listContainer: {
    width: '100%',
    paddingTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 12,
    ...CENTER,
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
  actionButton: {
    flex: 1,
    width: '100%',
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    borderRadius: 8,
  },
  actionButtonIcon: {
    width: 20,
    height: 20,
  },
  actionButtonText: {
    fontWeight: '500',
    color: COLORS.darkModeText,
    includeFontPadding: false,
    flexShrink: 1,
  },
  row: {
    width: '100%',
    paddingVertical: 4,
  },
  fullRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTouchable: {
    width: '100%',
    flexShrink: 1,
    marginRight: 10,
    paddingVertical: 18,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  accountText: {
    fontSize: 16,
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  activeText: {
    fontWeight: '500',
  },
  activeTextFlag: {
    fontSize: SIZES.small,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  // expandIcon: { paddingHorizontal: 5 },
  chevron: {
    width: 25,
    height: 25,
    transform: [{ rotate: '-90deg' }],
  },
  selectText: {
    fontSize: 14,
    opacity: 0.7,
    includeFontPadding: false,
  },
  expanded: {
    overflow: 'hidden',
    paddingLeft: 18,
  },
  expandedAction: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIcon: {
    opacity: 0.9,
  },
  actionText: {
    includeFontPadding: false,
    opacity: 0.8,
  },
  divider: {
    height: 2,
    width: '100%',
    opacity: 0.1,
    borderRadius: 100,
    marginTop: 4,
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.3,
  },
});
