import { CustomKeyboardAvoidingView } from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../constants';
import { keyboardGoBack } from '../../../../../functions/customNavigation';

export default function EditAccountName(props) {
  const selectedAccount = props?.route?.params?.account;
  const { updateAccount } = useActiveCustodyAccount();
  const { t } = useTranslation();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [accountName, setAccountName] = useState(selectedAccount.name || '');

  const navigate = useNavigation();

  const handleNameUpage = useCallback(async () => {
    if (!canSave) return;
    await updateAccount({ ...selectedAccount, name: accountName });
    keyboardGoBack(navigate);
  }, [selectedAccount, accountName]);

  const canSave = selectedAccount.name !== accountName;

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        label={t('settings.accountComponents.editAccountName.title')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <CustomSearchInput
          inputText={accountName}
          setInputText={setAccountName}
          placeholderText={t(
            'settings.accountComponents.editAccountName.namePlaceholder',
          )}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
        />
      </ScrollView>
      <CustomButton
        buttonStyles={{ ...CENTER, opacity: canSave ? 1 : HIDDEN_OPACITY }}
        textContent={canSave ? t('constants.save') : t('constants.back')}
        actionFunction={handleNameUpage}
      />
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scrollContainer: {
    paddingTop: 10,
    width: WINDOWWIDTH,
    ...CENTER,
  },
});
