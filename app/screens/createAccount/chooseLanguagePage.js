import {useCallback, useEffect, useMemo, useState} from 'react';
import {supportedLanguagesList} from '../../../locales/localeslist';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import DropdownMenu from '../../functions/CustomElements/dropdownMenu';
import {useTranslation} from 'react-i18next';
import CustomButton from '../../functions/CustomElements/button';
import {StyleSheet, View} from 'react-native';
import {CENTER, SIZES} from '../../constants';
import {COLORS, INSET_WINDOW_WIDTH} from '../../constants/theme';
import {useGlobalContextProvider} from '../../../context-store/context';
import {getLocalStorageItem} from '../../functions';
import {useNavigation} from '@react-navigation/native';

export default function ChooseLangugaePage() {
  const {toggleMasterInfoObject} = useGlobalContextProvider();
  const navigate = useNavigation();
  const [selectedValue, setSelectedValue] = useState(null);
  const {t} = useTranslation();

  useEffect(() => {
    async function getSavedLanguage() {
      const language = JSON.parse(
        await getLocalStorageItem('userSelectedLanguage'),
      );
      const selectedLanguage = supportedLanguagesList.find(
        item => item.id === language,
      );
      setSelectedValue(selectedLanguage?.languageName || 'English');
    }
    getSavedLanguage();
  }, []);

  const data = useMemo(() => {
    return supportedLanguagesList.map(item => ({
      label: t(item.translatedName),
      value: t(item.translatedName),
      id: item.id,
      flagCode: item.flagCode,
    }));
  }, [supportedLanguagesList, t]);

  const handleSelect = useCallback(item => {
    setSelectedValue(item.value);
    toggleMasterInfoObject({userSelectedLanguage: item.id});
  }, []);

  const goToNextPage = useCallback(() => {
    navigate.navigate('CreateAccountHome');
  }, [navigate]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <ThemeText
        styles={styles.headerText}
        content={t('createAccount.chooseLanguage.title')}
      />
      <View style={styles.dropdownContainer}>
        {selectedValue && (
          <DropdownMenu
            placeholder={selectedValue}
            selectedValue={selectedValue}
            onSelect={handleSelect}
            options={data}
            showClearIcon={false}
            showVerticalArrows={false}
            textStyles={styles.dropdownText}
            customButtonStyles={styles.dropdownButtonStyles}
            dropdownItemCustomStyles={styles.dropdownItemCustomStyles}
            showFlag={true}
          />
        )}
      </View>
      <CustomButton
        buttonStyles={styles.continueButton}
        textContent={t('constants.continue')}
        actionFunction={goToNextPage}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  headerText: {
    marginTop: 'auto',
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    marginBottom: 20,
  },
  dropdownContainer: {
    width: INSET_WINDOW_WIDTH,
    backgroundColor: COLORS.darkModeText,
    height: 46,
    borderRadius: 8,
    ...CENTER,
  },
  dropdownButtonStyles: {
    justifyContent: 'center',
  },
  dropdownText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  dropdownItemCustomStyles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  continueButton: {
    marginTop: 'auto',
    ...CENTER,
  },
});
