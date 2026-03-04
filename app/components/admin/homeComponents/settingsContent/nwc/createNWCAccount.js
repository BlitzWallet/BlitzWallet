import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  NOSTR_RELAY_URL,
} from '../../../../../constants';
import CustomToggleSwitch from '../../../../../functions/CustomElements/switch';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { createAccountMnemonic } from '../../../../../functions';

import { randomBytes } from 'react-native-quick-crypto';
import sha256Hash from '../../../../../functions/hash';
import { getSupportedMethods } from '../../../../../functions/nwc';
import { privateKeyFromSeedWords } from '../../../../../functions/nostrCompatability';
import { publishToSingleRelay } from '../../../../../functions/nwc/publishResponse';
import { useTranslation } from 'react-i18next';
import { finalizeEvent, getPublicKey } from 'nostr-tools';

const BUDGET_RENEWAL_OPTIONS = [
  { label: 'timeLabels.daily', value: 'Daily' },
  { label: 'timeLabels.weekly', value: 'Weekly' },
  { label: 'timeLabels.monthly', value: 'Monthly' },
  { label: 'timeLabels.yearly', value: 'Yearly' },
];
const BUDGET_AMOUNT_OPTIONS = [50_000, 100_000, 'Unlimited', 'Custom...'];

const SettingsSection = ({ title, children, style }) => (
  <View style={[styles.section, style]}>
    {title ? <ThemeText styles={styles.sectionTitle} content={title} /> : null}
    {children}
  </View>
);

const SettingsItem = ({ label, children, isLast, dividerColor }) => (
  <>
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemText}>
        <ThemeText styles={styles.settingsItemLabel} content={label} />
      </View>
      {children}
    </View>
    {!isLast && (
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
    )}
  </>
);

