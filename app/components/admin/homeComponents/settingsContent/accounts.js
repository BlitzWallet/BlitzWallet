import {useCallback, useEffect, useState} from 'react';
import {CENTER, ICONS} from '../../../../constants';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {retrieveData, storeData} from '../../../../functions';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import {formatDateToDayMonthYear} from '../../../../functions/rotateAddressDateChecker';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import ProfileImageContainer from '../../../../functions/CustomElements/profileImageContianer';
import {useActiveCustodyAccount} from '../../../../../context-store/activeAccount';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {useKeysContext} from '../../../../../context-store/keys';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {initWallet} from '../../../../functions/initiateWalletConnection';
import {useSparkWallet} from '../../../../../context-store/sparkContext';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    isUsingAltAccount,
    selectedAltAccount,
    custodyAccounts,
    updateAccountCacheOnly,
    currentWalletMnemoinc,
    nostrSeed,
    toggleIsUsingNostr,
    isUsingNostr,
  } = useActiveCustodyAccount();
  const {setSparkInformation} = useSparkWallet();
  const {accountMnemoinc} = useKeysContext();
  const {backgroundOffset, backgroundColor, textColor} = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const {masterInfoObject} = useGlobalContextProvider();
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: '',
  });

  const enabledNWC =
    masterInfoObject.NWC.accounts &&
    !!Object.keys(masterInfoObject.NWC.accounts).length;

  const accounts = enabledNWC
    ? [
        {name: 'Main Wallet', mnemoinc: accountMnemoinc},
        {name: 'NWC', mnemoinc: nostrSeed},
        ...custodyAccounts,
      ]
    : [{name: 'Main Wallet', mnemoinc: accountMnemoinc}, ...custodyAccounts];

  const accountElements = accounts
    .filter(account =>
      account.name?.toLowerCase()?.startsWith(searchInput.toLowerCase()),
    )
    .map((account, index) => {
      return (
        <TouchableOpacity
          activeOpacity={1}
          key={index}
          onLongPress={() => {
            navigate.navigate('ConfirmActionPage', {
              confirmMessage: 'Are you sure you want to delete this account?',
              confirmFunction: () => removeAccount(account),
              cancelFunction: () => console.log('CANCELED'),
            });
          }}>
          <View
            style={{
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              ...styles.accountRow,
            }}>
            {/* <ProfileImageContainer
            activeOpacity={1}
            imageURL={account.imgURL}
            showSelectPhotoIcon={false}
            imageStyles={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginBottom: 0,
              backgroundColor: backgroundColor,
            }}
            containerStyles={{marginRight: 10}}
          /> */}
            <View style={{flex: 1}}>
              <ThemeText CustomNumberOfLines={1} content={account.name} />
              {/* <ThemeText
              CustomNumberOfLines={1}
              content={formatDateToDayMonthYear(account.dateCreated)}
            /> */}
            </View>
            <CustomButton
              actionFunction={async () => {
                if (currentWalletMnemoinc === account.mnemoinc) return;

                setIsLoading({
                  accountBeingLoaded: account.mnemoinc,
                  isLoading: true,
                });
                await new Promise(res => setTimeout(res, 500));
                const initResponse = await initWallet({
                  setSparkInformation,
                  mnemonic: account.mnemoinc,
                });
                if (!initResponse.didWork) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: initResponse.error,
                  });
                }

                if (account.name === 'Main Wallet') {
                  await updateAccountCacheOnly({
                    ...selectedAltAccount[0],
                    isActive: false,
                  });
                  toggleIsUsingNostr(false);
                } else if (account.name === 'NWC') {
                  await updateAccountCacheOnly({
                    ...selectedAltAccount[0],
                    isActive: false,
                  });
                  toggleIsUsingNostr(true);
                } else {
                  await updateAccountCacheOnly({...account, isActive: true});
                  toggleIsUsingNostr(false);
                }
                setIsLoading({
                  accountBeingLoaded: account.mnemoinc,
                  isLoading: false,
                });
              }}
              buttonStyles={{
                backgroundColor:
                  currentWalletMnemoinc === account.mnemoinc
                    ? theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary
                    : backgroundColor,
              }}
              textStyles={{
                color:
                  currentWalletMnemoinc === account.mnemoinc
                    ? theme && darkModeType
                      ? COLORS.lightModeText
                      : COLORS.darkModeText
                    : textColor,
              }}
              textContent={
                currentWalletMnemoinc === account.mnemoinc ? 'Active' : 'Select'
              }
              useLoading={
                isLoading.accountBeingLoaded === account.mnemoinc &&
                isLoading.isLoading
              }
            />
            {account.name !== 'Main Wallet' && account.name !== 'NWC' && (
              <TouchableOpacity
                style={[
                  styles.viewAccountArrowContainer,
                  {backgroundColor: backgroundColor},
                ]}
                onPress={() => {
                  navigate.navigate('ViewCustodyAccount', {
                    account,
                  });
                }}>
                <ThemeImage
                  styles={styles.arrowIcon}
                  lightModeIcon={ICONS.keyIcon}
                  darkModeIcon={ICONS.keyIcon}
                  lightsOutIcon={ICONS.keyIconWhite}
                />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={'Accounts'}
        showLeftImage={true}
        leftImageBlue={ICONS.xSmallIcon}
        LeftImageDarkMode={ICONS.xSmallIconWhite}
        leftImageStyles={{transform: [{rotate: '45deg'}]}}
        leftImageFunction={() => navigate.navigate('CreateCustodyAccount')}
      />
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={{width: INSET_WINDOW_WIDTH, ...CENTER}}
        showsVerticalScrollIndicator={false}>
        <CustomSearchInput
          containerStyles={{paddingTop: 10, marginBottom: 10, backgroundColor}}
          inputText={searchInput}
          setInputText={setSearchInput}
          placeholderText="Account name"
        />
        {accountElements}
      </ScrollView>
      <CustomButton buttonStyles={{...CENTER}} textContent={'Swap Funds'} />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 30,
  },
  accountRow: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  viewAccountArrowContainer: {
    backgroundColor: 'red',
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  arrowIcon: {
    width: 25,
    height: 25,
    transform: [{rotate: '180deg'}],
  },
});
