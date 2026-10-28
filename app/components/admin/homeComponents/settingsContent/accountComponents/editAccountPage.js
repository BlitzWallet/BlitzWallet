import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { SIZES } from '../../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { deriveChildMnemonic } from '../../../../../functions/accounts/childAccounts';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AccountProfileImage from '../../accounts/accountProfileImage';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import {
  CENTER,
  MAIN_ACCOUNT_UUID,
  MAX_WEB_CONTENT_WIDTH,
  NWC_ACCOUNT_UUID,
} from '../../../../../constants';
import { formatBalanceAmount } from '../../../../../functions';
import {
  disposeSparkWallet,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} from '../../../../../functions/spark';
import { subscribeToSparkBalance } from '../../../../../functions/spark/awaitBalanceChange';
import {
  getAccountBalanceSnapshot,
  getUsdTokenDollars,
  saveAccountBalanceSnapshot,
} from '../../../../../functions/spark/balanceSnapshots';
import AdaptiveButtonRow from '../../../../../functions/CustomElements/adaptiveButtonRow';
import PagerView from 'react-native-pager-view';
import Animated, {
  useEvent,
  useHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { BalanceDots } from '../../homeLightning/balanceDots';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

// Custom hook for PagerView scroll handler
function usePagerScrollHandler(handlers, dependencies) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent(
    event => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer,
  );
}

