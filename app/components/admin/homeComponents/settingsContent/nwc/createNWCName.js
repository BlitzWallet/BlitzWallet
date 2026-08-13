import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { keyboardNavigate } from '../../../../../functions/customNavigation';

export default function CreateNWCName(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor } = GetThemeColors();
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

  const isOverLimit = accountName.length >= maxLength;
  const characterCountColor = isOverLimit
    ? theme && darkModeType
      ? textColor
      : COLORS.cancelRed
    : textColor;

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      useStandardWidth={true}
      isKeyboardActive={isKeyboardActive}
    >
      <CustomSettingsTopBar
        label={t('settings.nwc.createNWCName.title')}
        shouldDismissKeyboard={true}
      />
      {isSaving ? (
        <FullLoadingScreen
          text={t('settings.nwc.createNWCAccount.updatingMessage')}
        />
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.innerContainer}
            contentContainerStyle={styles.scrollContent}
          >
            <ThemeText
              styles={styles.title}
              content={t(
                isEditing
                  ? 'settings.childAccounts.enterName.editTitle'
                  : 'settings.childAccounts.enterName.title',
              )}
            />
            <ThemeText
              styles={styles.subtitle}
              content={t(
                isEditing
                  ? 'settings.childAccounts.enterName.editSubtitle'
                  : 'settings.childAccounts.enterName.subtitle',
              )}
            />

            <CustomSearchInput
              inputText={accountName}
              setInputText={setAccountName}
              placeholderText={t(
                'settings.childAccounts.enterName.placeholder',
              )}
              autoFocus={true}
              onBlurFunction={() => setIsKeyboardActive(false)}
              onFocusFunction={() => setIsKeyboardActive(true)}
              maxLength={maxLength}
            />
            <ThemeText
              styles={{
                textAlign: 'right',
                color: characterCountColor,
                marginTop: 5,
              }}
              content={`${accountName.length} / ${maxLength}`}
            />
          </ScrollView>

          <CustomButton
            actionFunction={isEditing ? handleSave : handleContinue}
            buttonStyles={{
              ...CENTER,
              width: INSET_WINDOW_WIDTH,
              marginTop: CONTENT_KEYBOARD_OFFSET,
            }}
            textContent={t(isEditing ? 'constants.save' : 'constants.continue')}
          />
        </>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
});
