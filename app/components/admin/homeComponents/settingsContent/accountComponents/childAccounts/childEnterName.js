import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useCallback, useRef, useState } from 'react';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { keyboardGoBack } from '../../../../../../functions/customNavigation';
import fetchBackend from '../../../../../../../db/handleBackend';
import {
  reserveNextChildIndex,
  addDataToCollection,
  updateChildAccountRegistryEntry,
} from '../../../../../../../db';
import { arrayUnion } from '@react-native-firebase/firestore';
import {
  reserveChild,
  deriveChildAuthKey,
} from '../../../../../../functions/accounts/childAccounts';
import customUUID from '../../../../../../functions/customUUID';
import { privateKeyFromSeedWords } from '../../../../../../functions/nostrCompatability';
import { encriptMessage } from '../../../../../../functions/messaging/encodingAndDecodingMessages';
import { crashlyticsRecordErrorReport } from '../../../../../../functions/crashlyticsLogs';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';

export default function ChildEnterName(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const maxLength = 50;
  const editChild = props?.route?.params?.editChild;
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor } = GetThemeColors();
  const { accountMnemoinc, publicKey } = useKeysContext();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [accountName, setAccountName] = useState(editChild?.name || '');
  const [isCreating, setIsCreating] = useState(false);
  const didHandle = useRef(false);
  const isCreatingRef = useRef(false);

  // Set the child's spendingLimit + isChildAccount through the
  // updateChildAccount Cloud Function. Two proofs travel inside the single em
  // payload: the outer em (encrypted as the child) proves the caller controls
  // the child key — anti-squat — and emParent (encrypted with the parent-only
  // per-child auth key, which the child cannot derive) proves the caller is the
  // parent — anti-escalation. The function writes the (client-locked) fields via
  // the admin SDK.
  const updateChildAccount = useCallback(
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

  const handleNext = useCallback(async () => {
    if (!canSave) {
      navigate.goBack();
      return;
    }
    const trimmed = accountName.trim();
    if (!trimmed) return;
    if (editChild) {
      if (didHandle.current) return;
      didHandle.current = true;
      const existing = masterInfoObject?.childAccounts || [];
      const updated = existing.map(item =>
        item.uuid === editChild.uuid ? { ...item, name: trimmed } : item,
      );
      // Registry edits are atomic like creation: run against the live server
      // array in a transaction (never a stale snapshot's wholesale array
      // write, which would erase sibling entries created on other devices)
      // and keep the local state update DB-free (shouldSendToDb = false);
      // the next foreground sync reconciles any sibling entry we can't see
      // locally.
      await updateChildAccountRegistryEntry(publicKey, entries =>
        entries.map(item =>
          item.uuid === editChild.uuid ? { ...item, name: trimmed } : item,
        ),
      );
      await toggleMasterInfoObject({ childAccounts: updated }, false);
      keyboardGoBack(navigate);
      return;
    }
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const existing = masterInfoObject?.childAccounts || [];
      // Reserve the index atomically on the parent's doc BEFORE deriving the
      // mnemonic. The Firestore transaction bumps nextChildDerivationIndex, so
      // two devices creating concurrently (or a failed settings write) can
      // never derive the same child index and end up with an identical wallet.
      const childIndex = await reserveNextChildIndex(publicKey);
      if (typeof childIndex !== 'number' || childIndex < 0) {
        throw new Error('Failed to reserve child index');
      }
      const { childPublicKey, childMnemonic } = await reserveChild({
        mainSeed: accountMnemoinc,
        childIndex,
      });

      // The spending limit is hidden for now (next feature): new children are
      // always created without a limit, but the backend write still runs so the
      // child doc gets its isChildAccount marker.
      await updateChildAccount(childPublicKey, childMnemonic, null, childIndex);

      const newEntry = {
        uuid: customUUID(),
        name: trimmed,
        childIndex,
        spendingLimit: null,
        profileEmoji: '',
        dateCreated: Date.now(),
      };
      // Persist the registry entry atomically: arrayUnion appends server-side,
      // so a concurrent create on another device (which started from the same
      // stale `existing` snapshot) can't clobber it. The counter is owned by
      // the reservation transaction — never re-write it here, and keep the
      // local state update DB-free (shouldSendToDb = false); the next
      // foreground sync reconciles any sibling entry we can't see locally.
      await addDataToCollection(
        { childAccounts: arrayUnion(newEntry) },
        'blitzWalletUsers',
        publicKey,
      );
      await toggleMasterInfoObject(
        { childAccounts: [...existing, newEntry] },
        false,
      );

      // Collapse the create flow back to the accounts list, then open the
      // standard account page on top, so Back returns to the list rather than
      // the name keyboard. Pairing is started manually from there, not
      // automatically.
      navigate.popTo('SettingsContentHome', {
        for: 'Accounts',
        initialTab: 'linked',
      });
      navigate.navigate('EditAccountPage', {
        accountId: newEntry.uuid,
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
    accountName,
    editChild,
    masterInfoObject,
    publicKey,
    accountMnemoinc,
    updateChildAccount,
    toggleMasterInfoObject,
    navigate,
    t,
    canSave,
  ]);

  useFocusEffect(
    useCallback(() => {
      didHandle.current = false;
    }, []),
  );

  const canSave = editChild?.name !== accountName;
  const isOverLimit = accountName.length >= maxLength;
  const characterCountColor = isOverLimit
    ? theme && darkModeType
      ? textColor
      : COLORS.cancelRed
    : textColor;

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('settings.accountComponents.editAccountName.title')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <ThemeText
          styles={styles.title}
          content={t(
            editChild
              ? 'settings.childAccounts.enterName.editTitle'
              : 'settings.childAccounts.enterName.title',
          )}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t(
            editChild
              ? 'settings.childAccounts.enterName.editSubtitle'
              : 'settings.childAccounts.enterName.subtitle',
          )}
        />
        <CustomSearchInput
          inputText={accountName}
          setInputText={setAccountName}
          placeholderText={t('settings.childAccounts.enterName.placeholder')}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
          maxLength={maxLength}
        />
        <ThemeText
          styles={{
            textAlign: 'right',
            color: characterCountColor,
            marginTop: 5,
          }}
          content={`${accountName.length} / ${maxLength}`}
        />
      </ScrollView>
      <CustomButton
        buttonStyles={{
          ...CENTER,
          width: INSET_WINDOW_WIDTH,
          opacity: !accountName.trim() ? HIDDEN_OPACITY : 1,
        }}
        useLoading={isCreating}
        textContent={
          editChild
            ? canSave
              ? t('constants.save')
              : t('constants.back')
            : t('settings.childAccounts.enterName.create')
        }
        actionFunction={handleNext}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
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
});
