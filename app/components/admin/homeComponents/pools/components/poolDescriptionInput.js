import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
  STARTING_INDEX_FOR_POOLS_DERIVE,
} from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useKeysContext } from '../../../../../../context-store/keys';
import { derivePoolWallet } from '../../../../../functions/pools/derivePoolWallet';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';

/**
 * Pool Description Input Sub-Component
 * Allows user to enter a description/title for the pool
 *
 * @param {Number} goalAmount - The goal amount for the pool (in sats)
 * @param {Function} onCreatePool - Callback when pool is created with pool data
 * @param {Function} onBack - Callback when user goes back to amount step
 * @param {Function} handleBackPressFunction - Optional back press handler from modal
 */
export default function PoolDescriptionInput({
  goalAmount,
  onCreatePool,
  onBack,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const textInputRef = useRef(null);
  const isAlreadyCreating = useRef(null);
  const { globalContactsInformation } = useGlobalContacts();
  const { accountMnemoinc } = useKeysContext();
  const { bottomPadding } = useGlobalInsets();
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const { t } = useTranslation();

  const [poolTitle, setPoolTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isValid = poolTitle.trim().length > 0 && goalAmount > 0;

  useFocusEffect(
    useCallback(() => {
      if (textInputRef.current && !textInputRef.current.isFocused()) {
        textInputRef.current.focus();
      }
    }, []),
  );

  const handleCreatePool = async () => {
    if (!isValid) return;
    if (isAlreadyCreating.current) return;
    isAlreadyCreating.current = true;

    try {
      setIsLoading(true);

      const currentDerivedPoolIndex =
        masterInfoObject.currentDerivedPoolIndex || 0;
      const derivationIndex =
        STARTING_INDEX_FOR_POOLS_DERIVE + currentDerivedPoolIndex;

      const derivedWallet = await derivePoolWallet(
        accountMnemoinc,
        derivationIndex,
      );

      const poolId = uuidv4();
      const creatorProfile = globalContactsInformation?.myProfile || {};

      const poolDocument = {
        poolId,
        creatorUUID: masterInfoObject.uuid,
        creatorName: creatorProfile.name || creatorProfile.uniqueName || '',

        poolTitle: poolTitle.trim(),
        goalAmount,
        currentAmount: 0,

        status: 'active',

        sparkAddress: derivedWallet.sparkAddress,
        identityPubKey: derivedWallet.identityPubKeyHex,
        derivationIndex,

        poolDenomination: masterInfoObject.fiatCurrency,

        createdAt: Date.now(),
        closedAt: null,
        transferTxId: null,

        contributorCount: 0,
        lastContributionAt: null,
        topContributors: [],
      };

      setIsLoading(false);

      // Call the onCreatePool callback with pool data and navigation logic
      if (handleBackPressFunction) {
        // For CustomHalfModal context (settings path)
        handleBackPressFunction(() => {
          navigate.replace('PoolDetailScreen', {
            poolId,
            pool: poolDocument,
            shouldSave: true,
          });
        });
      } else {
        // For overlay context (receive modal path)
        onCreatePool?.({
          poolId,
          pool: poolDocument,
          shouldSave: true,
        });

        // Navigate to PoolDetailScreen after closing overlay
        navigate.replace('PoolDetailScreen', {
          poolId,
          pool: poolDocument,
          shouldSave: true,
        });
      }
    } catch (err) {
      console.log('Error creating pool:', err);
      setIsLoading(false);
      isAlreadyCreating.current = false;
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: !isKeyboardFocused && poolTitle ? bottomPadding : 0 },
      ]}
    >
      <ThemeText
        styles={styles.title}
        content={t('wallet.pools.whatIsPoolFor')}
      />

      <CustomSearchInput
        textInputRef={textInputRef}
        inputText={poolTitle}
        setInputText={setPoolTitle}
        maxLength={100}
        autoFocus={true}
        containerStyles={{ width: '100%' }}
        onFocusFunction={() => setIsKeyboardFocused(true)}
        onBlurFunction={() => {
          setIsKeyboardFocused(false);
          if (isAlreadyCreating.current) return;
          if (poolTitle) return;

          onBack();
        }}
        placeholderText={t('wallet.pools.examplePlaceholder')}
      />

      <View style={styles.buttonContainer}>
        <CustomButton
          buttonStyles={[
            styles.createButton,
            { opacity: !isValid ? HIDDEN_OPACITY : 1 },
          ]}
          textContent={
            isLoading
              ? t('wallet.pools.creating')
              : t('wallet.pools.createPool')
          }
          actionFunction={handleCreatePool}
          disabled={isLoading || !isValid}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 'auto',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
    gap: 10,
  },
  backButton: {
    flex: 1,
    ...CENTER,
  },
  createButton: {
    ...CENTER,
  },
});
