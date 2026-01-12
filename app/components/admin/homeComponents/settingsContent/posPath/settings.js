import { useMemo, useState } from 'react';
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
} from '../../../../../constants/theme';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../../functions/customNavigation';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { fiatCurrencies } from '../../../../../functions/currencyOptions';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function PosSettingsPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { isConnectedToTheInternet, screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const [textInput, setTextInput] = useState('');
  const [storeNameInput, setStoreNameInput] = useState(
    masterInfoObject?.posSettings?.storeName,
  );
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();

  const savedCurrencies = useMemo(() => {
    return fiatCurrencies.sort((a, b) => a.id.localeCompare(b.id));
  }, []);

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

  const CurrencyElements = useMemo(() => {
    return savedCurrencies
      .filter(currency => {
        if (
          currency.info.name
            .toLowerCase()
            .startsWith(textInput.toLowerCase()) ||
          currency.id.toLowerCase().startsWith(textInput.toLowerCase())
        )
          return currency;
        else return false;
      })
      .map((item, index) => {
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.currencyContainer,

              {
                marginTop: index === 0 ? 10 : 0,
              },
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setTextInput('');
              savePOSSettings({ storeCurrency: item.id }, 'currency');
            }}
          >
            <CheckMarkCircle
              isActive={
                item.id?.toLowerCase() === currentCurrency?.toLowerCase()
              }
              containerSize={25}
            />
            <ThemeText
              styles={{
                color: theme
                  ? item.id?.toLowerCase() === currentCurrency?.toLowerCase()
                    ? darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary
                    : COLORS.darkModeText
                  : item.id?.toLowerCase() === currentCurrency?.toLowerCase()
                  ? COLORS.primary
                  : COLORS.lightModeText,
                marginLeft: 10,
                includeFontPadding: false,
              }}
              content={`${item.id} - ${item.info.name}`}
            />
          </TouchableOpacity>
        );
      });
  }, [textInput, currentCurrency, masterInfoObject, theme, darkModeType]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={{ ...styles.topbar }}>
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
          styles={{
            ...styles.topBarText,
            width: screenDimensions.width * 0.95 - 130,
          }}
        />

        <TouchableOpacity
          style={{ position: 'absolute', top: 0, right: 35, zIndex: 1 }}
          onPress={() => {
            navigate.navigate('POSInstructionsPath');
          }}
        >
          <ThemeIcon iconName={'Info'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}
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
        style={{ flex: 1, width: '95%', ...CENTER }}
        contentContainerStyle={{
          paddingBottom: isKeyboardActive
            ? CONTENT_KEYBOARD_OFFSET
            : bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <ThemeText
            content={t('settings.posPath.settings.storeNameInputDesc')}
          />
          <CustomSearchInput
            setInputText={setStoreNameInput}
            inputText={storeNameInput}
            placeholderText={t(
              'settings.posPath.settings.storeNameInputPlaceholder',
            )}
            containerStyles={{ marginTop: 10 }}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
            shouldDelayBlur={false}
          />
        </View>

        {/* Sticky Header Section */}
        <View style={{ backgroundColor: backgroundColor, paddingTop: 10 }}>
          <ThemeText
            content={t('settings.posPath.settings.displayCurrencyDesc')}
          />
          <CustomSearchInput
            inputText={textInput}
            setInputText={setTextInput}
            placeholderText={currentCurrency}
            containerStyles={{
              marginTop: 10,
              marginBottom: CONTENT_KEYBOARD_OFFSET,
            }}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
            shouldDelayBlur={false}
          />
        </View>
        {CurrencyElements}
      </ScrollView>
      <View
        style={{
          ...styles.addItemContainer,
          marginBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 20,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={{ includeFontPadding: false, marginRight: 5, flexShrink: 1 }}
          content={t('settings.posPath.settings.numAddeditems', {
            number: posItemsList.length,
            isPlurl:
              posItemsList.length !== 1
                ? t('settings.posPath.settings.plurlEnding')
                : '',
          })}
        />
        <TouchableOpacity
          onPress={() =>
            navigate.navigate('InformationPopup', {
              textContent: showErrorIcon
                ? t('settings.posPath.settings.differingCurrencyItemsError', {
                    number: showErrorIcon,
                  })
                : t('settings.posPath.settings.itemsDescription'),
              buttonText: t('constants.understandText'),
            })
          }
          style={{ marginRight: 5 }}
        >
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
          onPress={() => navigate.navigate('AddPOSItemsPage')}
          style={{
            backgroundColor,
            padding: 5,
            borderRadius: 8,
            marginLeft: 'auto',
          }}
        >
          <ThemeIcon iconName={'ChevronRight'} />
        </TouchableOpacity>
      </View>

      {!isKeyboardActive && (
        <>
          <CustomButton
            buttonStyles={{
              width: INSET_WINDOW_WIDTH,
              alignSelf: 'center',
              backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
              marginBottom: isKeyboardActive
                ? CONTENT_KEYBOARD_OFFSET
                : bottomPadding,
            }}
            textStyles={{
              color: theme ? COLORS.lightModeText : COLORS.darkModeText,
            }}
            actionFunction={() => {
              if (
                masterInfoObject.posSettings.storeNameLower !==
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
            }}
            textContent={
              masterInfoObject.posSettings.storeName.toLowerCase() !==
              storeNameInput.toLowerCase()
                ? t('constants.save')
                : t('settings.posPath.settings.openPos')
            }
          />
        </>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  backArrow: { position: 'absolute', top: 0, left: 0, zIndex: 1 },

  topBarText: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    ...CENTER,
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
  addItemContainer: {
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: INSET_WINDOW_WIDTH,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
