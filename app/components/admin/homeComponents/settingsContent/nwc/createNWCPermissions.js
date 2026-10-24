import { useNavigation } from '@react-navigation/native';
import { CustomKeyboardAvoidingView } from '../../../../../functions/CustomElements';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../constants';
import { SIZES } from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';

export default function CreateNWCPermissions(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const passedParams = props?.route?.params || {};
  const isEditing = passedParams?.mode === 'edit' || !!passedParams?.accountID;
  const savedData =
    masterInfoObject?.NWC?.accounts?.[passedParams?.accountID] || {};

  const initialPermissions = isEditing
    ? savedData?.permissions
    : passedParams?.permissions;
  const [accountPermissions, setAccountPermissions] = useState({
    receivePayments: !!initialPermissions?.receivePayments,
    sendPayments: !!initialPermissions?.sendPayments,
    getBalance: !!initialPermissions?.getBalance,
    transactionHistory: !!initialPermissions?.transactionHistory,
    lookupInvoice: !!initialPermissions?.lookupInvoice,
  });
  const [isSaving, setIsSaving] = useState(false);
  const hasAnyPermission = Object.values(accountPermissions).some(Boolean);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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
      icon: 'ArrowDown',
    },
    {
      labelKey: 'sendPayments',
      stateKey: 'sendPayments',
      icon: 'ArrowUp',
    },
    {
      labelKey: 'getBalance',
      stateKey: 'getBalance',
      icon: 'Wallet',
    },
    {
      labelKey: 'transactionHistory',
      stateKey: 'transactionHistory',
      icon: 'Clock',
    },
    {
      labelKey: 'lookupInvoice',
      stateKey: 'lookupInvoice',
      isLast: true,
      icon: 'Search',
    },
  ];

  return (
    <CustomKeyboardAvoidingView useLocalPadding={true} useStandardWidth={true}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <TopBar
          title={t(
            isEditing
              ? 'settings.nwc.createNWCPermissions.title'
              : 'settings.nwc.addAccount',
          )}
          shouldDismissKeyboard={true}
        />
        {isSaving ? (
          <FullLoadingScreen
            text={t('settings.nwc.createNWCAccount.updatingMessage')}
          />
        ) : (
          <>
            <CustomScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <PageHeader
                title={t(
                  isEditing
                    ? 'settings.nwc.createNWCPermissions.editTitle'
                    : 'settings.nwc.createNWCPermissions.pageTitle',
                  { name: passedParams?.accountName },
                )}
                sub={t(
                  isEditing
                    ? 'settings.nwc.createNWCPermissions.editSubtitle'
                    : 'settings.nwc.createNWCPermissions.pageSubtitle',
                  { name: passedParams?.accountName },
                )}
              />
              <ListCard>
                {permissionItems.map(item => (
                  <ListRow
                    key={item.labelKey}
                    lead={<Disc icon={item.icon} />}
                    title={t(
                      `settings.nwc.authRequest.permissions.${item.labelKey}`,
                    )}
                    titleStyle={styles.settingsItemLabel}
                    trailing={'switch'}
                    minHeight={60}
                    paddingVertical={8}
                    value={accountPermissions[item.stateKey]}
                    onPress={() =>
                      setAccountPermissions(prev => ({
                        ...prev,
                        [item.stateKey]: !prev[item.stateKey],
                      }))
                    }
                  />
                ))}
              </ListCard>
            </CustomScrollView>
            <CustomButton
              disabled={!hasAnyPermission}
              actionFunction={isEditing ? handleSave : handleContinue}
              buttonStyles={{
                ...CENTER,
                marginTop: CONTENT_KEYBOARD_OFFSET,
              }}
              textContent={t(
                isEditing ? 'constants.save' : 'constants.continue',
              )}
              size={'regular'}
            />
          </>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
  scrollContent: { flexGrow: 1 },
  settingsItemLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
});
