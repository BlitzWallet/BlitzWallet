import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import CountryFlag from 'react-native-country-flag';
import { useTranslation } from 'react-i18next';
import { CustomKeyboardAvoidingView } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import ListCard, {
  ListDivider,
} from '../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';
import useContentWidth from '../../../../../functions/CustomElements/redesign/useContentWidth';

// Country step shared by Send and Receive. Each country is
// { key, label, sub?, isoCode } — isoCode 'WW' draws a globe (Auto select).
// `pinned` rows stay on top and ignore the search.
export default function SMSCountryPickerScreen({
  topBarTitle,
  title,
  sub,
  countries,
  pinned = [],
  selectedKey,
  onSelect,
  onNext,
}) {
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const contentWidth = useContentWidth();
  const [searchInput, setSearchInput] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  const listData = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const filtered = query
      ? countries.filter(
          item =>
            item.label.toLowerCase().includes(query) ||
            item.sub?.toLowerCase().includes(query),
        )
      : countries;
    return [...pinned, ...filtered];
  }, [countries, pinned, searchInput]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={topBarTitle} shouldDismissKeyboard={true} />
        <PageHeader title={title} sub={sub} />
        <SearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t('apps.sms4sats.sendPage.countrySearchPlaceholder')}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          pill
        />
        <ListCard style={styles.card}>
          <FlatList
            data={listData}
            keyExtractor={item => item.key}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            ItemSeparatorComponent={ListDivider}
            renderItem={({ item }) => (
              <PickRow
                onPress={() => onSelect(item)}
                lead={
                  <View
                    style={[styles.flag, { backgroundColor: tokens.ground }]}
                  >
                    {item.isoCode === 'WW' ? (
                      <ThemeIcon
                        redesign
                        iconName="Globe"
                        size={20}
                        colorOverride={tokens.ink}
                      />
                    ) : (
                      <CountryFlag isoCode={item.isoCode} size={14} />
                    )}
                  </View>
                }
                title={item.label}
                sub={item.sub}
                selected={item.key === selectedKey}
              />
            )}
          />
        </ListCard>
        <CustomButton
          disabled={!selectedKey}
          textContent={t('constants.next')}
          actionFunction={onNext}
          size="regular"
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  card: {
    marginTop: 10,
    flexShrink: 1,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  flag: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
