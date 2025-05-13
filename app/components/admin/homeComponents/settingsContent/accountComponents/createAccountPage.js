import {useCallback, useEffect, useState} from 'react';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {ScrollView, View} from 'react-native';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import {KeyContainer} from '../../../../login';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {
  createAccountMnemonic,
  retrieveData,
  storeData,
} from '../../../../../functions';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';

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
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();

  useEffect(() => {
    async function initalizeAccount() {
      const mnemoinc = await createAccountMnemonic(true);

      setAccountInformation(prev => ({
        ...prev,
        mnemoinc,
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
  const regenerateSeed = async () => {
    const mnemoinc = await createAccountMnemonic(true);
    setAccountInformation(prev => ({
      ...prev,
      mnemoinc,
    }));
  };
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
      <ScrollView
        style={{width: INSET_WINDOW_WIDTH}}
        showsVerticalScrollIndicator={false}>
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
        <CustomButton
          actionFunction={regenerateSeed}
          textContent={'Regenerate'}
        />
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
            backgroundColor: theme ? backgroundOffset : COLORS.primary,
          }}
          textStyles={{color: COLORS.darkModeText}}
          textContent={'Create Account'}
          actionFunction={createAccount}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}