// The NWC account page is never gated: its balance and Add / Withdraw must stay
// reachable without push. The notifications gate lives on the connections page
// (NosterWalletConnect) and the NWC-08 approval sheet instead.
export default function EditAccountPage(props) {
  const accountId = props?.route?.params?.accountId;
  const fromPage = props?.route?.params?.from;
  const { getAccountMnemonic, activeAccount, custodyAccountsList } =
    useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { globalContactsInformation } = useGlobalContacts();
  const { tokens } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();

  const isMainAccountAChild = masterInfoObject.isChildAccount;

  const accountInformation = useMemo(() => {
    const childAccount = (masterInfoObject?.childAccounts || []).find(
      item => item.uuid === accountId,
    );
    if (childAccount) return childAccount;
    return custodyAccountsList?.find(item => item.uuid === accountId) || {};
  }, [custodyAccountsList, masterInfoObject?.childAccounts, accountId]);

  const selectedAccount = accountInformation;

  // Linked (child) accounts live in masterInfoObject.childAccounts, not the
  // custody store, and derive their seed from childIndex.
  const isChild = selectedAccount?.childIndex !== undefined;

  const isActive = activeAccount.uuid === accountInformation.uuid;

  // Per-account Lightning address, once the registry sync has published this
  // account's entry (main/child accounts have no entry → no row).
  const lnurlAddress = useMemo(() => {
    const uniqueName = globalContactsInformation?.myProfile?.uniqueName;
    if (!uniqueName) return null; // no profile name yet → hide the row
    const entry = Object.entries(masterInfoObject.accountsLnurl || {}).find(
      ([, v]) => v.uuid === accountInformation.uuid,
    );
    if (!entry) return `${uniqueName}@blitzwalletapp.com`;
    return `${uniqueName}-${entry[0]}@blitzwalletapp.com`;
  }, [
    globalContactsInformation,
    masterInfoObject.accountsLnurl,
    accountInformation.uuid,
  ]);

  const username = lnurlAddress?.split('@')?.[0];

  const navigate = useNavigation();

  const [accountBalance, setAccountBalance] = useState({
    status: 'connecting', // 'connecting' | 'connected' | 'error'
    balance: 0,
    tokensObj: null,
  });
  const subscriptionRef = useRef(null);
  const mnemonicRef = useRef(null);
  const pubkeyRef = useRef(null);
  const initPromiseRef = useRef(null);
  const paintedFromSnapshotRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showSlowConnectUI, setShowSlowConnectUI] = useState(false);

  useEffect(() => {
    if (isActive) return; // active account uses live context (below)
    let cancelled = false;
    paintedFromSnapshotRef.current = false;

    (async () => {
      try {
        setAccountBalance(prev => ({ ...prev, status: 'connecting' }));
        const mnemonic = isChild
          ? await deriveChildMnemonic(
              accountMnemoinc,
              accountInformation.childIndex,
            )
          : await getAccountMnemonic(accountInformation);
        if (cancelled) return;
        mnemonicRef.current = mnemonic;

        // Instant paint: if a cached snapshot exists for this account's pubkey,
        // seed the balance immediately so the pager renders (and the mascot
        // loader is skipped) while the live wallet initializes in the background.
        const pubkey = await getSparkIdentityPubKey(mnemonic);
        if (cancelled) return;
        if (pubkey) {
          pubkeyRef.current = pubkey;
          const snapshot = await getAccountBalanceSnapshot(pubkey);
          if (cancelled) return;
          if (snapshot) {
            paintedFromSnapshotRef.current = true;
            setAccountBalance({
              status: 'connecting',
              balance: snapshot.balance,
              tokensObj: snapshot.tokens,
            });
          }
        }

        const initRes = await (initPromiseRef.current = initializeSparkWallet(
          mnemonic,
          false,
          {
            maxRetries: 4,
            shouldCancel: () => cancelled,
          },
        ));
        if (cancelled) return;
        if (!initRes?.isConnected && !paintedFromSnapshotRef.current) {
          setAccountBalance(p => ({ ...p, status: 'error' }));
          return;
        }

        subscriptionRef.current = subscribeToSparkBalance({
          mnemonic,
          stabilize: true,
          onUpdate: result => {
            if (cancelled || !result?.didWork) return;
            setAccountBalance({
              status: 'connected',
              balance: Number(result.balance || 0),
              tokensObj: result.tokensObj || null,
            });
            if (pubkeyRef.current) {
              saveAccountBalanceSnapshot(
                pubkeyRef.current,
                Number(result.balance || 0),
                result.tokensObj || null,
              );
            }
          },
        });
      } catch (err) {
        console.log('load account balance error', err);
        if (!cancelled && !paintedFromSnapshotRef.current) {
          setAccountBalance(p => ({ ...p, status: 'error' }));
        }
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      // Await the in-flight init before disposing so we dispose the wallet init
      // actually created (a pre-init dispose is a no-op). Never dispose when the
      // account's mnemonic is the main seed — that wallet is session-long.
      const m = mnemonicRef.current;
      if (m && m !== accountMnemoinc) {
        Promise.resolve(initPromiseRef.current).finally(() =>
          disposeSparkWallet(m),
        );
      }
      initPromiseRef.current = null;
      mnemonicRef.current = null;
      pubkeyRef.current = null;
    };
  }, [isActive, accountInformation.uuid, isChild, accountMnemoinc, reloadKey]);

  const isConnecting = isActive
    ? false
    : accountBalance.status === 'connecting';

  // Fast connects keep the blocking loader; past 5s we surface the account
  // screen instead (with an hourglass indicator) so pairing/LNURL/etc. stay
  // usable while the wallet finishes initializing in the background.
  useEffect(() => {
    if (!isConnecting) {
      setShowSlowConnectUI(false);
      return;
    }
    const timeout = setTimeout(() => setShowSlowConnectUI(true), 5000);
    return () => clearTimeout(timeout);
  }, [isConnecting]);
  const btcBalance = isActive
    ? Number(sparkInformation?.balance || 0)
    : accountBalance.balance;
  const tokensObj = isActive
    ? sparkInformation?.tokens
    : accountBalance.tokensObj;

  const dollarBalance = getUsdTokenDollars(tokensObj);

  // Withdrawals move BTC *or* USDB, so either balance unlocks the button.
  const hasWithdrawableBalance = !!btcBalance || !!dollarBalance;

  const { screenDimensions } = useAppStatus();
  const screenWidth = screenDimensions?.width ?? 0;

  const balanceScrollX = useSharedValue(0);

  const onBalancePageScroll = usePagerScrollHandler(
    {
      onPageScroll: e => {
        'worklet';
        const scrollOffset = (e.position + e.offset) * screenWidth;
        balanceScrollX.value = scrollOffset;
      },
    },
    [screenWidth],
  );

  // Main + NWC accounts keep their fixed/contact-profile images; everything
  // else (personal custody accounts and managed child accounts) opens the
  // emoji selector. Child emojis are stored locally and never hit the DB.
  const canEditAvatar =
    accountInformation.uuid !== NWC_ACCOUNT_UUID &&
    accountInformation.accountType !== 'main';

  const handleProfileImage = () => {
    if (!canEditAvatar) return;
    navigate.navigate('EmojiAvatarSelector', {
      accountId: accountInformation.uuid,
    });
  };

  const handleNavigateView = useCallback(async () => {
    const mnemonic = isChild
      ? await deriveChildMnemonic(
          accountMnemoinc,
          accountInformation.childIndex,
        )
      : await getAccountMnemonic(selectedAccount);
    navigate.navigate('SeedPhraseWarning', {
      mnemonic: mnemonic,
      extraData: { canViewQrCode: false },
      fromPage: 'accounts',
    });
  }, [
    selectedAccount,
    isChild,
    accountMnemoinc,
    accountInformation.childIndex,
  ]);

  const handleEditName = useCallback(async () => {
    if (isChild) {
      navigate.navigate('ChildEnterName', { editChild: accountInformation });
      return;
    }
    navigate.navigate('EditAccountName', {
      accountId: accountInformation.uuid,
    });
  }, [isChild, accountInformation, navigate]);

  const handlePairDevice = useCallback(() => {
    navigate.navigate('ChildPairingStack', {
      screen: 'ChildLinkCode',
      params: { reshareChild: accountInformation },
    });
  }, [navigate, accountInformation]);

  const handleViewActivity = useCallback(() => {
    navigate.navigate('ManagedAccountActivity', {
      accountId: accountInformation.uuid,
      childIndex: accountInformation.childIndex,
      accountName: accountInformation.name,
    });
  }, [navigate, accountInformation]);

  const handleDeleteAccount = useCallback(() => {
    if (isActive) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'settings.accountComponents.editAccountPage.activeAccountError',
        ),
      });
      return;
    }
    navigate.navigate('RemoveAccountPage', {
      accountId: accountInformation.uuid,
      from: fromPage,
    });
  }, [isActive, accountInformation, fromPage, navigate, t]);

  const openTransfer = mode => () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'accountTransfer',
      mode,
      account: accountInformation,
      sliderHight: 0.8,
    });

  const handleSlowConnectInfo = useCallback(() => {
    navigate.navigate('InformationPopup', {
      textContent: t(
        'settings.accountComponents.editAccountPage.stillConnectingInfo',
      ),
      buttonText: t('constants.understandText'),
    });
  }, [navigate, t]);

  const addLabel = t(
    'settings.accountComponents.editAccountPage.addMoneyButton',
  );
  const withdrawLabel = t(
    'settings.accountComponents.editAccountPage.withdrawMoneyButton',
  );

  const isNWC = accountInformation.uuid === NWC_ACCOUNT_UUID;

  // Declarative row model: each card is an array of rows, and dividers are
  // inserted only *between* rows. Groups the same for every account type —
  // "Details" (identity) then "Manage" (actions) — with rows filtered per type.
  const detailRows = [
    !isNWC &&
      accountInformation.uuid !== MAIN_ACCOUNT_UUID && {
        key: 'name',
        label: t('settings.accountComponents.editAccountPage.accountNameLabel'),
        value: accountInformation.name,
        onPress: handleEditName,
      },
    lnurlAddress &&
      !isChild && {
        key: 'lnurl',
        label: t(
          'settings.accountComponents.editAccountPage.lightningAddressLabel',
        ),
        value: username,
        onPress: () =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'LNURLAccountMangement',
            lnurlAddress: lnurlAddress,
            account: selectedAccount,
            sliderHight: 0.7,
          }),
      },
  ].filter(Boolean);

  const manageRows = [
    isNWC && {
      key: 'connections',
      label: t(
        'settings.accountComponents.editAccountPage.manageConnectionsLabel',
      ),
      onPress: () =>
        navigate.navigate('NosterWalletConnect', {
          fromAccounts: true,
          from: fromPage,
        }),
    },
    isChild && {
      key: 'pair',
      label: t('settings.childAccounts.page.shareLink'),
      onPress: handlePairDevice,
    },
    accountInformation.uuid !== MAIN_ACCOUNT_UUID && {
      key: 'history',
      label: t('settings.accountComponents.editAccountPage.viewActivityLabel'),
      onPress: handleViewActivity,
    },
    !isMainAccountAChild && {
      key: 'recovery',
      label: t(
        'settings.accountComponents.editAccountPage.showRecoveryPhraseLabel',
      ),
      onPress: handleNavigateView,
    },
  ].filter(Boolean);

  const renderCard = rows => {
    if (!rows.length) return null;
    return (
      <ListCard style={styles.card}>
        {rows.map(row => (
          <ListRow
            key={row.key}
            onPress={row.onPress}
            title={row.label}
            titleStyle={styles.rowTitle}
            showChevron
            chevronSize={18}
            trailing={row.value != null ? 'value' : undefined}
            value={row.value}
          />
        ))}
      </ListCard>
    );
  };

  if (isConnecting && !showSlowConnectUI) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={accountInformation.name} />
          <FullLoadingScreen showText={false} />
        </View>
      </GlobalThemeView>
    );
  }

  if (accountBalance.status === 'error' && !isActive) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={accountInformation.name} />
          <View style={styles.empty}>
            <EmptyState
              icon={'Info'}
              title={t('settings.accountComponents.editAccountPage.loadError')}
              sub={t(
                'settings.accountComponents.editAccountPage.loadErrorDesc',
              )}
            />
          </View>
          <CustomButton
            actionFunction={() => setReloadKey(k => k + 1)}
            textContent={t('constants.retry')}
            size={'regular'}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={accountInformation.name}
          right={
            (isConnecting ||
              (accountInformation.uuid !== NWC_ACCOUNT_UUID &&
                accountInformation.uuid !== MAIN_ACCOUNT_UUID &&
                !isChild)) && (
              <IconButton
                icon={isConnecting ? 'ZapOff' : 'Trash2'}
                label={
                  isConnecting
                    ? 'settings.accountComponents.editAccountPage.stillConnectingLabel'
                    : 'settings.accountComponents.editAccountPage.removeAccountLabel'
                }
                onPress={
                  isConnecting ? handleSlowConnectInfo : handleDeleteAccount
                }
              />
            )
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={'handled'}
        >
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              activeOpacity={canEditAvatar ? 0.2 : 1}
              disabled={!canEditAvatar}
              onPress={handleProfileImage}
              accessibilityRole={canEditAvatar ? 'button' : undefined}
              accessibilityLabel={
                canEditAvatar
                  ? t('settings.accountComponents.editAccountPage.editAvatarLabel')
                  : undefined
              }
            >
              <View style={[styles.avatar, { backgroundColor: tokens.surface }]}>
                <AccountProfileImage
                  imageSize={80}
                  account={accountInformation}
                />
              </View>
              {canEditAvatar && (
                <View
                  style={[
                    styles.editBadge,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: tokens.ground,
                    },
                  ]}
                >
                  <ThemeIcon redesign iconName="Pencil" size={14} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.pagerWrapper}>
            <AnimatedPagerView
              style={styles.pagerView}
              initialPage={0}
              onPageScroll={onBalancePageScroll}
            >
              <View style={styles.pageContainer}>
                <ThemeText
                  content={t(
                    'settings.accountComponents.editAccountPage.bitcoinBalanceLabel',
                  )}
                  styles={[styles.balanceLabel, { color: tokens.muted }]}
                />
                <AmountHero
                  amount={btcBalance}
                  masterInfoObject={{
                    ...masterInfoObject,
                    userBalanceDenomination: 'sats',
                  }}
                  amountSize={48}
                />
              </View>
              <View style={styles.pageContainer}>
                <ThemeText
                  content={t(
                    'settings.accountComponents.editAccountPage.dollarBalanceLabel',
                  )}
                  styles={[styles.balanceLabel, { color: tokens.muted }]}
                />
                <AmountHero
                  amount={formatBalanceAmount(
                    dollarBalance,
                    false,
                    masterInfoObject,
                  )}
                  masterInfoObject={{
                    ...masterInfoObject,
                    userBalanceDenomination: 'fiat',
                  }}
                  forceCurrency={'USD'}
                  convertAmount={false}
                  amountSize={48}
                />
              </View>
            </AnimatedPagerView>
            <View style={styles.staticOverlay} pointerEvents="box-none">
              <BalanceDots
                scrollX={balanceScrollX}
                pageCount={2}
                screenWidth={screenWidth}
                theme={theme}
                darkModeType={darkModeType}
                fromAccounts={true}
              />
            </View>
          </View>

          {(isChild || custodyAccountsList?.length >= 2) && (
            <AdaptiveButtonRow
              labels={[addLabel, withdrawLabel]}
              containerStyle={styles.buttonRow}
            >
              {({ buttonStyle }) => (
                <>
                  <CustomButton
                    disabled={isConnecting}
                    buttonStyles={[styles.actionButton, buttonStyle]}
                    enableElipsis={false}
                    textContent={addLabel}
                    actionFunction={openTransfer('add')}
                    size={'regular'}
                  />
                  <CustomButton
                    disabled={isConnecting || !hasWithdrawableBalance}
                    buttonStyles={[styles.actionButton, buttonStyle]}
                    enableElipsis={false}
                    textContent={withdrawLabel}
                    actionFunction={openTransfer('withdraw')}
                    size={'regular'}
                    tone={'secondary'}
                  />
                </>
              )}
            </AdaptiveButtonRow>
          )}

          {/* Details (identity) then Manage (actions) — same grouping for every
            account type, rows filtered per type via detailRows / manageRows. */}
          {renderCard(detailRows)}
          {renderCard(manageRows)}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginTop: 8,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    marginBottom: 12,
  },

  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },

  buttonRow: {
    marginBottom: 20,
  },

  balanceLabel: {
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    textAlign: 'center',
    marginBottom: 2,
  },

  pagerWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },

  pagerView: {
    width: '100%',
    height: 144,
  },

  pageContainer: {
    alignItems: 'center',
    marginTop: 20,
  },

  staticOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },
});
