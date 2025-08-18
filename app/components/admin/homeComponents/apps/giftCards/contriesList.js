import {FlatList, StyleSheet, TouchableOpacity} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {CENTER, COLORS} from '../../../../../constants';
import {CountryCodeList} from 'react-native-country-picker-modal';
import CountryFlag from 'react-native-country-flag';
import {getCountryInfoAsync} from 'react-native-country-picker-modal/lib/CountryService';
import {useCallback, useState} from 'react';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {useKeysContext} from '../../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {keyboardGoBack} from '../../../../../functions/customNavigation';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';

export default function CountryList() {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {toggleGlobalAppDataInformation, decodedGiftCards} = useGlobalAppData();
  const {textColor} = GetThemeColors();
  const navigate = useNavigation();
  const [allCountries, setAllCountries] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [showList, setShowList] = useState(false);
  const ISOCode = decodedGiftCards?.profile?.isoCode;

  useFocusEffect(
    useCallback(() => {
      setShowList(true);
      (async () => {
        const retriveCountries = async () => {
          const countryInfoList = await Promise.all(
            CountryCodeList.map(async code => {
              const info = await getCountryInfoAsync({countryCode: code});
              return {...info, code};
            }),
          );
          return countryInfoList;
        };
        const response = await retriveCountries();
        setAllCountries(response);
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

      toggleGlobalAppDataInformation({giftCards: em}, true);

      setTimeout(() => {
        navigate.goBack();
      }, 150);
    },
    [
      contactsPrivateKey,
      publicKey,
      decodedGiftCards,
      toggleGlobalAppDataInformation,
      navigate,
    ],
  );

  const countries = allCountries.filter(item =>
    item.countryName.toLowerCase().startsWith(searchInput.toLowerCase()),
  );

  const flatListElement = useCallback(
    ({index, item}) => {
      if (!item) return null;
      return (
        <TouchableOpacity
          onPress={() => {
            saveNewCountrySetting(item.code);
          }}
          style={{
            flexDirection: 'row',
            marginVertical: 20,
          }}>
          <CountryFlag isoCode={item.code} size={25} />
          <ThemeText
            styles={{
              marginLeft: 10,
              fontWeight: 500,
              color: ISOCode === item.code ? COLORS.primary : textColor,
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
    <CustomKeyboardAvoidingView useStandardWidth={true}>
      <CustomSettingsTopBar customBackFunction={keyboardDismissBack} />
      <CustomSearchInput
        inputText={searchInput}
        setInputText={setSearchInput}
        placeholderText={'Search'}
        containerStyles={styles.searchInput}
      />
      {showList && (
        <FlatList
          contentContainerStyle={styles.flatlist}
          renderItem={flatListElement}
          key={item => item.code}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={3}
          showsVerticalScrollIndicator={false}
          data={countries}
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
  searchInput: {width: '90%', marginTop: 0},
});
