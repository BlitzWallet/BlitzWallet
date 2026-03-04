import { useState, useCallback } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  VALID_USERNAME_REGEX,
} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { canUsePOSName } from '../../../../../../db';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import {
  FONT,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../../functions/customNavigation';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { fiatCurrencies } from '../../../../../functions/currencyOptions';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import { useImageCache } from '../../../../../../context-store/imageCache';
import BrandLogoUploader from './internalComponents/brandLogoUploader';

const StoreNameInput = ({ value, onChange, onFocus, onBlur, theme }) => {
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  return (
    <View style={styles.inputSection}>
      <ThemeText
        styles={styles.sectionCardLabel}
        content={t('settings.posPath.settings.storeNameInputDesc')}
      />
      <View style={[styles.sectionCard, { backgroundColor: backgroundOffset }]}>
        <CustomSearchInput
          setInputText={onChange}
          inputText={value}
          placeholderText={t(
            'settings.posPath.settings.storeNameInputPlaceholder',
          )}
          containerStyles={[
            styles.inputContainer,
            { backgroundColor: theme ? backgroundColor : COLORS.darkModeText },
          ]}
          onBlurFunction={onBlur}
          onFocusFunction={onFocus}
          shouldDelayBlur={false}
        />
      </View>
    </View>
  );
};

const CurrencySelector = ({ currentCurrency, onCurrencyChange, theme }) => {
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const currencyOptions = fiatCurrencies
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(currency => ({
      label: `${currency.id} - ${currency.info.name}`,
      value: currency.id,
    }));

  const selectedCurrencyLabel = currencyOptions.find(
    opt => opt.value === currentCurrency,
  )?.label;

  return (
    <View style={styles.inputSection}>
      <ThemeText
        styles={styles.sectionCardLabel}
        content={t('settings.posPath.settings.displayCurrencyDesc')}
      />
      <View style={[styles.sectionCard, { backgroundColor: backgroundOffset }]}>
        <DropdownMenu
          options={currencyOptions}
          selectedValue={selectedCurrencyLabel}
          onSelect={value => {
            const selectedOption = currencyOptions.find(
              opt => opt.label === value.label,
            );
            if (selectedOption) {
              onCurrencyChange(selectedOption.value);
            }
          }}
          dropdownItemCustomStyles={styles.dropdownItemStyles}
          placeholder={currentCurrency}
          showClearIcon={false}
          showVerticalArrowsAbsolute={true}
          // globalContainerStyles={styles.dropdownContainer}
          customButtonStyles={{
            backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
          }}
          translateLabelText={false}
        />
      </View>
    </View>
  );
};

const ItemsSection = ({ itemCount, showErrorIcon, onNavigate, onInfo }) => {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  return (
    <View style={styles.inputSection}>
      <ThemeText
        styles={styles.sectionCardLabel}
        content={t('settings.posPath.settings.addProducts')}
      />
      <View
        style={[styles.addItemContainer, { backgroundColor: backgroundOffset }]}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.itemsText}
          content={t('settings.posPath.settings.numAddeditems', {
            number: itemCount,
            isPlurl:
              itemCount !== 1 ? t('settings.posPath.settings.plurlEnding') : '',
          })}
        />
        <TouchableOpacity onPress={onInfo} style={styles.infoButton}>
          {showErrorIcon ? (
            <ThemeIcon
              size={20}
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed
              }
              iconName={'CircleAlert'}
            />
          ) : (
            <ThemeIcon size={20} iconName={'Info'} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNavigate}
          style={[
            styles.chevronButton,
            { backgroundColor: theme ? backgroundColor : COLORS.darkModeText },
          ]}
        >
          <ThemeIcon size={20} iconName={'ChevronRight'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function PosSettingsPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { isConnectedToTheInternet, screenDimensions } = useAppStatus();
  const { cache } = useImageCache();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const [storeNameInput, setStoreNameInput] = useState(
    masterInfoObject?.posSettings?.storeName,
  );
  const logoKey = masterInfoObject?.posSettings?.brandLogo;
  const cachedImageData = logoKey ? cache?.[logoKey] : null;

  const brandLogoUri = cachedImageData?.localUri || null;
  const brandLogoUpdated = cachedImageData?.updated || null;

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();

  const currentCurrency = masterInfoObject?.posSettings?.storeCurrency;
  const posItemsList = masterInfoObject?.posSettings?.items || [];

  const showErrorIcon = posItemsList.filter(
    item => item.initialCurrency !== currentCurrency,
  ).length;

  const savePOSSettings = async (newData, type) => {
    if (type === 'storeName') {
      if (
        newData.storeNameLower === masterInfoObject.posSettings.storeNameLower
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.posPath.settings.nameTakenError'),
        });
        return;
      }
      if (!VALID_USERNAME_REGEX.test(newData.storeNameLower)) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.posPath.settings.nameRegexError'),
        });
        return;
      }

      const isValidPosName = await canUsePOSName(
        'blitzWalletUsers',
        newData.storeNameLower,
      );
      if (!isValidPosName) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.posPath.settings.nameTakenError'),
        });
        setStoreNameInput(masterInfoObject.posSettings.storeName);
        return;
      }
    }
    toggleMasterInfoObject({
      posSettings: {
        ...masterInfoObject.posSettings,
        ...newData,
      },
    });
  };

  const handleLogoChange = useCallback(() => {
    savePOSSettings({ brandLogo: masterInfoObject.uuid + '_POS' }, 'brandLogo');
  }, [savePOSSettings, masterInfoObject.uuid]);

  const handleLogoRemove = useCallback(() => {
    savePOSSettings({ brandLogo: null }, 'brandLogo');
  }, [savePOSSettings]);

  const handleCurrencyChange = useCallback(
    currencyId => {
      Keyboard.dismiss();
      savePOSSettings({ storeCurrency: currencyId }, 'currency');
    },
    [savePOSSettings],
  );

  const handleItemsInfo = useCallback(() => {
    navigate.navigate('InformationPopup', {
      textContent: showErrorIcon
        ? t('settings.posPath.settings.differingCurrencyItemsError', {
            number: showErrorIcon,
          })
        : t('settings.posPath.settings.itemsDescription'),
      buttonText: t('constants.understandText'),
    });
  }, [showErrorIcon, navigate, t]);

  const handleSaveOrOpen = useCallback(() => {
    if (
      masterInfoObject.posSettings.storeName.toLowerCase() !==
      storeNameInput.toLowerCase()
    ) {
      savePOSSettings(
        {
          storeName: storeNameInput.trim(),
          storeNameLower: storeNameInput.trim().toLowerCase(),
        },
        'storeName',
      );
      return;
    } else {
      openWebBrowser({
        navigate,
        link: `https://pay.blitzwalletapp.com/${masterInfoObject.posSettings.storeName}`,
      });
    }
  }, [
    masterInfoObject.posSettings.storeName,
    storeNameInput,
    navigate,
    savePOSSettings,
  ]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => {
            keyboardGoBack(navigate);
          }}
        >
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>
        <ThemeText
          CustomNumberOfLines={1}
          CustomEllipsizeMode={'tail'}
          content={t('settings.posPath.settings.title')}
          styles={[
            styles.topBarText,
            { width: screenDimensions.width * 0.95 - 130 },
          ]}
        />

        <TouchableOpacity
          style={styles.infoIcon}
          onPress={() => {
            navigate.navigate('POSInstructionsPath');
          }}
        >
          <ThemeIcon iconName={'Info'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.receiptIcon}
          onPress={() => {
            keyboardNavigate(() => {
              if (!isConnectedToTheInternet) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t('errormessges.nointernet'),
                });
                return;
              }
              navigate.navigate('ViewPOSTransactions');
            });
          }}
        >
          <ThemeImage
            lightsOutIcon={ICONS.receiptWhite}
            darkModeIcon={ICONS.receiptIcon}
            lightModeIcon={ICONS.receiptIcon}
          />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={[styles.scrollView, CENTER]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: isKeyboardActive
              ? CONTENT_KEYBOARD_OFFSET
              : bottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BrandLogoUploader
          onLogoChange={handleLogoChange}
          onLogoRemove={handleLogoRemove}
          masterInfoObject={masterInfoObject}
          cachedImageData={cachedImageData}
          brandLogoUri={brandLogoUri}
          brandLogoUpdated={brandLogoUpdated}
        />

        <StoreNameInput
          value={storeNameInput}
          onChange={setStoreNameInput}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          theme={theme}
        />

        <CurrencySelector
          currentCurrency={currentCurrency}
          onCurrencyChange={handleCurrencyChange}
          theme={theme}
        />
        <ItemsSection
          itemCount={posItemsList.length}
          showErrorIcon={showErrorIcon}
          onNavigate={() => navigate.navigate('AddPOSItemsPage')}
          onInfo={handleItemsInfo}
        />
      </ScrollView>

      {!isKeyboardActive && (
        <CustomButton
          buttonStyles={[
            styles.mainButton,
            {
              backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
              marginBottom: bottomPadding,
            },
          ]}
          textStyles={{
            color: theme ? COLORS.lightModeText : COLORS.darkModeText,
          }}
          actionFunction={handleSaveOrOpen}
          textContent={
            masterInfoObject.posSettings.storeName.toLowerCase() !==
            storeNameInput.toLowerCase()
              ? t('constants.save')
              : t('settings.posPath.settings.openPos')
          }
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  backArrow: { position: 'absolute', top: 0, left: 0, zIndex: 1 },
  topBarText: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    ...CENTER,
  },
  infoIcon: { position: 'absolute', top: 0, right: 35, zIndex: 1 },
  receiptIcon: { position: 'absolute', top: 0, right: 0, zIndex: 1 },
  scrollView: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
  },
  scrollContent: {
    paddingTop: 16,
    gap: 16,
  },
  inputSection: {},
  sectionCard: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  sectionCardLabel: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    includeFontPadding: false,
    marginBottom: 8,
  },
  inputContainer: {
    marginTop: 8,
    borderRadius: 8,
  },
  dropdownContainer: {
    marginTop: 8,
  },
  dropdownItemStyles: {
    justifyContent: 'flex-start',
  },
  addItemContainer: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemsText: {
    includeFontPadding: false,
    marginRight: 8,
    flexShrink: 1,
  },
  infoButton: {
    marginRight: 8,
  },
  chevronButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  mainButton: {
    width: WINDOWWIDTH,
    alignSelf: 'center',
  },
});
