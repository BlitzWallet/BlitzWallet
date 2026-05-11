import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CountryFlag from 'react-native-country-flag';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { countrymap } from './receiveCountryCodes';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

const AUTO_SELECT = { value: 999, label: 'Auto Select', iso: 'WW' };

// Deduplicate countrymap by iso code, keeping first occurrence
const uniqueCountries = (() => {
  const seen = new Set();
  return countrymap.filter(item => {
    if (seen.has(item.iso)) return false;
    seen.add(item.iso);
    return true;
  });
})();

export default function SMSMessagingReceiveCountryPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(AUTO_SELECT);
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  const listData = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const filtered = query
      ? uniqueCountries.filter(item => item.label.toLowerCase().includes(query))
      : uniqueCountries;
    return [AUTO_SELECT, ...filtered];
  }, [searchInput]);

  const handleNext = useCallback(() => {
    navigate.navigate('SMSMessagingReceivedPage', {
      selectedCountry,
    });
  }, [navigate, selectedCountry]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        label={t('constants.receive')}
        shouldDismissKeyboard={true}
      />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('apps.sms4sats.receivePage.countryStepTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('apps.sms4sats.receivePage.autoSelectInfoMessage')}
        />

        <CustomSearchInput
          inputText={searchInput}
          setInputText={setSearchInput}
          placeholderText={t(
            'apps.sms4sats.receivePage.countrySearchPlaceholder',
          )}
          containerStyles={styles.searchContainer}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
        />

        <FlatList
          data={listData}
          keyExtractor={item => `${item.iso}-${item.value}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => {
            const isActive =
              selectedCountry.iso === item.iso &&
              selectedCountry.value === item.value;
            return (
              <TouchableOpacity
                onPress={() => setSelectedCountry(item)}
                style={[
                  styles.countryRow,
                  isActive ? styles.countryRowActive : null,
                  {
                    borderColor:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                    backgroundColor: backgroundOffset,
                  },
                ]}
              >
                {item.iso === 'WW' ? (
                  <ThemeIcon iconName={'Globe'} size={24} />
                ) : (
                  <CountryFlag isoCode={item.iso} size={24} />
                )}
                <View style={styles.countryTextContainer}>
                  <ThemeText styles={styles.countryName} content={item.label} />
                </View>
                <CheckMarkCircle
                  switchDarkMode={true}
                  containerSize={20}
                  isActive={isActive}
                />
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <CustomButton
        buttonStyles={[styles.button]}
        textContent={t('constants.next')}
        actionFunction={handleNext}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
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
    includeFontPadding: false,
  },
  searchContainer: {
    width: '100%',
    marginTop: 0,
    marginBottom: 16,
  },
  listContent: {
    width: '100%',
    paddingBottom: 8,
  },
  countryRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  countryRowActive: {
    borderWidth: 1,
  },
  countryTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  countryName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
