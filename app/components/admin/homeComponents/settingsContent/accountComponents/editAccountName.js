import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, WINDOWWIDTH } from '../../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../constants';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';

export default function EditAccountName(props) {
  const selectedAccount = props?.route?.params?.account;
  const maxLength = 50;
  const { updateAccount } = useActiveCustodyAccount();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [accountName, setAccountName] = useState(selectedAccount.name || '');
  const { textColor } = GetThemeColors();

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

  const isOverLimit = accountName.length >= maxLength;
  const characterCountColor = isOverLimit
    ? theme && darkModeType
      ? textColor
      : COLORS.cancelRed
    : textColor;

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
        buttonStyles={{ ...CENTER }}
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
