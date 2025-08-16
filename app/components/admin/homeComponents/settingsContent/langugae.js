import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {supportedLanguagesList} from '../../../../../locales/localeslist';
import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {CENTER, COLORS} from '../../../../constants';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';

export default function ChooseLangugae() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {t} = useTranslation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor} = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const selectedLanguage = masterInfoObject?.userSelectedLanguage;

  const filteredList = supportedLanguagesList.filter(item =>
    t(item.translatedName).toLowerCase().startsWith(searchInput.toLowerCase()),
  );

  const updateLanguageSetting = useCallback(item => {
    toggleMasterInfoObject({userSelectedLanguage: item.id});
  }, []);

  const languageItem = ({item, index}) => {
    return (
      <TouchableOpacity
        style={[
          styles.currencyContainer,
          {
            marginTop: index === 0 ? 10 : 0,
          },
        ]}
        onPress={() => {
          updateLanguageSetting(item);
        }}>
        <CheckMarkCircle
          isActive={item.id?.toLowerCase() === selectedLanguage?.toLowerCase()}
          containerSize={25}
        />
        <ThemeText
          styles={{
            color: theme
              ? item.id?.toLowerCase() === selectedLanguage?.toLowerCase()
                ? darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : COLORS.darkModeText
              : item.id?.toLowerCase() === selectedLanguage?.toLowerCase()
              ? COLORS.primary
              : COLORS.lightModeText,
            marginLeft: 10,
          }}
          content={t(item.translatedName)}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredList}
        renderItem={languageItem}
        keyExtractor={(item, index) => item.id || index.toString()}
        ListHeaderComponent={
          <View style={[styles.searchContainer, {backgroundColor}]}>
            <CustomSearchInput
              inputText={searchInput}
              setInputText={setSearchInput}
              placeholderText={t('languages.english')}
            />
          </View>
        }
        stickyHeaderIndices={[0]} // makes the search input sticky
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  searchContainer: {
    paddingTop: 8,
  },
  currencyContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginTop: 10,
    paddingVertical: 10,
  },
});
