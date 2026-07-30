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
import fetchBackend from '../../../../../../../db/handleBackend';
import {
  reserveChild,
  deriveChildMnemonic,
  getChildPublicKey,
  deriveChildAuthKey,
} from '../../../../../../functions/accounts/childAccounts';
import customUUID from '../../../../../../functions/customUUID';
import { privateKeyFromSeedWords } from '../../../../../../functions/nostrCompatability';
import { encriptMessage } from '../../../../../../functions/messaging/encodingAndDecodingMessages';
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
  const { accountMnemoinc } = useKeysContext();
  const [limit, setLimit] = useState(
    editChild?.spendingLimit ? String(editChild.spendingLimit) : '',
  );
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  const parseLimit = useCallback(() => {
    const parsed = limit.trim() ? Math.round(Number(limit)) : null;
    return parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [limit]);

  // Set/adjust the child's spendingLimit + isChildAccount through the
  // updateChildAccount Cloud Function. Two proofs travel inside the single em
  // payload: the outer em (encrypted as the child) proves the caller controls
  // the child key — anti-squat — and emParent (encrypted with the parent-only
  // per-child auth key, which the child cannot derive) proves the caller is the
  // parent — anti-escalation. The function writes the (client-locked) fields via
  // the admin SDK.
  const setChildLimit = useCallback(
    async (childPublicKey, childMnemonic, spendingLimit, childIndex) => {
      const childPriv = await privateKeyFromSeedWords(childMnemonic);
      const { authPriv, authPub } = await deriveChildAuthKey(
        accountMnemoinc,
        childIndex,
      );
      const emParent = encriptMessage(
        authPriv,
        process.env.BACKEND_PUB_KEY,
        JSON.stringify({ spendingLimit, childPublicKey, ts: Date.now() }),
      );
      const res = await fetchBackend(
        'updateChildAccount',
        { spendingLimit, authPub, emParent },
        childPriv,
        childPublicKey,
      );
      if (!res?.didWork) throw new Error('Failed to update child account');
    },
    [accountMnemoinc],
  );

  const handleSaveEdit = useCallback(async () => {
    const spendingLimit = parseLimit();
    const childMnemonic = await deriveChildMnemonic(
      accountMnemoinc,
      editChild.childIndex,
    );
    const childPublicKey = await getChildPublicKey(childMnemonic);
    await setChildLimit(
      childPublicKey,
      childMnemonic,
      spendingLimit,
      editChild.childIndex,
    );

    const existing = masterInfoObject?.childAccounts || [];
    const updated = existing.map(item =>
      item.uuid === editChild.uuid ? { ...item, spendingLimit } : item,
    );
    await toggleMasterInfoObject({ childAccounts: updated });
    navigate.goBack();
  }, [
    parseLimit,
    accountMnemoinc,
    editChild,
    setChildLimit,
    masterInfoObject,
    toggleMasterInfoObject,
    navigate,
  ]);

  const handleCreate = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      if (editChild) {
        await handleSaveEdit();
        return;
      }
      const spendingLimit = parseLimit();
      const childIndex = Number(
        masterInfoObject?.nextChildDerivationIndex || 0,
      );
      const { childPublicKey, childMnemonic } = await reserveChild({
        mainSeed: accountMnemoinc,
        childIndex,
      });

      await setChildLimit(
        childPublicKey,
        childMnemonic,
        spendingLimit,
        childIndex,
      );

      const existing = masterInfoObject?.childAccounts || [];
      const newEntry = {
        uuid: customUUID(),
        name,
        childIndex,
        spendingLimit,
        profileEmoji: '',
        dateCreated: Date.now(),
      };
      await toggleMasterInfoObject({
        childAccounts: [...existing, newEntry],
        nextChildDerivationIndex: childIndex + 1,
      });

      // Collapse the create flow (name -> limit) back to the accounts list, then
      // open the standard account page on top, so Back returns to the list
      // rather than the spending-limit keyboard. Pairing is started manually
      // from there, not automatically.
      navigate.popTo('SettingsContentHome', {
        for: 'Accounts',
        initialTab: 'linked',
      });
      navigate.navigate('EditAccountPage', {
        account: newEntry,
        from: 'SettingsContentHome',
      });
    } catch (err) {
      console.log('create child error', err);
      crashlyticsRecordErrorReport(err.message);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.childAccounts.creating.errorTitle'),
      });
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  }, [
    editChild,
    handleSaveEdit,
    parseLimit,
    name,
    navigate,
    masterInfoObject,
    accountMnemoinc,
    setChildLimit,
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
