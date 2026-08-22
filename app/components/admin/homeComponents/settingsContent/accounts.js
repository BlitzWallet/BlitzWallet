import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import WordsQrToggle from '../../../../functions/CustomElements/wordsQrToggle';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';
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
import useAccountBalancePreviews from '../../../../hooks/useAccountBalancePreviews';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const route = useRoute();
  const { custodyAccountsList } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
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
                lastUpdated={isLinked ? undefined : computeLastUpdated(item)}
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
