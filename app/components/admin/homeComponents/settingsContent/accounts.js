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

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [accounts, setAccounts] = useState([]);
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  useFocusEffect(
    useCallback(() => {
      async function loadAccounts() {
        console.log('Loading Accouts');

        try {
          const accountInformation = JSON.parse(
            await retrieveData('CustodyAccounts'),
          );
          console.log(accountInformation, 'testing');
          if (!accountInformation) return;

          setAccounts(accountInformation);
        } catch (err) {
          console.log(err);
          navigate.navigate('ErrorScreen', {errorMessage: err.message});
        }
      }
      loadAccounts();
    }, []),
  );

  const removeAccount = async account => {
    try {
      let accountInformation = JSON.parse(
        await retrieveData('CustodyAccounts'),
      );
      let newAccounts = accountInformation.filter(accounts => {
        return accounts.mnemoinc !== account.mnemoinc;
      });
      await storeData('CustodyAccounts', JSON.stringify(newAccounts));
      setAccounts(newAccounts);
    } catch (err) {
      console.log('Remove account error', err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    }
  };

  if (!accounts.length) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          label={'Accounts'}
          showLeftImage={true}
          leftImageBlue={ICONS.xSmallIcon}
          LeftImageDarkMode={ICONS.xSmallIconWhite}
          leftImageStyles={{transform: [{rotate: '45deg'}]}}
          leftImageFunction={() =>
            navigate.navigate('CreateCustodyAccount', {accounts})
          }
        />
        <ScrollView
          contentContainerStyle={{width: INSET_WINDOW_WIDTH, ...CENTER}}
          showsVerticalScrollIndicator={false}>
          <ThemeText styles={styles.sectionHeader} content={'About'} />

          <ThemeText
            styles={{textAlign: 'center'}}
            content={
              'The Accounts section lets you create separate wallets within your main wallet. It’s perfect for saving bitcoin for someone else so you can send funds over time and hand them the keys when they’re ready.'
            }
          />
          <ThemeText styles={styles.sectionHeader} content={'Good To Know'} />
          <ThemeText
            styles={{textAlign: 'center'}}
            content={
              'Blitz is a hot wallet, so keys are online and less secure than hardware storage. For large amounts, use a hardware wallet. If you create an account for someone else, you’ll still know the keys, make sure they know that.'
            }
          />
          <CustomButton
            buttonStyles={{marginTop: 30, ...CENTER}}
            actionFunction={() =>
              navigate.navigate('CreateCustodyAccount', {accounts})
            }
            textContent={'Create Account'}
          />
        </ScrollView>
      </GlobalThemeView>
    );
  }

  const accountElements = accounts.map((account, index) => {
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
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              overflow: 'hidden',
              marginRight: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor,
            }}>
            <Image
              source={
                account.imgURL
                  ? {
                      uri: account.imgURL,
                    }
                  : darkModeType && theme
                  ? ICONS.userWhite
                  : ICONS.userIcon
              }
              style={
                account.imgURL
                  ? {width: '100%', aspectRatio: 1}
                  : {width: '50%', height: '50%'}
              }
            />
          </View>
          <View style={{flex: 1}}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={{fontSize: SIZES.large}}
              content={account.name}
            />
            <ThemeText
              CustomNumberOfLines={1}
              content={formatDateToDayMonthYear(account.dateCreated)}
            />
          </View>
          <CustomButton
            actionFunction={() =>
              navigate.navigate('ViewCustodyAccount', {account})
            }
            textContent={'View'}
            buttonStyles={{
              backgroundColor: backgroundColor,
              width: 'auto',
            }}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={'Accounts'}
        shouldDismissKeyboard={true}
        showLeftImage={true}
        leftImageBlue={ICONS.xSmallIcon}
        LeftImageDarkMode={ICONS.xSmallIconWhite}
        leftImageStyles={{transform: [{rotate: '45deg'}]}}
        leftImageFunction={() =>
          navigate.navigate('CreateCustodyAccount', {accounts})
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {accountElements}
      </ScrollView>
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
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
});
