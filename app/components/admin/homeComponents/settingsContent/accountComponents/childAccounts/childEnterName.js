import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../../../functions/customNavigation';

export default function ChildEnterName(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const maxLength = 50;
  const editChild = props?.route?.params?.editChild;
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [accountName, setAccountName] = useState(editChild?.name || '');
  const didHandle = useRef(false);

  const handleNext = useCallback(async () => {
    const trimmed = accountName.trim();
    if (!trimmed) return;
    if (didHandle.current) return;
    didHandle.current = true;
    if (editChild) {
      const existing = masterInfoObject?.childAccounts || [];
      const updated = existing.map(item =>
        item.uuid === editChild.uuid ? { ...item, name: trimmed } : item,
      );
      await toggleMasterInfoObject({ childAccounts: updated });
      keyboardGoBack(navigate);
      return;
    }
    keyboardNavigate(() =>
      navigate.navigate('ChildSpendingLimit', { name: trimmed }),
    );
  }, [
    accountName,
    editChild,
    masterInfoObject,
    toggleMasterInfoObject,
    navigate,
  ]);

  useFocusEffect(
    useCallback(() => {
      didHandle.current = false;
    }, []),
  );

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('settings.childAccounts.tabs.children')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
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
          inputText={accountName}
          setInputText={setAccountName}
          placeholderText={t('settings.childAccounts.enterName.placeholder')}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
          maxLength={maxLength}
        />
      </ScrollView>
      <CustomButton
        buttonStyles={{
          ...CENTER,
          width: INSET_WINDOW_WIDTH,
          opacity: !accountName.trim() ? HIDDEN_OPACITY : 1,
        }}
        textContent={
          editChild
            ? t('constants.save')
            : t('settings.childAccounts.enterName.next')
        }
        actionFunction={handleNext}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingTop: 10,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: 20,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: 20,
  },
});
