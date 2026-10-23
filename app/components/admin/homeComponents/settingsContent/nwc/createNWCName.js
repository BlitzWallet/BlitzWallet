import { useNavigation } from '@react-navigation/native';
import { CustomKeyboardAvoidingView } from '../../../../../functions/CustomElements';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../../functions/CustomElements/redesign/UserInput';

export default function CreateNWCName(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const maxLength = 60;
  const passedParams = props?.route?.params || {};
  const isEditing = passedParams?.mode === 'edit' || !!passedParams?.accountID;
  const savedData =
    masterInfoObject?.NWC?.accounts?.[passedParams?.accountID] || {};
  const [accountName, setAccountName] = useState(
    isEditing ? savedData.accountName : '',
  );
  const [isKeyboardActive, setIsKeyboardActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const handleSave = async () => {
    if (!accountName) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noAccountNameError'),
      });
      return;
    }
    try {
      setIsSaving(true);
      const result = await saveNWCAccount({
        savedData,
        accountName,
        permissions: savedData.permissions,
        budgetRenewalSettings: savedData.budgetRenewalSettings,
        existingAccounts: masterInfoObject?.NWC?.accounts || {},
      });
      toggleNWCInformation(result);
      navigate.goBack();
    } catch (error) {
      console.error('Error saving NWC account name:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (!accountName) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noAccountNameError'),
      });
      return;
    }
    keyboardNavigate(() => {
      navigate.navigate('CreateNWCPermissions', { accountName });
    });
  };

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      useStandardWidth={true}
      isKeyboardActive={isKeyboardActive}
    >
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <TopBar
          shouldDismissKeyboard={true}
          title={t(
            isEditing
              ? 'settings.nwc.createNWCName.navTitle'
              : 'settings.nwc.addAccount',
          )}
        />
        {isSaving ? (
          <FullLoadingScreen
            text={t('settings.nwc.createNWCAccount.updatingMessage')}
          />
        ) : (
          <>
            <CustomScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <PageHeader
                title={t(
                  isEditing
                    ? 'settings.nwc.createNWCName.editTitle'
                    : 'settings.nwc.createNWCName.title',
                )}
                sub={t(
                  isEditing
                    ? 'settings.nwc.createNWCName.editSubtitle'
                    : 'settings.nwc.createNWCName.subtitle',
                )}
              />

              <UserInput
                value={accountName}
                onChangeText={setAccountName}
                placeholder={t('settings.nwc.createNWCName.placeholder')}
                autoFocus={true}
                onBlur={() => setIsKeyboardActive(false)}
                onFocus={() => setIsKeyboardActive(true)}
                maxLength={maxLength}
                showTextCount={true}
              />
            </CustomScrollView>

            <CustomButton
              disabled={!accountName}
              actionFunction={isEditing ? handleSave : handleContinue}
              buttonStyles={{
                ...CENTER,
                marginTop: CONTENT_KEYBOARD_OFFSET,
              }}
              textContent={t(
                isEditing ? 'constants.save' : 'constants.continue',
              )}
              size={'regular'}
            />
          </>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
});
