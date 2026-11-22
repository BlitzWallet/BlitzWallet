import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
} from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { supportedLanguagesList } from '../../../../../locales/localeslist';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import HideOnScrollView from '../../../../functions/CustomElements/redesign/HideOnScrollView';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';

export default function ChooseLangugae() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { width } = useWindowDimensions();
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
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
      useTouchableWithoutFeedback={true}
    >
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar fade title={t('screens.inAccount.settingsContent.language')} />
        <HideOnScrollView
          topInset={FADE_TOP}
          keyboardShouldPersistTaps="always"
          header={
            <SearchField
              pill
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder={t(selectedLanguageText?.languageName)}
              onFocus={() => setIsKeyboardActive(true)}
              onBlur={() => setIsKeyboardActive(false)}
            />
          }
        >
          {filteredList.length === 0 ? (
            <View style={styles.empty}>
              <EmptyState
                icon="Search"
                title={t('constants.noSearchResults')}
                sub={t('constants.noSearchResultsSub')}
              />
            </View>
          ) : (
            <ListCard dividerInset={0}>
              {filteredList.map(item => (
                <PickRow
                  key={item.id}
                  title={t(item.translatedName)}
                  minHeight={52}
                  titleStyle={styles.rowTitle}
                  selected={
                    item.id?.toLowerCase() === selectedLanguage?.toLowerCase()
                  }
                  onPress={() => updateLanguageSetting(item)}
                />
              ))}
            </ListCard>
          )}
        </HideOnScrollView>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  empty: { marginTop: 48 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
