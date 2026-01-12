import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
} from '../../../../../constants';
import { CountryCodeList } from 'react-native-country-picker-modal';
import CountryFlag from 'react-native-country-flag';
import { getCountryInfoAsync } from 'react-native-country-picker-modal/lib/CountryService';
import { useCallback, useRef, useState } from 'react';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useKeysContext } from '../../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../../functions/customNavigation';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function CountryList(props) {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { toggleGlobalAppDataInformation, decodedGiftCards } =
    useGlobalAppData();
  const { bottomPadding } = useGlobalInsets();
  const { textColor, backgroundOffset } = GetThemeColors();
  const navigate = useNavigation();
  const [allCountries, setAllCountries] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [showList, setShowList] = useState(false);
  const didClick = useRef(false);
  const ISOCode = decodedGiftCards?.profile?.isoCode;
  const onlyReturn = props?.route?.params?.onlyReturn;
  const pageName = props?.route?.params?.pageName;
  const { t } = useTranslation();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowList(true);
      (async () => {
        const retriveCountries = async () => {
          const countryInfoList = await Promise.all(
            CountryCodeList.map(async code => {
              const info = await getCountryInfoAsync({ countryCode: code });
              return { ...info, code };
            }),
          );
          return countryInfoList;
        };
        const response = await retriveCountries();
        if (onlyReturn) {
          setAllCountries([
            { code: 'WW', countryName: 'World Wide' },
            ...response,
          ]);
        } else {
          setAllCountries(response);
        }
      })();

      return () => {
        console.log('Screen is unfocused');
        setShowList(false);
      };
    }, []),
  );
  useHandleBackPressNew();

  const saveNewCountrySetting = useCallback(
    async isoCode => {
      if (didClick.current) return;
      didClick.current = true;
      if (onlyReturn) {
        keyboardNavigate(() =>
          navigate.popTo(
            pageName,
            { removeUserLocal: isoCode },
            { merge: true },
          ),
        );
        return;
      }
      const em = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify({
          ...decodedGiftCards,
          profile: {
            ...decodedGiftCards.profile,
            isoCode: isoCode,
          },
        }),
      );

      toggleGlobalAppDataInformation({ giftCards: em }, true);

      keyboardGoBack(navigate);
      didClick.current = false;
    },
    [
      contactsPrivateKey,
      publicKey,
      decodedGiftCards,
      toggleGlobalAppDataInformation,
      navigate,
      onlyReturn,
      didClick,
    ],
  );

  const countries = allCountries.filter(item =>
    item.countryName.toLowerCase().startsWith(searchInput.toLowerCase()),
  );

  const flatListElement = useCallback(
    ({ index, item }) => {
      if (!item) return null;
      return (
        <TouchableOpacity
          onPress={() => {
            saveNewCountrySetting(item.code);
          }}
          style={{
            flexDirection: 'row',
            marginVertical: 20,
            alignItems: 'center',
          }}
        >
          <CheckMarkCircle
            isActive={ISOCode === item.code && !onlyReturn}
            containerSize={20}
          />
          <View style={{ marginLeft: 10 }}>
            {item.code === 'WW' ? (
              <View
                style={{
                  width: 40,
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  backgroundColor: backgroundOffset,
                }}
              >
                <ThemeIcon
                  size={20}
                  colorOverride={textColor}
                  iconName={'Globe'}
                />
              </View>
            ) : (
              <CountryFlag isoCode={item.code} size={25} />
            )}
          </View>
          <ThemeText
            styles={{
              marginLeft: 10,
              fontWeight: 500,
            }}
            content={item.countryName}
          />
        </TouchableOpacity>
      );
    },
    [ISOCode, saveNewCountrySetting],
  );

  const keyboardDismissBack = useCallback(() => {
    keyboardGoBack(navigate);
  }, [navigate]);

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={{
        paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
      }}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar customBackFunction={keyboardDismissBack} />
      <CustomSearchInput
        inputText={searchInput}
        setInputText={setSearchInput}
        placeholderText={t('apps.chatGPT.countrySearch.inputPlaceholder')}
        containerStyles={styles.searchInput}
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
      />
      {showList && (
        <FlatList
          contentContainerStyle={[
            styles.flatlist,
            { paddingBottom: bottomPadding },
          ]}
          renderItem={flatListElement}
          key={item => item.code}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={3}
          showsVerticalScrollIndicator={false}
          data={countries}
          keyboardShouldPersistTaps="always"
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flatlist: {
    width: '90%',
    ...CENTER,
  },
  searchInput: {
    width: '90%',
    marginTop: 0,
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
});
