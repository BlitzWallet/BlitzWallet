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
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import { sendCountryCodes } from './sendCountryCodes';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';

export default function SMSMessagingSendPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  const filteredCountries = useMemo(() => {
    const normalizedQuery = searchInput.trim().toLowerCase();

    return sendCountryCodes.filter(item => {
      if (!normalizedQuery.length) return true;

      return (
        item.country.toLowerCase().includes(normalizedQuery) ||
        item.cc.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [searchInput]);

  const handleCountrySelection = useCallback(() => {
    if (!selectedCountry) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.sms4sats.sendPage.noCountry'),
      });
      return;
    }
    navigate.navigate('SMSMessagingSendPhonePage', {
      selectedCountry,
    });
  }, [selectedCountry, t]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        label={t('constants.send')}
        shouldDismissKeyboard={true}
      />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('apps.sms4sats.sendPage.countryStepTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('apps.sms4sats.sendPage.countryStepSubtitle')}
        />

        <CustomSearchInput
          inputText={searchInput}
          setInputText={setSearchInput}
          placeholderText={t('apps.sms4sats.sendPage.countrySearchPlaceholder')}
          containerStyles={styles.searchContainer}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
        />

        <FlatList
          data={filteredCountries}
          keyExtractor={item => `${item.country}-${item.cc}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => {
            const isActive =
              selectedCountry?.country === item.country &&
              selectedCountry?.cc === item.cc;

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
                <CountryFlag isoCode={item.isoCode} size={24} />
                <View style={styles.countryTextContainer}>
                  <ThemeText
                    styles={styles.countryName}
                    content={item.country}
                  />
                  <ThemeText styles={styles.countryCode} content={item.cc} />
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
        buttonStyles={[
          styles.button,
          { opacity: selectedCountry ? 1 : HIDDEN_OPACITY },
        ]}
        textContent={t('constants.next')}
        actionFunction={handleCountrySelection}
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
  countryCode: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginTop: 4,
    includeFontPadding: false,
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
