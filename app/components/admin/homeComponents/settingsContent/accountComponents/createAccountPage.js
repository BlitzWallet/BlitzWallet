import {useCallback, useEffect, useState} from 'react';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import TextInputWithSliderSettingsItem from '../../../../../functions/CustomElements/settings/textInputWIthSliderSettingsItem';
import {ScrollView, View} from 'react-native';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import {KeyContainer} from '../../../../login';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {retrieveData, storeData} from '../../../../../functions';

export default function CreateCustodyAccountPage() {
  const [accountInformation, setAccountInformation] = useState({
    name: '',
    mnemoinc: '',
    dateCreated: '',
    password: '',
    isPasswordEnabled: false,
  });
  const [isKeyboardActive, stIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  useEffect(() => {
    async function initalizeAccount() {
      let generatedMnemonic = generateMnemonic(wordlist);
      const unuiqueKeys = new Set(generatedMnemonic.split(' '));

      if (unuiqueKeys.size !== 12) {
        let runCount = 0;
        let didFindValidMnemoinc = false;
        while (runCount < 50 && !didFindValidMnemoinc) {
          console.log(`Running retry for account mnemoinc count: ${runCount}`);
          runCount += 1;
          const newTry = generateMnemonic(wordlist);
          const uniqueItems = new Set(newTry.split(' '));
          if (uniqueItems.size != 12) continue;
          didFindValidMnemoinc = true;
          generatedMnemonic = newTry;
        }
      }
      const filtedMnemoinc = generatedMnemonic
        .split(' ')
        .filter(word => word.length > 2)
        .join(' ');

      setAccountInformation(prev => ({
        ...prev,
        mnemoinc: filtedMnemoinc,
        dateCreated: new Date().getTime(),
      }));
    }
    initalizeAccount();
  }, []);
  //   const handlePassword = password => {
  //     console.log(password);
  //   };
  //   const handleToggle = state => {
  //     setAccountInformation(prev => ({
  //       ...prev,
  //       isPasswordEnabled: !prev.isPasswordEnabled,
  //     }));
  //   };
  const createAccount = useCallback(async () => {
    try {
      if (!accountInformation.name) return;
      setIsCreatingAccount(true);
      let savedAccountInformation =
        JSON.parse(await retrieveData('CustodyAccounts')) || [];

      savedAccountInformation.push(accountInformation);

      console.log(savedAccountInformation);
      await storeData(
        'CustodyAccounts',
        JSON.stringify(savedAccountInformation),
      );
      setIsCreatingAccount(false);
      navigate.goBack();
    } catch (err) {
      console.log('Create custody account error', err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    }
  }, [accountInformation]);
  console.log(accountInformation);
  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      globalThemeViewStyles={{alignItems: 'center', position: 'relative'}}
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={'Create Account'}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* <View
          style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
          <ThemeText content={'Account Name'} />
          <ThemeImage
            styles={{width: 20, height: 20, marginLeft: 5}}
            lightModeIcon={ICONS.aboutIcon}
            darkModeIcon={ICONS.aboutIcon}
            lightsOutIcon={ICONS.aboutIconWhite}
          />
        </View> */}
        <ThemeText
          styles={{
            fontSize: SIZES.large,

            marginBottom: 10,
          }}
          content={'Account Name'}
        />
        <CustomSearchInput
          inputText={accountInformation.name}
          setInputText={e => {
            setAccountInformation(prev => {
              return {...prev, name: e};
            });
          }}
          placeholderText={'Name...'}
          onFocusFunction={() => stIsKeyboardActive(true)}
          onBlurFunction={() => stIsKeyboardActive(false)}
        />
        <ThemeText
          styles={{
            fontSize: SIZES.large,

            marginBottom: 10,
            marginTop: 30,
          }}
          content={'Account Seed'}
        />

        <KeyContainer keys={accountInformation.mnemoinc.split(' ')} />
        {/*
        <TextInputWithSliderSettingsItem
          sliderTitle="Enable Password"
          settingInputTitle="Password"
          settingDescription="Adding a password means your seed can only be viewed by entering that password, adding an extra layer of security."
          defaultTextInputValue={accountInformation.password}
          handleSubmit={handlePassword}
          CustomToggleSwitchFunction={handleToggle}
          switchStateValue={accountInformation.isPasswordEnabled}
        /> */}
      </ScrollView>

      {!isKeyboardActive && (
        <CustomButton
          useLoading={isCreatingAccount}
          buttonStyles={{
            ...CENTER,
            opacity: !accountInformation.name ? 0.5 : 1,
          }}
          textContent={'Create Account'}
          actionFunction={createAccount}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}