export default function CreateNostrConnectAccount(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const passedParams = props.route?.params;
  const isEditing = passedParams?.accountID;
  const savedData = passedParams?.data;
  const { fiatStats } = useNodeContext();
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
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const { theme, darkModeType } = useGlobalThemeContext();

  const handleDropdownScrollStart = () => {
    setOuterScrollEnabled(false);
  };

  const handleDropdownScrollEnd = () => {
    setOuterScrollEnabled(true);
  };

  const handleAccountCreation = async () => {
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

      let privateKey, publicKey, secret;
      if (!isEditing) {
        await new Promise(res => setTimeout(res, 10)); // add a delay for UI
        const mnemonic = await createAccountMnemonic();
        privateKey = await privateKeyFromSeedWords(mnemonic);
        publicKey = getPublicKey(privateKey);
        secret = sha256Hash(randomBytes(32));
      } else {
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

      const signedEvent = finalizeEvent(
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
    const isSelected =
      option === budgetRenewalSettings.amount ||
      (option === 'Custom...' && props?.route?.params?.amount);
    return (
      <TouchableOpacity
        onPress={() => {
          if (option === 'Custom...') {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'customInputText',
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
        style={[
          styles.budgetButton,
          {
            borderColor: isSelected
              ? theme && darkModeType
                ? textColor
                : COLORS.primary
              : textColor,
          },
        ]}
        key={option.toString()}
      >
        {typeof option === 'number' ? (
          <ThemeText
            styles={{ includeFontPadding: false }}
            content={displayCorrectDenomination({
              amount: option,
              masterInfoObject,
              fiatStats,
            })}
          />
        ) : (
          <ThemeText
            styles={{ includeFontPadding: false }}
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
      isKeyboardActive={isKeyboardActive}
    >
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
            style={styles.innerContainer}
            contentContainerStyle={styles.scrollContent}
          >
            <SettingsSection>
              <CustomSearchInput
                inputText={accountName}
                setInputText={setAccountName}
                placeholderText={t(
                  'settings.nwc.createNWCAccount.nameInputPlaceholder',
                )}
                onBlurFunction={() => setIsKeyboardActive(false)}
                onFocusFunction={() => setIsKeyboardActive(true)}
              />
            </SettingsSection>

            <SettingsSection
              title={t('settings.nwc.createNWCAccount.permissionsHeader')}
            >
              <View
                style={[
                  styles.sectionContent,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <SettingsItem
                  dividerColor={backgroundColor}
                  label={t('settings.nwc.createNWCAccount.receivePayments')}
                >
                  <CustomToggleSwitch
                    page="nwcAccount"
                    toggleSwitchFunction={() =>
                      setAccountPermissions(prev => ({
                        ...prev,
                        receivePayments: !prev.receivePayments,
                      }))
                    }
                    stateValue={accountPermissions.receivePayments}
                  />
                </SettingsItem>
                <SettingsItem
                  dividerColor={backgroundColor}
                  label={t('settings.nwc.createNWCAccount.sendPayments')}
                >
                  <CustomToggleSwitch
                    page="nwcAccount"
                    toggleSwitchFunction={() =>
                      setAccountPermissions(prev => ({
                        ...prev,
                        sendPayments: !prev.sendPayments,
                      }))
                    }
                    stateValue={accountPermissions.sendPayments}
                  />
                </SettingsItem>
                <SettingsItem
                  dividerColor={backgroundColor}
                  label={t('settings.nwc.createNWCAccount.getBalance')}
                >
                  <CustomToggleSwitch
                    page="nwcAccount"
                    toggleSwitchFunction={() =>
                      setAccountPermissions(prev => ({
                        ...prev,
                        getBalance: !prev.getBalance,
                      }))
                    }
                    stateValue={accountPermissions.getBalance}
                  />
                </SettingsItem>
                <SettingsItem
                  dividerColor={backgroundColor}
                  label={t('settings.nwc.createNWCAccount.transactions')}
                >
                  <CustomToggleSwitch
                    page="nwcAccount"
                    toggleSwitchFunction={() =>
                      setAccountPermissions(prev => ({
                        ...prev,
                        transactionHistory: !prev.transactionHistory,
                      }))
                    }
                    stateValue={accountPermissions.transactionHistory}
                  />
                </SettingsItem>
                <SettingsItem
                  isLast
                  dividerColor={backgroundColor}
                  label={t('settings.nwc.createNWCAccount.lookupInvoice')}
                >
                  <CustomToggleSwitch
                    page="nwcAccount"
                    toggleSwitchFunction={() =>
                      setAccountPermissions(prev => ({
                        ...prev,
                        lookupInvoice: !prev.lookupInvoice,
                      }))
                    }
                    stateValue={accountPermissions.lookupInvoice}
                  />
                </SettingsItem>
              </View>
            </SettingsSection>

            <SettingsSection
              title={t('settings.nwc.createNWCAccount.budgetRenewalHeader')}
            >
              <View
                style={[
                  styles.sectionContent,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <DropdownMenu
                  placeholder={t(
                    'settings.nwc.createNWCAccount.bugetPlaceholder',
                  )}
                  selectedValue={
                    budgetRenewalSettings.option
                      ? t(
                          `timeLabels.${budgetRenewalSettings.option?.toLowerCase()}`,
                        )
                      : ''
                  }
                  showVerticalArrowsAbsolute={true}
                  onSelect={item => {
                    setBudgetRenewalSettings(prev => ({
                      ...prev,
                      option: item.value,
                    }));
                  }}
                  showClearIcon={false}
                  placeholderCustomLines={2}
                  options={BUDGET_RENEWAL_OPTIONS}
                  onScrollStart={handleDropdownScrollStart}
                  onScrollEnd={handleDropdownScrollEnd}
                  customButtonStyles={{
                    backgroundColor: theme
                      ? backgroundColor
                      : COLORS.darkModeText,
                  }}
                />
              </View>
            </SettingsSection>

            <SettingsSection style={styles.lastSection}>
              <View style={styles.budgetAmountContainer}>{budgetElements}</View>
            </SettingsSection>
          </ScrollView>

          {!isKeyboardActive && (
            <CustomButton
              actionFunction={handleAccountCreation}
              buttonStyles={{
                ...CENTER,
                marginTop: CONTENT_KEYBOARD_OFFSET,
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
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 16,
    includeFontPadding: false,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  budgetAmountContainer: {
    width: '100%',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 10,
    flexDirection: 'row',
  },
  budgetButton: {
    minWidth: '48%',
    flexGrow: 1,
    borderWidth: 1,
    padding: 10,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
