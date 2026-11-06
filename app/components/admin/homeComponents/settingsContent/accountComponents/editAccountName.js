import { CustomKeyboardAvoidingView } from '../../../../../functions/CustomElements';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../../functions/CustomElements/redesign/UserInput';

export default function EditAccountName(props) {
  const accountId = props?.route?.params?.accountId;
  const maxLength = 50;
  const { updateAccount, custodyAccountsList } = useActiveCustodyAccount();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const selectedAccount = useMemo(
    () => custodyAccountsList?.find(item => item.uuid === accountId) || {},
    [custodyAccountsList, accountId],
  );
  const { t } = useTranslation();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [accountName, setAccountName] = useState(selectedAccount.name || '');

  const navigate = useNavigation();

  const handleNameUpage = useCallback(async () => {
    if (!canSave) {
      navigate.goBack();
      return;
    }
    await updateAccount({
      ...selectedAccount,
      name:
        accountName ||
        t('accountCard.fallbackAccountName', {
          index: selectedAccount.derivationIndex,
        }),
    });
    keyboardGoBack(navigate);
  }, [selectedAccount, accountName]);

  const canSave = selectedAccount.name !== accountName;

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          shouldDismissKeyboard={true}
          title={t('settings.accountComponents.editAccountName.title')}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={'handled'}
        >
          <PageHeader
            title={t('settings.childAccounts.enterName.editTitle')}
            sub={t('settings.childAccounts.enterName.editSubtitle')}
          />

          <UserInput
            value={accountName}
            onChangeText={setAccountName}
            placeholder={t(
              'settings.accountComponents.editAccountName.namePlaceholder',
            )}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            maxLength={maxLength}
            showTextCount
            focusRing
          />
        </CustomScrollView>
        <CustomButton
          textContent={canSave ? t('constants.save') : t('constants.back')}
          actionFunction={handleNameUpage}
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
});
