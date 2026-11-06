import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CENTER,
  MAIN_ACCOUNT_UUID,
  MAX_WEB_CONTENT_WIDTH,
  NWC_ACCOUNT_UUID,
} from '../../../../constants';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import AccountCard from '../accounts/accountCard';
import useAccountBalancePreviews from '../../../../hooks/useAccountBalancePreviews';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import Segmented from '../../../../functions/CustomElements/redesign/Segmented';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const route = useRoute();
  const { custodyAccountsList } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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

  const { computeTotalSats, computeLastUpdated } = useAccountBalancePreviews();

  const handleNavigateAddAccount = useCallback(() => {
    if (isLinked) {
      navigate.navigate('ChildEnterName');
      return;
    }
    navigate.navigate('SelectCreateAccountType', {});
  }, [navigate, isLinked]);

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
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('constants.accounts')}
          right={
            !masterInfoObject.isChildAccount ? (
              <IconButton
                icon={'Info'}
                label={
                  isLinked
                    ? 'settings.accounts.linkedInfo.title'
                    : 'settings.accounts.personalInfo.title'
                }
                onPress={handleAboutClick}
              />
            ) : undefined
          }
        />

        {!masterInfoObject.isChildAccount && (
          <View style={styles.toggleWrap}>
            <Segmented
              fit
              options={[
                {
                  value: 'personal',
                  label: t('settings.accounts.tabs.personal'),
                },
                {
                  value: 'linked',
                  label: t('settings.accounts.tabs.linked'),
                },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          </View>
        )}
        <CustomScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeAccounts.length > 0 ? (
            <ListCard>
              {activeAccounts.map((item, index) => (
                <AccountCard
                  key={item.uuid || `Account ${index}`}
                  account={item}
                  onPress={() => handleOpenAccount(item)}
                  balanceSats={isLinked ? undefined : computeTotalSats(item)}
                  lastUpdated={isLinked ? undefined : computeLastUpdated(item)}
                />
              ))}
            </ListCard>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState
                icon={'Users'}
                title={t(
                  isLinked
                    ? 'settings.accounts.emptyLinked.title'
                    : 'settings.accounts.noResults.title',
                )}
                sub={t(
                  isLinked
                    ? 'settings.accounts.emptyLinked.subtitle'
                    : 'settings.accounts.noResults.subtitle',
                )}
              />
            </View>
          )}
        </CustomScrollView>

        {!masterInfoObject.isChildAccount && (
          <CustomButton
            actionFunction={handleNavigateAddAccount}
            textContent={t(
              'settings.accountComponents.selectCreateAccountType.title',
            )}
            size={'regular'}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  toggleWrap: {
    alignItems: 'center',
    marginTop: 16,
  },
  scrollContainer: {
    marginTop: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
