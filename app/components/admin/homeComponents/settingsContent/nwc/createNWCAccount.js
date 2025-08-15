import {useNavigation} from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {CENTER, NOSTR_RELAY_URL} from '../../../../../constants';
import SettingsItemWithSlider from '../../../../../functions/CustomElements/settings/settingsItemWithSlider';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {createAccountMnemonic} from '../../../../../functions';
import * as nostr from 'nostr-tools';
import crypto from 'react-native-quick-crypto';
import sha256Hash from '../../../../../functions/hash';
import {getSupportedMethods} from '../../../../../functions/nwc';
import {privateKeyFromSeedWords} from '../../../../../functions/nostrCompatability';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';
import {publishToSingleRelay} from '../../../../../functions/nwc/publishResponse';
import {useTranslation} from 'react-i18next';

const BUDGET_RENEWAL_OPTIONS = [
  {label: 'Daily', value: 'Daily'},
  {label: 'Weekly', value: 'Weekly'},
  {label: 'Monthly', value: 'Monthly'},
  {label: 'Yearly', value: 'Yearly'},
];
const BUDGET_AMOUNT_OPTIONS = [50_000, 100_000, 'Unlimited', 'Custom...'];

export default function CreateNostrConnectAccount(props) {
  const navigate = useNavigation();
  const {masterInfoObject, toggleNWCInformation} = useGlobalContextProvider();
  const passedParams = props.route?.params;
  const isEditing = passedParams?.accountID;
  const savedData = passedParams?.data;
  const {fiatStats} = useNodeContext();
  const [accountName, setAccountName] = useState(
    isEditing ? savedData.accountName : '',
  );

  const [outerScrollEnabled, setOuterScrollEnabled] = useState(true);
  const [accountPermissions, setAccountPermissions] = useState({
    receivePayments: isEditing ? savedData.permissions.receivePayments : false,
    sendPayments: isEditing ? savedData.permissions.sendPayments : false,
    getBalance: isEditing ? savedData.permissions.getBalance : false,
    transactionHistory: isEditing
      ? savedData.permissions.transactionHistory
      : false,
    lookupInvoice: isEditing ? savedData.permissions.lookupInvoice : false,
  });
  const [budgetRenewalSettings, setBudgetRenewalSettings] = useState({
    option: isEditing ? savedData.budgetRenewalSettings.option : null,
    amount: isEditing ? savedData.budgetRenewalSettings.amount : null,
  });
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const {textColor, backgroundOffset} = GetThemeColors();
  const {t} = useTranslation();

  const {theme, darkModeType} = useGlobalThemeContext();

  const handleDropdownScrollStart = () => {
    setOuterScrollEnabled(false);
  };

  const handleDropdownScrollEnd = () => {
    setOuterScrollEnabled(true);
  };

  const handleAccountCreation = async () => {
    console.log(nostr);
    // return;
    if (
      isEditing &&
      savedData.accountName === accountName &&
      savedData.permissions.receivePayments ===
        accountPermissions.receivePayments &&
      savedData.permissions.sendPayments === accountPermissions.sendPayments &&
      savedData.permissions.lookupInvoice ===
        accountPermissions.lookupInvoice &&
      savedData.permissions.transactionHistory ===
        accountPermissions.transactionHistory &&
      savedData.permissions.getBalance === accountPermissions.getBalance &&
      savedData.budgetRenewalSettings.option === budgetRenewalSettings.option &&
      savedData.budgetRenewalSettings.amount === budgetRenewalSettings.amount
    ) {
      navigate.goBack();
      return;
    }
    if (!accountName) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noAccountNameError'),
      });
      return;
    }
    if (
      !accountPermissions.receivePayments &&
      !accountPermissions.sendPayments &&
      !accountPermissions.getBalance &&
      !accountPermissions.transactionHistory &&
      !accountPermissions.lookupInvoice
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noPermissionsError'),
      });
      return;
    }
    if (!budgetRenewalSettings.option) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noBudgetError'),
      });
      return;
    }
    if (!budgetRenewalSettings.amount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noBudgetAmountError'),
      });
      return;
    }

    try {
      setIsCreatingAccount(true);

      let mnemonic, privateKey, publicKey, secret;
      if (!isEditing) {
        await new Promise(res => setTimeout(res, 10)); // add a delay for UI
        mnemonic = await createAccountMnemonic();
        privateKey = privateKeyFromSeedWords(mnemonic);
        publicKey = nostr.getPublicKey(privateKey);
        secret = sha256Hash(crypto.randomBytes(32)).toString('hex');
      } else {
        mnemonic = savedData.mnemonic;
        privateKey = savedData.privateKey;
        publicKey = savedData.publicKey;
        secret = savedData.secret;
      }

      const infoEvent = {
        kind: 13194,
        created_at: Math.floor(Date.now() / 1000),
        content: getSupportedMethods(accountPermissions).join(' '),
        tags: [],
      };

      const signedEvent = nostr.finalizeEvent(
        infoEvent,
        Buffer.from(privateKey, 'hex'),
      );

      await publishToSingleRelay([signedEvent], NOSTR_RELAY_URL);

      toggleNWCInformation({
        accounts: {
          ...(masterInfoObject?.NWC?.accounts || {}),
          [publicKey]: {
            accountName,
            permissions: accountPermissions,
            budgetRenewalSettings,
            privateKey,
            publicKey,
            mnemonic,
            secret,
          },
        },
      });

      navigate.goBack();
    } catch (error) {
      console.error('Error creating NWC account:', error);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  useEffect(() => {
    if (props?.route?.params?.amount) {
      setBudgetRenewalSettings(prev => ({
        ...prev,
        amount: props?.route?.params?.amount,
      }));
    }
  }, [props?.route?.params?.amount]);

  const budgetElements = BUDGET_AMOUNT_OPTIONS.map(option => {
    return (
      <TouchableOpacity
        onPress={() => {
          if (option === 'Custom...') {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'customInputText',
              //   sliderHight: 0.5,
              returnLocation: 'CreateNostrConnectAccount',
              passedParams,
            });
            return;
          }
          navigate.setParams({
            amount: '',
          });
          setBudgetRenewalSettings(prev => ({
            ...prev,
            amount: prev.amount === option ? '' : option,
          }));
        }}
        style={{
          // maxWidth: '48%',
          minWidth: '48%',
          flexGrow: 1,
          borderWidth: 1,
          borderColor:
            option === budgetRenewalSettings.amount ||
            (option === 'Custom...' && props?.route?.params?.amount)
              ? theme
                ? backgroundOffset
                : COLORS.primary
              : textColor,
          padding: 10,
          paddingVertical: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
        }}
        key={option.toString()}>
        {typeof option === 'number' ? (
          <ThemeText
            styles={{includeFontPadding: false}}
            content={displayCorrectDenomination({
              amount: option,
              masterInfoObject,
              fiatStats,
            })}
          />
        ) : (
          <ThemeText
            styles={{includeFontPadding: false}}
            content={
              option === 'Custom...' && props?.route?.params?.amount
                ? displayCorrectDenomination({
                    amount: props?.route?.params?.amount,
                    masterInfoObject,
                    fiatStats,
                  })
                : t(`constants.${option.toLowerCase()}`)
            }
          />
        )}
      </TouchableOpacity>
    );
  });

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      useStandardWidth={true}
      useTouchableWithoutFeedback={true}
      isKeyboardActive={isKeyboardActive}>
      <CustomSettingsTopBar
        label={t('settings.nwc.createNWCAccount.title')}
        shouldDismissKeyboard={true}
      />
      {isCreatingAccount ? (
        <FullLoadingScreen
          text={t('settings.nwc.createNWCAccount.loadingMessage')}
        />
      ) : (
        <>
          <ScrollView
            pointerEvents="auto"
            scrollEnabled={outerScrollEnabled}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: 10,
              paddingBottom: 20,
              width: INSET_WINDOW_WIDTH,
              ...CENTER,
            }}>
            <CustomSearchInput
              inputText={accountName}
              setInputText={setAccountName}
              placeholderText={t(
                'settings.nwc.createNWCAccount.nameInputPlaceholder',
              )}
              onBlurFunction={() => setIsKeyboardActive(false)}
              onFocusFunction={() => setIsKeyboardActive(true)}
            />
            <ThemeText
              styles={{marginTop: 30, marginBottom: 10}}
              content={t('settings.nwc.createNWCAccount.permissionsHeader')}
            />

            <SettingsItemWithSlider
              settingsTitle={t('settings.nwc.createNWCAccount.receivePayments')}
              showDescription={false}
              handleSubmit={() =>
                setAccountPermissions(prev => ({
                  ...prev,
                  receivePayments: !prev.receivePayments,
                }))
              }
              toggleSwitchStateValue={accountPermissions.receivePayments}
              containerStyles={styles.toggleContainers}
              switchPageName="nwcAccount"
            />
            <SettingsItemWithSlider
              settingsTitle={t('settings.nwc.createNWCAccount.sendPayments')}
              showDescription={false}
              handleSubmit={() =>
                setAccountPermissions(prev => ({
                  ...prev,
                  sendPayments: !prev.sendPayments,
                }))
              }
              toggleSwitchStateValue={accountPermissions.sendPayments}
              containerStyles={styles.toggleContainers}
              switchPageName="nwcAccount"
            />
            <SettingsItemWithSlider
              settingsTitle={t('settings.nwc.createNWCAccount.getBalance')}
              showDescription={false}
              handleSubmit={() =>
                setAccountPermissions(prev => ({
                  ...prev,
                  getBalance: !prev.getBalance,
                }))
              }
              toggleSwitchStateValue={accountPermissions.getBalance}
              containerStyles={{marginTop: 0}}
              switchPageName="nwcAccount"
            />
            <SettingsItemWithSlider
              settingsTitle={t('settings.nwc.createNWCAccount.transactions')}
              showDescription={false}
              handleSubmit={() =>
                setAccountPermissions(prev => ({
                  ...prev,
                  transactionHistory: !prev.transactionHistory,
                }))
              }
              toggleSwitchStateValue={accountPermissions.transactionHistory}
              containerStyles={{marginTop: 0}}
              switchPageName="nwcAccount"
            />
            <SettingsItemWithSlider
              settingsTitle={t('settings.nwc.createNWCAccount.lookupInvoice')}
              showDescription={false}
              handleSubmit={() =>
                setAccountPermissions(prev => ({
                  ...prev,
                  lookupInvoice: !prev.lookupInvoice,
                }))
              }
              toggleSwitchStateValue={accountPermissions.lookupInvoice}
              containerStyles={{marginTop: 0, marginBottom: 0}}
              switchPageName="nwcAccount"
            />
            <ThemeText
              styles={{marginTop: 30, marginBottom: 10}}
              content={t('settings.nwc.createNWCAccount.budgetRenewalHeader')}
            />
            <DropdownMenu
              placeholder={t('settings.nwc.createNWCAccount.bugetPlaceholder')}
              selectedValue={budgetRenewalSettings.option}
              onSelect={item => {
                setBudgetRenewalSettings(prev => ({
                  ...prev,
                  option: item.value,
                }));
              }}
              options={BUDGET_RENEWAL_OPTIONS}
              onScrollStart={handleDropdownScrollStart}
              onScrollEnd={handleDropdownScrollEnd}
            />
            <View
              style={{
                width: '100%',
                flexWrap: 'wrap',
                rowGap: 10,
                columnGap: 10,
                flexDirection: 'row',
                marginTop: 20,
              }}>
              {budgetElements}
            </View>
          </ScrollView>
          {!isKeyboardActive && (
            <CustomButton
              actionFunction={handleAccountCreation}
              buttonStyles={{
                ...CENTER,
              }}
              textContent={t('constants.save')}
            />
          )}
        </>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  toggleContainers: {
    marginTop: 0,
    marginBottom: 20,
  },
});
