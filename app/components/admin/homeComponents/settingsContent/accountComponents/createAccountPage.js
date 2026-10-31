import { useState } from 'react';
import { CustomKeyboardAvoidingView } from '../../../../../functions/CustomElements';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  MAX_DERIVED_ACCOUNTS,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../../functions/CustomElements/redesign/UserInput';

export default function CreateCustodyAccountPage() {
  const maxLength = 50;
  const { masterInfoObject } = useGlobalContextProvider();
  const { createDerivedAccount } = useActiveCustodyAccount();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [name, setName] = useState('');

  const navigate = useNavigation();

  const handleCreateAccount = async () => {
    try {
      if (!name) return;

      setIsCreatingAccount(true);

      const nextIndex = Number(
        masterInfoObject.nextAccountDerivationIndex || 0,
      );
      if (nextIndex >= MAX_DERIVED_ACCOUNTS) {
        throw new Error(
          `Maximum of ${MAX_DERIVED_ACCOUNTS} accounts reached. Please delete unused accounts.`,
        );
      }

      const response = await createDerivedAccount(name);
      if (!response.didWork) {
        setIsCreatingAccount(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: response.error,
        });
        return;
      }

      setIsCreatingAccount(false);
      navigate.popTo('SettingsContentHome', {
        for: 'Accounts',
        initialTab: 'personal',
      });
      navigate.navigate('EditAccountPage', {
        accountId: response.uuid,
        from: 'SettingsContentHome',
      });
    } catch (err) {
      console.log('Create custody account error', err);
      setIsCreatingAccount(false);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.accountComponents.editAccountName.title')}
          shouldDismissKeyboard={true}
        />

        <CustomScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={'handled'}
        >
          <PageHeader
            title={t('settings.childAccounts.enterName.title')}
            sub={t('settings.childAccounts.enterName.subtitle')}
          />
          <UserInput
            value={name}
            onChangeText={setName}
            maxLength={maxLength}
            placeholder={t('settings.childAccounts.enterName.placeholder')}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            focusRing
            showTextCount
          />
        </CustomScrollView>
        <CustomButton
          disabled={!name}
          useLoading={isCreatingAccount}
          textContent={t('settings.childAccounts.enterName.create')}
          actionFunction={handleCreateAccount}
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
});
