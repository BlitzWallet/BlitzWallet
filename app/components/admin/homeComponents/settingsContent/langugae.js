import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { supportedLanguagesList } from '../../../../../locales/localeslist';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';

export default function ChooseLangugae() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const selectedLanguage = masterInfoObject?.userSelectedLanguage;

  const filteredList = useMemo(() => {
    const search = searchInput.toLowerCase();
    return supportedLanguagesList.filter(item =>
      t(item.translatedName).toLowerCase().startsWith(search),
    );
  }, [searchInput, t]);

  const selectedLanguageText = useMemo(() => {
    return supportedLanguagesList.find(item => item.id === selectedLanguage);
  }, [selectedLanguage]);

  const updateLanguageSetting = useCallback(
    item => {
      if (item.id === selectedLanguage) return;
      toggleMasterInfoObject({ userSelectedLanguage: item.id });
    },
    [selectedLanguage, toggleMasterInfoObject],
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.language')} />
        <View style={styles.search}>
          <SearchField
            pill
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t(selectedLanguageText?.languageName)}
          />
        </View>
        <ListCard dividerInset={0} style={styles.card}>
          <FlatList
            data={filteredList}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: height - 240 }}
            ItemSeparatorComponent={LanguageSeparator}
            renderItem={({ item }) => (
              <PickRow
                title={t(item.translatedName)}
                minHeight={52}
                titleStyle={styles.rowTitle}
                selected={
                  item.id?.toLowerCase() === selectedLanguage?.toLowerCase()
                }
                onPress={() => updateLanguageSetting(item)}
              />
            )}
          />
        </ListCard>
      </View>
    </GlobalThemeView>
  );
}

const keyExtractor = item => item.id;

function LanguageSeparator() {
  return <ListDivider inset={0} />;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  search: { marginTop: 16 },
  card: { marginTop: 16 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
