import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import CustomToggleSwitch from '../../../../../functions/CustomElements/switch';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { useTranslation } from 'react-i18next';

const SettingsSection = ({ title, children, style }) => (
  <View style={[styles.section, style]}>{children}</View>
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

export default function CreateNWCPermissions(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const passedParams = props?.route?.params || {};
  const isEditing = passedParams?.mode === 'edit' || !!passedParams?.accountID;
  const savedData =
    masterInfoObject?.NWC?.accounts?.[passedParams?.accountID] || {};
  const [accountPermissions, setAccountPermissions] = useState({
    receivePayments: isEditing
      ? savedData?.permissions?.receivePayments
      : passedParams?.permissions?.receivePayments || false,
    sendPayments: isEditing
      ? savedData?.permissions?.sendPayments
      : passedParams?.permissions?.sendPayments || false,
    getBalance: isEditing
      ? savedData?.permissions?.getBalance
      : passedParams?.permissions?.getBalance || false,
    transactionHistory: isEditing
      ? savedData?.permissions?.transactionHistory
      : passedParams?.permissions?.transactionHistory || false,
    lookupInvoice: isEditing
      ? savedData?.permissions?.lookupInvoice
      : passedParams?.permissions?.lookupInvoice || false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const hasAnyPermission = Object.values(accountPermissions).some(Boolean);
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const handleSave = async () => {
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
    try {
      setIsSaving(true);
      const result = await saveNWCAccount({
        savedData,
        accountName: savedData.accountName,
        permissions: accountPermissions,
        budgetRenewalSettings: savedData.budgetRenewalSettings,
        existingAccounts: masterInfoObject?.NWC?.accounts || {},
      });
      toggleNWCInformation(result);
      navigate.goBack();
    } catch (error) {
      console.error('Error saving NWC account permissions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (!hasAnyPermission) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noPermissionsError'),
      });
      return;
    }
    navigate.navigate('CreateNWCAmount', {
      accountName: passedParams?.accountName,
      permissions: accountPermissions,
    });
  };

  const permissionItems = [
    {
      labelKey: 'receivePayments',
      stateKey: 'receivePayments',
    },
    {
      labelKey: 'sendPayments',
      stateKey: 'sendPayments',
    },
    {
      labelKey: 'getBalance',
      stateKey: 'getBalance',
    },
    {
      labelKey: 'transactions',
      stateKey: 'transactionHistory',
    },
    {
      labelKey: 'lookupInvoice',
      stateKey: 'lookupInvoice',
      isLast: true,
    },
  ];

  return (
    <CustomKeyboardAvoidingView useLocalPadding={true} useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.nwc.createNWCPermissions.title')}
        shouldDismissKeyboard={true}
      />
      {isSaving ? (
        <FullLoadingScreen
          text={t('settings.nwc.createNWCAccount.updatingMessage')}
        />
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.innerContainer}
            contentContainerStyle={styles.scrollContent}
          >
            <ThemeText
              styles={styles.title}
              content={t(
                isEditing
                  ? 'settings.nwc.createNWCPermissions.editTitle'
                  : 'settings.nwc.createNWCPermissions.pageTitle',
              )}
            />
            <ThemeText
              styles={styles.subtitle}
              content={t(
                isEditing
                  ? 'settings.nwc.createNWCPermissions.editSubtitle'
                  : 'settings.nwc.createNWCPermissions.pageSubtitle',
                { name: passedParams?.accountName },
              )}
            />
            <SettingsSection
              title={t('settings.nwc.createNWCAccount.permissionsHeader')}
            >
              <View
                style={[
                  styles.sectionContent,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                {permissionItems.map(item => (
                  <SettingsItem
                    key={item.stateKey}
                    isLast={item.isLast}
                    dividerColor={backgroundColor}
                    label={t(`settings.nwc.createNWCAccount.${item.labelKey}`)}
                  >
                    <CustomToggleSwitch
                      page="nwcAccount"
                      toggleSwitchFunction={() =>
                        setAccountPermissions(prev => ({
                          ...prev,
                          [item.stateKey]: !prev[item.stateKey],
                        }))
                      }
                      stateValue={accountPermissions[item.stateKey]}
                    />
                  </SettingsItem>
                ))}
              </View>
            </SettingsSection>
          </ScrollView>
          <CustomButton
            actionFunction={isEditing ? handleSave : handleContinue}
            buttonStyles={{
              ...CENTER,
              width: INSET_WINDOW_WIDTH,
              marginTop: CONTENT_KEYBOARD_OFFSET,
              opacity: hasAnyPermission ? 1 : HIDDEN_OPACITY,
            }}
            textContent={t(isEditing ? 'constants.save' : 'constants.continue')}
          />
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
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  scrollContent: {},
  section: {
    marginBottom: 24,
    width: '100%',
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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsItem: {
    minHeight: 50,
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
});
