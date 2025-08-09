import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {useActiveCustodyAccount} from '../../../../../context-store/activeAccount';
import {useMemo, useState} from 'react';
import ProfileImageContainer from '../../../../functions/CustomElements/profileImageContianer';
import GetThemeColors from '../../../../hooks/themeColors';
import sha256Hash from '../../../../functions/hash';
import {formatDateToDayMonthYear} from '../../../../functions/rotateAddressDateChecker';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {initWallet} from '../../../../functions/initiateWalletConnection';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import CustomButton from '../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {useKeysContext} from '../../../../../context-store/keys';
import {useGlobalContextProvider} from '../../../../../context-store/context';

export default function SwitchCustodyAccountHalfModal() {
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
  const {masterInfoObject} = useGlobalContextProvider();
  const {accountMnemoinc} = useKeysContext();
  const {setSparkInformation} = useSparkWallet();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();

  const enabledNWC = !!Object.keys(masterInfoObject.NWC.accounts).length;

  const navigate = useNavigation();

  const accounts = enabledNWC
    ? [
        {name: 'Main Wallet', mnemoinc: accountMnemoinc},
        {name: 'NWC', mnemoinc: nostrSeed},
        ...custodyAccounts,
      ]
    : [{name: 'Main Wallet', mnemoinc: accountMnemoinc}, ...custodyAccounts];

  const accountsList = accounts.map((account, index) => {
    const [isLoading, setIsLoading] = useState(false);

    return (
      <View
        style={{
          ...styles.accountRow,
          backgroundColor:
            theme && darkModeType ? backgroundColor : backgroundOffset,
        }}
        key={sha256Hash(account.mnemoinc)}>
        <ProfileImageContainer
          activeOpacity={1}
          useLogo={account.name === 'Main Wallet' || account.name === 'NWC'}
          imageURL={account.imgURL}
          showSelectPhotoIcon={false}
          imageStyles={{
            width: 40,
            height: 40,
            borderRadius: 20,
            marginBottom: 0,
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}
          containerStyles={{marginRight: 10}}
        />

        <ThemeText
          CustomNumberOfLines={1}
          styles={{
            flexShrink: 1,
            marginRight: 'auto',
          }}
          content={account.name}
        />

        <CustomButton
          actionFunction={async () => {
            if (currentWalletMnemoinc === account.mnemoinc) return;

            setIsLoading(true);
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
            setIsLoading(false);
          }}
          buttonStyles={{
            backgroundColor:
              currentWalletMnemoinc === account.mnemoinc
                ? theme && darkModeType
                  ? backgroundOffset
                  : COLORS.primary
                : COLORS.darkModeText,
          }}
          textStyles={{
            color:
              currentWalletMnemoinc === account.mnemoinc
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.darkModeText
                : COLORS.lightModeText,
          }}
          textContent={
            currentWalletMnemoinc === account.mnemoinc ? 'Active' : 'Select'
          }
          useLoading={isLoading}
        />
      </View>
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <ThemeText styles={styles.titleText} content={'Active Account'} />

        <ThemeText
          styles={{textAlign: 'center', marginTop: 5}}
          content={
            !isUsingAltAccount
              ? isUsingNostr
                ? 'NWC'
                : 'Main Wallet'
              : selectedAltAccount[0]?.name
          }
        />
        <ThemeText
          styles={{textAlign: 'left', marginTop: 20}}
          content={'Accounts'}
        />

        <ScrollView showsVerticalScrollIndicator={false}>
          {accountsList}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  innerContainer: {flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER},

  titleText: {
    fontSize: SIZES.large,
    textAlign: 'center',
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

  assetContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
  },

  tokenContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  tickerText: {marginRight: 'auto', includeFontPadding: false},
  balanceText: {includeFontPadding: false},
});
