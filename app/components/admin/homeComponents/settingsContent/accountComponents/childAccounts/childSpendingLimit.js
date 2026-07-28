import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useCallback, useRef, useState } from 'react';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { addDataToCollection } from '../../../../../../../db';
import { reserveChild } from '../../../../../../functions/accounts/childAccounts';
import { crashlyticsRecordErrorReport } from '../../../../../../functions/crashlyticsLogs';
import CustomNumberKeyboard from '../../../../../../functions/CustomElements/customNumberKeyboard';
import FormattedBalanceInput from '../../../../../../functions/CustomElements/formattedBalanceInput';

export default function ChildSpendingLimit(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const name = props?.route?.params?.name;
  const editChild = props?.route?.params?.editChild;
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { accountMnemoinc, publicKey } = useKeysContext();
  const [limit, setLimit] = useState(
    editChild?.spendingLimit ? String(editChild.spendingLimit) : '',
  );
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  const parseLimit = useCallback(() => {
    const parsed = limit.trim() ? Math.round(Number(limit)) : null;
    return parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [limit]);

  const handleSaveEdit = useCallback(async () => {
    const spendingLimit = parseLimit();
    const existing = masterInfoObject?.childAccounts || [];
    const updated = existing.map(item =>
      item.uuid === editChild.uuid ? { ...item, spendingLimit } : item,
    );
    await toggleMasterInfoObject({ childAccounts: updated });
    // Cross-user single-field write into the child's top-level doc; Firestore
    // rules authorize it via auth.uid == doc.parentPublicKey (== publicKey here).
    await addDataToCollection(
      { spendingLimit },
      'blitzWalletUsers',
      editChild.childPublicKey,
    );
    navigate.goBack();
  }, [parseLimit, masterInfoObject, editChild, toggleMasterInfoObject, navigate]);

  const handleCreate = useCallback(async () => {
    if (editChild) {
      handleSaveEdit();
      return;
    }
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const spendingLimit = parseLimit();
      const childIndex = Number(masterInfoObject?.nextChildDerivationIndex || 0);
      const { childPublicKey } = await reserveChild({
        mainSeed: accountMnemoinc,
        childIndex,
      });

      // Child doc lives top-level at blitzWalletUsers/{childPublicKey}, like any
      // user. parentPublicKey links it back; Firestore rules let the parent
      // create/limit-edit it.
      const didWrite = await addDataToCollection(
        {
          name,
          spendingLimit,
          parentPublicKey: publicKey,
          isChildAccount: true,
          childPublicKey,
          dateCreated: Date.now(),
          claimed: false,
        },
        'blitzWalletUsers',
        childPublicKey,
      );
      if (!didWrite) throw new Error('Failed to create child account');

      const existing = masterInfoObject?.childAccounts || [];
      const newEntry = {
        uuid: childPublicKey,
        name,
        childIndex,
        childPublicKey,
        spendingLimit,
        profileEmoji: '',
        dateCreated: Date.now(),
        claimed: false,
      };
      await toggleMasterInfoObject({
        childAccounts: [...existing, newEntry],
        nextChildDerivationIndex: childIndex + 1,
      });

      // Collapse the create flow (name -> limit) back to the accounts list, then
      // open the standard account page on top, so Back returns to the list
      // rather than the spending-limit keyboard. Pairing is started manually
      // from there, not automatically.
      navigate.popTo('SettingsContentHome', { for: 'Accounts' });
      navigate.navigate('EditAccountPage', {
        account: newEntry,
        from: 'SettingsContentHome',
      });
    } catch (err) {
      console.log('create child error', err);
      crashlyticsRecordErrorReport(err.message);
      isCreatingRef.current = false;
      setIsCreating(false);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.childAccounts.creating.errorTitle'),
      });
    }
  }, [
    editChild,
    handleSaveEdit,
    parseLimit,
    name,
    navigate,
    masterInfoObject,
    accountMnemoinc,
    publicKey,
    toggleMasterInfoObject,
    t,
  ]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('settings.childAccounts.tabs.children')} />

      <View style={{ width: INSET_WINDOW_WIDTH, ...CENTER }}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.spendingLimit.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.spendingLimit.subtitle')}
        />
      </View>

      <View style={styles.container}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={limit}
          inputDenomination={'sats'}
          forceCurrency={null}
          forceFiatStats={null}
        />
      </View>

      <CustomNumberKeyboard setInputValue={setLimit} showDot={false} />
      <CustomButton
        buttonStyles={styles.buttonContainer}
        useLoading={isCreating}
        textContent={
          editChild
            ? t('constants.save')
            : t('settings.childAccounts.spendingLimit.create')
        }
        actionFunction={handleCreate}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonContainer: {
    width: 'auto',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
