import { useMemo, useState } from 'react';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { ScrollView, StyleSheet } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_DERIVED_ACCOUNTS,
  SIZES,
} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../../context-store/context';

export default function CreateCustodyAccountPage() {
  const maxLength = 50;
  const { masterInfoObject } = useGlobalContextProvider();
  const { createDerivedAccount } = useActiveCustodyAccount();
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [name, setName] = useState('');

  const { textInputColor } = GetThemeColors();

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
    } catch (err) {
      console.log('Create custody account error', err);
      setIsCreatingAccount(false);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      alignItems: 'center',
      position: 'relative',
      paddingBottom: isKeyboardActive
        ? CONTENT_KEYBOARD_OFFSET
        : bottomPadding,
    };
  }, [isKeyboardActive, bottomPadding]);

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={memorizedKeyboardStyle}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('settings.accounts.tabs.personal')}
        iconNew="Trash2"
      />

      <ScrollView
        style={{ width: INSET_WINDOW_WIDTH }}
        contentContainerStyle={{ paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.enterName.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.enterName.subtitle')}
        />
        <CustomSearchInput
          inputText={name}
          setInputText={setName}
          maxLength={maxLength}
          textInputStyles={{
            color: textInputColor,
          }}
          placeholderText={t('settings.childAccounts.enterName.placeholder')}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
        />
      </ScrollView>
      <CustomButton
        useLoading={isCreatingAccount}
        buttonStyles={{
          width: INSET_WINDOW_WIDTH,
          ...CENTER,
          opacity: !name ? HIDDEN_OPACITY : 1,
        }}
        textContent={t('settings.childAccounts.enterName.create')}
        actionFunction={handleCreateAccount}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
