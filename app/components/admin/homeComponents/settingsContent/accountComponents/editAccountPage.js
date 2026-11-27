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
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import {
  AMOUNT_HERO_SIZE,
  CARD_RADIUS,
  CENTER,
  MAIN_ACCOUNT_UUID,
  MAX_WEB_CONTENT_WIDTH,
  NWC_ACCOUNT_UUID,
  TYPE,
} from '../../../../../constants';
import { formatBalanceAmount } from '../../../../../functions';
import {
  disposeSparkWallet,
  getSparkIdentityPubKey,
  openDerivedWallet,
} from '../../../../../functions/spark';
import { subscribeToSparkBalance } from '../../../../../functions/spark/awaitBalanceChange';
import {
  getAccountBalanceSnapshot,
  getUsdTokenDollars,
  saveAccountBalanceSnapshot,
} from '../../../../../functions/spark/balanceSnapshots';
import AdaptiveButtonRow from '../../../../../functions/CustomElements/adaptiveButtonRow';
import CustomButton from '../../../../../functions/CustomElements/button';
import Skeleton, {
  SkeletonButtons,
  SkeletonRow,
} from '../../../../../functions/CustomElements/redesign/Skeleton';
import SkeletonBar from '../../../../../functions/CustomElements/redesign/SkeletonBar';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';
import useAfterTransition from '../../../../../hooks/useAfterTransition';
import { FADE_TOP } from '../../../../../functions/CustomElements/redesign/TopFade';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import {
  fiatToSats,
  homeTotalFiat,
  isUsableRate,
  resolveDisplayUsdRate,
} from '../../../../../functions/money';
import { dollarsToSats } from '../../../../../functions/spark/swapAmountUtils';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import BalanceCard, {
  getAssetBalanceText,
  isDollarDust,
} from '../../homeLightning/balanceCard';

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
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const { fiatStats, usdFiatStats } = useNodeContext();
  const { poolInfo, swapUSDPriceDollars } = useFlashnet();
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
  // The wallet connect waits for the push animation (status stays 'connecting').
  const isReady = useAfterTransition();

  useEffect(() => {
    if (isActive || !isReady) return; // active account uses live context (below)
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

        const initRes = await (initPromiseRef.current =
          openDerivedWallet(mnemonic));

        // A wallet something else already holds open is not ours to dispose.
        if (initRes.borrowed) mnemonicRef.current = null;
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
  }, [
    isActive,
    accountInformation.uuid,
    isChild,
    accountMnemoinc,
    reloadKey,
    isReady,
  ]);

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

  // Main + NWC accounts keep their fixed/contact-profile images; everything
  // else (personal custody accounts and managed child accounts) opens the
  // emoji selector. Child emojis are stored locally and never hit the DB.
  const canEditAvatar =
    accountInformation.uuid !== NWC_ACCOUNT_UUID &&
    accountInformation.accountType !== 'main';

  // Trash icon (or the "still connecting" ZapOff notice): custody accounts
  // only, never main/NWC/child accounts.
  const hasAccountAction =
    isConnecting ||
    (accountInformation.uuid !== NWC_ACCOUNT_UUID &&
      accountInformation.uuid !== MAIN_ACCOUNT_UUID &&
      !isChild);

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

  // Same total as Home (BTC + dollars). Hidden mode still shows sats here, as
  // the account page always has.
  const isFiatMode = masterInfoObject.userBalanceDenomination === 'fiat';
  const usdRate = resolveDisplayUsdRate(usdFiatStats, swapUSDPriceDollars);
  const totalFiat = isFiatMode
    ? homeTotalFiat({
        btcSats: btcBalance,
        usdbDollars: dollarBalance,
        rate: isUsableRate(fiatStats, masterInfoObject.fiatCurrency)
          ? fiatStats
          : null,
        usdRate,
      })
    : null;
  // Pool price like Home's totalSatValue; market USD until the pool loads.
  const dollarSats = poolInfo?.currentPriceAInB
    ? dollarsToSats(dollarBalance, poolInfo.currentPriceAInB)
    : fiatToSats(dollarBalance, usdRate) ?? 0;
  const heroTotalProps =
    totalFiat == null
      ? {
          amount: Math.round(btcBalance + dollarSats),
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
        }
      : {
          amount: formatBalanceAmount(
            totalFiat > 0 && totalFiat < 0.01 ? '0.01' : totalFiat.toFixed(2),
            false,
            masterInfoObject,
          ),
          convertAmount: false,
          isDust: totalFiat > 0 && totalFiat < 0.01,
          masterInfoObject,
        };

  // While connecting, each card keeps its surface with icon, label and amount
  // as bars, like the skeleton list rows.
  const cardSkeleton = (
    <View style={[styles.cardSkeleton, { backgroundColor: tokens.surface }]}>
      <Skeleton>
        <View style={cardSkeletonInner}>
          <View style={cardSkeletonIcon} />
          <View style={cardSkeletonTexts}>
            <View style={cardSkeletonLabel} />
            <View style={cardSkeletonAmount} />
          </View>
        </View>
      </Skeleton>
    </View>
  );
  const balanceCards = isConnecting ? (
    <View style={styles.metricsRow}>
      {cardSkeleton}
      {cardSkeleton}
    </View>
  ) : (
    <View style={styles.metricsRow}>
      <BalanceCard
        isBitcoin={false}
        label={t('constants.dollars_upper')}
        isDust={isDollarDust(dollarBalance)}
        amount={getAssetBalanceText({
          isBitcoin: false,
          amount: dollarBalance,
          masterInfoObject,
          fiatStats,
          roundUpDust: true,
        })}
      />
      <BalanceCard
        isBitcoin={true}
        label={t('constants.bitcoin_upper')}
        amount={getAssetBalanceText({
          isBitcoin: true,
          amount: btcBalance,
          masterInfoObject,
          fiatStats,
        })}
      />
    </View>
  );

  if (isConnecting && !showSlowConnectUI) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={accountInformation.name} />
          {/* Same layout as the loaded page, balances and rows as bars. */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: tokens.surface }]}>
              <AccountProfileImage
                imageSize={80}
                account={accountInformation}
              />
            </View>
          </View>
          <ThemeText
            content={t('constants.total_balance')}
            variant={'hint'}
            styles={styles.balanceLabel}
          />
          <View style={styles.hero}>
            <SkeletonBar width={176} height={46} borderRadius={14} />
          </View>
          {(isChild || custodyAccountsList?.length >= 2) && (
            <SkeletonButtons style={styles.buttonRow} />
          )}
          {balanceCards}
          {[detailRows, manageRows].map(
            (rows, index) =>
              !!rows.length && (
                <ListCard key={index} style={styles.card}>
                  {rows.map(row => (
                    <SkeletonRow
                      key={row.key}
                      lead={0}
                      title={120}
                      sub={0}
                      trailing={0}
                      minHeight={56}
                    />
                  ))}
                </ListCard>
              ),
          )}
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
    <GlobalThemeView edgeToEdge useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          fade
          title={accountInformation.name}
          right={
            <View
              pointerEvents={hasAccountAction ? 'auto' : 'none'}
              accessibilityElementsHidden={!hasAccountAction}
              importantForAccessibility={
                hasAccountAction ? 'auto' : 'no-hide-descendants'
              }
              style={{ opacity: hasAccountAction ? 1 : 0 }}
            >
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
            </View>
          }
        />
        <CustomScrollView
          keyboardShouldPersistTaps={'handled'}
          contentContainerStyle={{
            paddingTop: FADE_TOP,
            paddingBottom: bottomPadding,
          }}
        >
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              activeOpacity={canEditAvatar ? 0.2 : 1}
              disabled={!canEditAvatar}
              onPress={handleProfileImage}
              accessibilityRole={canEditAvatar ? 'button' : undefined}
              accessibilityLabel={
                canEditAvatar
                  ? t(
                      'settings.accountComponents.editAccountPage.editAvatarLabel',
                    )
                  : undefined
              }
            >
              <View
                style={[styles.avatar, { backgroundColor: tokens.surface }]}
              >
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

          <ThemeText
            content={t('constants.total_balance')}
            variant={'hint'}
            styles={styles.balanceLabel}
          />
          <View style={styles.hero}>
            {isConnecting ? (
              <SkeletonBar width={176} height={46} borderRadius={14} />
            ) : (
              <AmountHero
                amountSize={AMOUNT_HERO_SIZE.primary}
                fiatStats={fiatStats}
                {...heroTotalProps}
              />
            )}
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

          {balanceCards}

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
    ...TYPE.body,
  },

  buttonRow: {
    marginTop: 20,
  },

  balanceLabel: {
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    textAlign: 'center',
    marginTop: 20,
  },
  // Fixed slot (as Home) so the skeleton bar and the hero are the same height.
  hero: {
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  // BalanceCard's size, radius and padding.
  cardSkeleton: {
    flex: 1,
    height: 152,
    borderRadius: CARD_RADIUS,
    padding: 18,
  },
});

// Plain objects: the skeleton mask reads sizes from them (see Skeleton).
const cardSkeletonInner = { height: 116, justifyContent: 'space-between' };
const cardSkeletonIcon = { width: 40, height: 40, borderRadius: 20 };
const cardSkeletonTexts = { gap: 8 };
const cardSkeletonLabel = { width: 64, height: 14, borderRadius: 7 };
const cardSkeletonAmount = { width: 96, height: 22, borderRadius: 8 };
