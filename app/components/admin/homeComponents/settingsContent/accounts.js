import {useState} from 'react';
import {CENTER, ICONS} from '../../../../constants';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useNavigation} from '@react-navigation/native';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useActiveCustodyAccount} from '../../../../../context-store/activeAccount';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {initWallet} from '../../../../functions/initiateWalletConnection';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import useCustodyAccountList from '../../../../hooks/useCustodyAccountsList';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    selectedAltAccount,
    updateAccountCacheOnly,
    currentWalletMnemoinc,
    toggleIsUsingNostr,
  } = useActiveCustodyAccount();
  const {setSparkInformation} = useSparkWallet();
  const {backgroundOffset, backgroundColor, textColor} = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: '',
  });

  const accounts = useCustodyAccountList();

  const accountElements = accounts
    .filter(account =>
      account.name?.toLowerCase()?.startsWith(searchInput.toLowerCase()),
    )
    .map((account, index) => {
      return (
        <View
          key={index}
          style={{
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            ...styles.accountRow,
          }}>
          <ThemeText
            styles={styles.accountName}
            CustomNumberOfLines={1}
            content={account.name}
          />

          {account.name !== 'Main Wallet' && (
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
              minWidth: 'unset',
              paddingHorizontal: 10,
              width: 'auto',
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
        </View>
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
      <CustomButton
        actionFunction={() => navigate.navigate('CustodyAccountPaymentPage')}
        buttonStyles={{...CENTER}}
        textContent={'Swap Funds'}
      />
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
    marginVertical: 5,
  },
  accountName: {
    width: '100%',
    includeFontPadding: false,
    flexShrink: 1,
    marginRight: 10,
  },
  viewAccountArrowContainer: {
    backgroundColor: 'red',
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  arrowIcon: {
    width: 25,
    height: 25,
  },
});
