import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  COLORS,
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import {
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../../../../../context-store/activeAccount';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useKeysContext } from '../../../../../../context-store/keys';
import { deriveChildMnemonic } from '../../../../../functions/accounts/childAccounts';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AccountProfileImage from '../../accounts/accountProfileImage';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useToast } from '../../../../../../context-store/toastManager';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SKELETON_ANIMATION_SPEED,
} from '../../../../../constants';
import CustomToggleSwitch from '../../../../../functions/CustomElements/switch';
import useAccountSwitcher from '../../../../../hooks/useAccountSwitcher';
import { getSparkAddress } from '../../../../../functions/spark';
import {
  getBitcoinBalance,
  initializeSparkWalletViewer,
} from '../../../../../functions/spark/walletViewer';
import SkeletonTextPlaceholder from '../../../../../functions/CustomElements/skeletonTextView';
import AdaptiveButtonRow from '../../../../../functions/CustomElements/adaptiveButtonRow';
import { share } from '../../../../../functions/handleShare';

export default function EditAccountPage(props) {
  const { showToast } = useToast();
  const accountId = props?.route?.params?.accountId;
  const fromPage = props?.route?.params?.from;
  const { getAccountMnemonic, activeAccount, custodyAccountsList } =
    useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { toggleMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { isSwitchingAccount, handleAccountPress } = useAccountSwitcher();

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

  const pinnedAccountUUIDs = masterInfoObject?.pinnedAccounts || [];

  const isPinned = pinnedAccountUUIDs.includes(
    accountInformation.uuid || accountInformation.name,
  );

  const isActive = activeAccount.uuid === accountInformation.uuid;
  const isActivating =
    isSwitchingAccount.isLoading &&
    isSwitchingAccount.accountBeingLoaded ===
      (accountInformation.uuid || accountInformation.name);

  const navigate = useNavigation();

  const [otherAccountBalance, setOtherAccountBalance] = useState({
    isLoading: true,
    balance: 0,
  });

  const [layout, setlayout] = useState({ height: 45, width: 87 });
  const maxLayoutRef = useRef({ height: 45, width: 87 });

  useFocusEffect(
    useCallback(() => {
      if (isActive) return;
      let isMounted = true;
      (async () => {
        try {
          if (!otherAccountBalance.balance)
            setOtherAccountBalance({ isLoading: true, balance: 0 });
          const mnemonic = isChild
            ? await deriveChildMnemonic(
                accountMnemoinc,
                accountInformation.childIndex,
              )
            : await getAccountMnemonic(accountInformation);
          const addressResponse = await getSparkAddress(mnemonic);
          if (!addressResponse.didWork) {
            throw new Error('Unable to derive account spark address');
          }
          await initializeSparkWalletViewer(mnemonic);
          const balance = await getBitcoinBalance(addressResponse.response);
          if (!isMounted) return;
          setOtherAccountBalance({
            isLoading: false,
            balance: Number(balance || 0),
          });
        } catch (err) {
          console.log('load account balance error', err);
          if (!isMounted) return;
          setOtherAccountBalance(prev => ({ ...prev, isLoading: false }));
        }
      })();
      return () => {
        isMounted = false;
      };
    }, [
      isActive,
      accountInformation.uuid,
      isChild,
      accountMnemoinc,
      otherAccountBalance.balance,
    ]),
  );

  const balance = isActive
    ? Number(sparkInformation?.balance || 0)
    : otherAccountBalance.balance;
  const isBalanceLoading = isActive ? false : otherAccountBalance.isLoading;

  const handleActivate = useCallback(() => {
    handleAccountPress(accountInformation);
  }, [handleAccountPress, accountInformation]);

  const handleProfileImage = () => {
    // Main + NWC accounts keep their fixed/contact-profile images; everything
    // else (personal custody accounts and managed child accounts) opens the
    // emoji selector. Child emojis are stored locally and never hit the DB.
    if (
      accountInformation.uuid === NWC_ACCOUNT_UUID ||
      accountInformation.accountType === 'main'
    )
      return;
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

  const handleSendInviteLink = useCallback(async () => {
    try {
      share({
        message: 'https://blitzwalletapp.com/child',
      });
    } catch (err) {
      console.log('Error sharing child invite link:', err);
    }
  }, []);

  const handlePinInfo = useCallback(() => {
    navigate.navigate('InformationPopup', {
      textContent: t(
        'settings.accountComponents.editAccountPage.pin_account_info',
      ),
      buttonText: t('constants.back'),
    });
  }, [navigate, t]);

  const handleAccountTypeInfo = useCallback(() => {
    const isDerived = accountInformation.accountType === 'derived';
    navigate.navigate('InformationPopup', {
      textContent: t(
        isDerived
          ? 'settings.accountComponents.editAccountPage.accountTypeDerivedInfo'
          : 'settings.accountComponents.editAccountPage.accountTypeImportedInfo',
      ),
      buttonText: t('constants.back'),
    });
  }, [navigate, t, accountInformation.accountType]);

  const handlePinToggle = useCallback(() => {
    const pinnedAccountId = accountInformation.uuid || accountInformation.name;
    const currentPins = masterInfoObject.pinnedAccounts || [];
    const isPinned = currentPins.includes(pinnedAccountId);

    if (isPinned) {
      toggleMasterInfoObject({
        pinnedAccounts: currentPins.filter(id => id !== pinnedAccountId),
      });
    } else {
      if (currentPins.length >= 2) {
        showToast({
          type: 'error',
          title: t('settings.hub.maxPinsReached'),
        });
        return;
      }
      toggleMasterInfoObject({
        pinnedAccounts: [...currentPins, pinnedAccountId],
      });
    }
  }, [
    masterInfoObject.pinnedAccounts,
    toggleMasterInfoObject,
    showToast,
    t,
    accountInformation,
  ]);

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

  const handleLayoutMeasurement = useCallback(event => {
    const { height, width } = event.nativeEvent.layout;

    const newMaxHeight = Math.max(maxLayoutRef.current.height, height);
    const newMaxWidth = Math.max(maxLayoutRef.current.width, width);

    if (
      newMaxHeight !== maxLayoutRef.current.height ||
      newMaxWidth !== maxLayoutRef.current.width
    ) {
      maxLayoutRef.current = { height: newMaxHeight, width: newMaxWidth };
      setlayout({ height: newMaxHeight, width: newMaxWidth });
    }
  }, []);

  const handleAddMoney = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'accountAddMoney',
      to: accountInformation.uuid,
      balance: balance,
      sliderHight: 0.8,
      onTransferComplete: newBalance => {
        if (typeof newBalance === 'number')
          setOtherAccountBalance({ isLoading: false, balance: newBalance });
      },
    });
  }, [navigate, accountInformation.uuid, setOtherAccountBalance, balance]);

  const handleWithdrawMoney = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'accountWithdrawlMoney',
      from: accountInformation.uuid,
      balance: balance,
      sliderHight: 0.8,
      onTransferComplete: newBalance => {
        if (typeof newBalance === 'number')
          setOtherAccountBalance({ isLoading: false, balance: newBalance });
      },
    });
  }, [navigate, accountInformation.uuid, balance, setOtherAccountBalance]);

  const addLabel = t(
    'settings.accountComponents.editAccountPage.addMoneyButton',
  );
  const withdrawLabel = t('savings.actionButtons.withdraw');
  const depositBg =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  const buttonBg = theme ? backgroundOffset : COLORS.darkModeText;
  const addTextColor =
    theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.accountComponents.editAccountPage.title')}
        showLeftImage={
          accountInformation.uuid !== NWC_ACCOUNT_UUID &&
          accountInformation.uuid !== MAIN_ACCOUNT_UUID &&
          !isChild
        }
        iconNew="Trash2"
        leftImageStyles={{ height: 25 }}
        leftImageFunction={handleDeleteAccount}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 10,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            activeOpacity={
              accountInformation.uuid === NWC_ACCOUNT_UUID ||
              accountInformation.accountType === 'main'
                ? 1
                : 0.2
            }
            onPress={handleProfileImage}
            style={[styles.avatar, { backgroundColor: backgroundOffset }]}
          >
            <AccountProfileImage imageSize={90} account={accountInformation} />
            {accountInformation.uuid !== NWC_ACCOUNT_UUID &&
              accountInformation.accountType !== 'main' && (
                <View
                  style={[
                    styles.editBadge,
                    { backgroundColor: COLORS.darkModeText },
                  ]}
                >
                  <ThemeIcon
                    colorOverride={COLORS.lightModeText}
                    iconName="Edit"
                    size={15}
                  />
                </View>
              )}
          </TouchableOpacity>
        </View>

        <ThemeText
          styles={styles.balanceLabel}
          content={t('constants.sat_balance')}
        />

        {/* Hidden component for layout measurement */}
        <View
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          onLayout={handleLayoutMeasurement}
        >
          <FormattedSatText
            autoAdjustFontSize={true}
            styles={styles.valueText}
            balance={balance}
            useSizing={true}
            globalBalanceDenomination={'sats'}
            forceCurrency={null}
            useBalance={null}
          />
        </View>
        <View
          style={{
            height: layout.height,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 30,
          }}
        >
          <SkeletonTextPlaceholder
            highlightColor={backgroundColor}
            backgroundColor={COLORS.opaicityGray}
            speed={SKELETON_ANIMATION_SPEED}
            enabled={isBalanceLoading}
            layout={layout}
          >
            <FormattedSatText
              autoAdjustFontSize={true}
              styles={styles.valueText}
              balance={balance}
              useSizing={true}
              globalBalanceDenomination={'sats'}
              forceCurrency={null}
              useBalance={null}
            />
          </SkeletonTextPlaceholder>
        </View>

        {(isChild || custodyAccountsList?.length >= 2) && !isActive && (
          <AdaptiveButtonRow
            labels={[addLabel, withdrawLabel]}
            containerStyle={{
              width: INSET_WINDOW_WIDTH,
              ...CENTER,
              marginBottom: 25,
            }}
          >
            {({ buttonStyle }) => (
              <>
                <TouchableOpacity
                  onPress={handleAddMoney}
                  disabled={isBalanceLoading}
                  style={[
                    styles.actionButton,
                    buttonStyle,
                    { backgroundColor: depositBg },
                    isBalanceLoading && { opacity: HIDDEN_OPACITY },
                  ]}
                >
                  <ThemeText
                    styles={{
                      includeFontPadding: false,
                      color: addTextColor,
                    }}
                    content={addLabel}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={isBalanceLoading}
                  onPress={handleWithdrawMoney}
                  style={[
                    styles.actionButton,
                    buttonStyle,
                    { backgroundColor: buttonBg },
                    isBalanceLoading && { opacity: HIDDEN_OPACITY },
                  ]}
                >
                  <ThemeText
                    styles={{ includeFontPadding: false }}
                    content={withdrawLabel}
                  />
                </TouchableOpacity>
              </>
            )}
          </AdaptiveButtonRow>
        )}

        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          {/* Account Name */}
          {accountInformation.uuid !== NWC_ACCOUNT_UUID && (
            <TouchableOpacity style={styles.row} onPress={handleEditName}>
              <ThemeText
                styles={styles.rowLabel}
                content={t(
                  'settings.accountComponents.editAccountPage.accountNameLabel',
                )}
              />
              <View style={styles.rowRight}>
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.rowValue}
                  content={accountInformation.name}
                />
                <ThemeIcon iconName="ChevronRight" size={18} />
              </View>
            </TouchableOpacity>
          )}

          {accountInformation.uuid !== NWC_ACCOUNT_UUID && (
            <View style={[styles.divider, { backgroundColor }]} />
          )}

          {accountInformation.uuid !== NWC_ACCOUNT_UUID && !isChild && (
            <View style={styles.row}>
              <View style={styles.infoContainer}>
                <ThemeText
                  styles={[styles.rowLabel, { marginRight: 5, width: 'unset' }]}
                  content={t(
                    'settings.accountComponents.editAccountPage.accountTypeLabel',
                  )}
                />
                <TouchableOpacity onPress={handleAccountTypeInfo}>
                  <ThemeIcon size={20} iconName={'Info'} />
                </TouchableOpacity>
              </View>
              <View style={[styles.rowRight, { gap: 5 }]}>
                <View
                  style={[
                    styles.accountTypePill,
                    {
                      backgroundColor,
                    },
                  ]}
                >
                  <ThemeText
                    styles={[styles.accountTypePillText]}
                    content={t(
                      `settings.accountComponents.editAccountPage.accountType`,
                      { context: accountInformation.accountType },
                    )}
                  />
                </View>
              </View>
            </View>
          )}

          {accountInformation.uuid !== NWC_ACCOUNT_UUID && !isChild && (
            <View style={[styles.divider, { backgroundColor }]} />
          )}

          {/* Show Recovery Phrase */}
          {!(
            accountInformation.accountType === 'main' && isMainAccountAChild
          ) && (
            <TouchableOpacity style={styles.row} onPress={handleNavigateView}>
              <ThemeText
                styles={[styles.rowLabel]}
                content={t(
                  'settings.accountComponents.editAccountPage.showRecoveryPhraseLabel',
                )}
              />
              <ThemeIcon iconName="ChevronRight" size={18} />
            </TouchableOpacity>
          )}
        </View>

        {isChild ? (
          <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
            {/* Pair device (always available — re-pair after wallet loss) */}
            <TouchableOpacity style={styles.row} onPress={handlePairDevice}>
              <ThemeText
                styles={styles.rowLabel}
                content={t('settings.childAccounts.page.shareLink')}
              />
              <ThemeIcon iconName="ChevronRight" size={18} />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor }]} />
            {/* Send the recipient a download/invite link */}
            <TouchableOpacity style={styles.row} onPress={handleSendInviteLink}>
              <ThemeText
                styles={styles.rowLabel}
                content={t('settings.childAccounts.page.sendInviteLink')}
              />
              <ThemeIcon iconName="ChevronRight" size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
            {/* Pin Contact */}
            <View style={styles.row}>
              <View style={styles.infoContainer}>
                <ThemeText
                  styles={[styles.rowLabel, { marginRight: 5, width: 'unset' }]}
                  content={t(
                    'settings.accountComponents.editAccountPage.account',
                    {
                      context: isPinned ? 'unpin' : 'pin',
                    },
                  )}
                />
                <TouchableOpacity onPress={handlePinInfo}>
                  <ThemeIcon size={20} iconName={'Info'} />
                </TouchableOpacity>
              </View>
              <CustomToggleSwitch
                stateValue={isPinned}
                toggleSwitchFunction={handlePinToggle}
                page={'pinAccount'}
              />
            </View>
          </View>
        )}

        {/* View the managed account's transaction history */}
        {isChild && (
          <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
            <TouchableOpacity style={styles.row} onPress={handleViewActivity}>
              <ThemeText
                styles={styles.rowLabel}
                content={t(
                  'settings.accountComponents.editAccountPage.viewActivityLabel',
                )}
              />
              <ThemeIcon iconName="ChevronRight" size={18} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      {/* Activate */}
      {!isActive && !isChild && (
        <CustomButton
          textContent={t(
            'settings.accountComponents.editAccountPage.activateButton',
          )}
          useLoading={isActivating}
          actionFunction={handleActivate}
          buttonStyles={styles.buttonContainer}
        />
      )}
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  avatarContainer: {
    marginBottom: 25,
    alignSelf: 'center',
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 25,
    height: 25,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    alignSelf: 'center',
    width: INSET_WINDOW_WIDTH,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 15,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowLabel: {
    width: '100%',
    flexShrink: 1,
    includeFontPadding: false,
  },

  rowRight: {
    width: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  rowValue: {
    fontSize: SIZES.small,
    opacity: 0.6,
    flexShrink: 1,
    includeFontPadding: false,
  },

  divider: {
    height: 2,
    marginLeft: 16,
  },

  dangerRow: {
    justifyContent: 'center',
  },
  buttonContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  dangerText: {
    color: COLORS.cancelRed,
    includeFontPadding: false,
    textAlign: 'center',
  },
  pinButton: {
    height: 35,
    width: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceLabel: {
    textTransform: 'uppercase',
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    textAlign: 'center',
  },

  valueText: {
    fontSize: SIZES.huge,
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },

  actionButton: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  accountTypePillText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
});
