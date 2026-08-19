import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SATSPERBITCOIN,
} from '../../../../constants';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import WordsQrToggle from '../../../../functions/CustomElements/wordsQrToggle';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import AccountCard from '../accounts/accountCard';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import {
  getAllAccountBalanceSnapshots,
  getUsdTokenDollars,
} from '../../../../functions/spark/balanceSnapshots';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const route = useRoute();
  const { custodyAccountsList, activeAccount } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { textColor } = GetThemeColors();
  const { t } = useTranslation();
  const { sparkInformation } = useSparkWallet();
  const { swapUSDPriceDollars } = useFlashnet();
  const params = route.params || {};
  const [activeTab, setActiveTab] = useState(params?.initialTab || 'personal');

  useEffect(() => {
    if (params?.initialTab) setActiveTab(params.initialTab);
  }, [params?.initialTab]);

  const childAccounts = useMemo(
    () => masterInfoObject?.childAccounts || [],
    [masterInfoObject?.childAccounts],
  );

  const isLinked = activeTab === 'linked';

  // Cached balance snapshots keyed by identity pubkey, re-read every time the
  // page regains focus so balances updated while inside an account are current
  // when the user navigates back.
  const [snapshotMap, setSnapshotMap] = useState({});
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const snapshots = await getAllAccountBalanceSnapshots();
        if (cancelled) return;
        const map = {};
        for (const s of snapshots) {
          map[s.identityPubKey] = { balance: s.balance, tokens: s.tokens };
        }
        setSnapshotMap(map);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Offline uuid -> pubkey map. Reuses the already-derived, Firebase-synced
  // accountsLnurl registry instead of re-deriving from seeds every render.
  // Main is synthesized (not in the registry) but is the active account here,
  // so computeTotalSats reads its balance from sparkInformation, not a snapshot.
  const accountPubkeys = useMemo(() => {
    const map = {};
    for (const v of Object.values(masterInfoObject.accountsLnurl || {})) {
      if (v?.uuid && v?.identityPubKey) map[v.uuid] = v.identityPubKey;
    }
    return map;
  }, [masterInfoObject.accountsLnurl]);

  const computeTotalSats = useCallback(
    account => {
      const isActiveAccount = account.uuid === activeAccount?.uuid;
      let btcSats;
      let tokensObj;
      if (isActiveAccount) {
        if (sparkInformation?.didConnect !== true) return null;
        btcSats = Number(sparkInformation.balance || 0);
        tokensObj = sparkInformation.tokens;
      } else {
        const pubkey = accountPubkeys[account.uuid];
        const snapshot = pubkey ? snapshotMap[pubkey] : null;
        if (!snapshot) return null;
        btcSats = Number(snapshot.balance || 0);
        tokensObj = snapshot.tokens;
      }
      const usdDollars = getUsdTokenDollars(tokensObj);
      const usdToSats =
        swapUSDPriceDollars > 0
          ? (usdDollars * SATSPERBITCOIN) / swapUSDPriceDollars
          : 0;
      return btcSats + usdToSats;
    },
    [
      activeAccount?.uuid,
      sparkInformation,
      accountPubkeys,
      snapshotMap,
      swapUSDPriceDollars,
    ],
  );

  const handleNavigateAddAccount = useCallback(() => {
    if (isLinked) {
      navigate.navigate('ChildEnterName');
      return;
    }
    navigate.navigate('SelectCreateAccountType', {});
  }, [navigate, isLinked]);

  const handleNavigateSwap = useCallback(() => {
    if (custodyAccountsList.length < 2) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.accountComponents.homepage.swapAccountError'),
      });
      return;
    }

    navigate.navigate('CustodyAccountPaymentPage');
  }, [navigate, custodyAccountsList, t]);

  const handleOpenAccount = useCallback(
    item => {
      navigate.navigate('EditAccountPage', {
        accountId: item.uuid,
        from: 'SettingsContentHome',
      });
    },
    [navigate],
  );

  const activeAccounts = useMemo(() => {
    if (isLinked) {
      return childAccounts.map(child => ({ ...child, __type: 'child' }));
    }
    if (masterInfoObject.isChildAccount) {
      return custodyAccountsList.filter(
        account =>
          account.uuid === MAIN_ACCOUNT_UUID ||
          account.uuid === NWC_ACCOUNT_UUID,
      );
    }
    return custodyAccountsList;
  }, [
    isLinked,
    childAccounts,
    custodyAccountsList,
    masterInfoObject.isChildAccount,
  ]);

  const handleAboutClick = useCallback(() => {
    navigate.navigate('InformationPopup', {
      textContent: t(
        isLinked
          ? 'settings.accounts.linkedInfo.body'
          : 'settings.accounts.personalInfo.body',
      ),
      buttonText: t('constants.understandText'),
    });
  }, [isLinked]);

  return (
    <CustomKeyboardAvoidingView useLocalPadding={true} useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('constants.accounts')}
        leftImageStyles={{ height: 25 }}
        iconNew="Info"
        showLeftImage={!masterInfoObject.isChildAccount}
        leftImageFunction={handleAboutClick}
      />
      {!masterInfoObject.isChildAccount && (
        <WordsQrToggle
          selectedDisplayOption={activeTab}
          setSelectedDisplayOption={setActiveTab}
          option1Text={t('settings.accounts.tabs.personal')}
          option1Value="personal"
          option2Text={t('settings.accounts.tabs.linked')}
          option2Value="linked"
          containerStyle={styles.toggle}
        />
      )}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeAccounts.length > 0 ? (
          <View style={styles.listContainer}>
            {activeAccounts.map((item, index) => (
              <AccountCard
                key={item.uuid || `Account ${index}`}
                account={item}
                onPress={() => handleOpenAccount(item)}
                balanceSats={isLinked ? undefined : computeTotalSats(item)}
              />
            ))}
          </View>
        ) : (
          <NoContentSceen
            iconName="Users"
            titleText={t(
              isLinked
                ? 'settings.accounts.emptyLinked.title'
                : 'settings.accounts.noResults.title',
            )}
            subTitleText={t(
              isLinked
                ? 'settings.accounts.emptyLinked.subtitle'
                : 'settings.accounts.noResults.subtitle',
            )}
            containerStyles={styles.emptyContainer}
          />
        )}
      </ScrollView>

      {!masterInfoObject.isChildAccount && (
        <CustomButton
          buttonStyles={{
            width: INSET_WINDOW_WIDTH,
            marginTop: CONTENT_KEYBOARD_OFFSET,
            ...CENTER,
          }}
          actionFunction={handleNavigateAddAccount}
          textStyles={styles.actionButtonText}
          textContent={t(
            'settings.accountComponents.selectCreateAccountType.title',
          )}
        />
      )}
      <CustomButton
        buttonStyles={[
          {
            width: INSET_WINDOW_WIDTH,
            marginTop: masterInfoObject.isChildAccount
              ? CONTENT_KEYBOARD_OFFSET
              : undefined,
            ...CENTER,
          },
          !masterInfoObject.isChildAccount && { backgroundColor: undefined },
        ]}
        textStyles={[!masterInfoObject.isChildAccount && { color: textColor }]}
        actionFunction={handleNavigateSwap}
        textContent={t('settings.accountComponents.homepage.swap')}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: MAX_CONTENT_WIDTH,
    ...CENTER,
    flexGrow: 1,
  },
  toggle: {
    ...CENTER,
    marginBottom: 4,
  },
  listContainer: {
    width: '100%',
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 250,
  },
  actionButtonText: {
    includeFontPadding: false,
  },
});
