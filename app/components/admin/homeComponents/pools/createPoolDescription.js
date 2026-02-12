import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
  STARTING_INDEX_FOR_POOLS_DERIVE,
} from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useKeysContext } from '../../../../../context-store/keys';
import { usePools } from '../../../../../context-store/poolContext';
import { derivePoolWallet } from '../../../../functions/pools/derivePoolWallet';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';

export default function CreatePoolDescription({
  route,
  handleBackPressFunction,
  setContentHeight,
}) {
  const goalAmount = route?.params?.goalAmount || 0;
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const textInputRef = useRef(null);
  const isAlreadyCreating = useRef(null);
  const { globalContactsInformation } = useGlobalContacts();
  const { accountMnemoinc } = useKeysContext();
  const { savePoolToCloud } = usePools();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const [poolDebug, setPoolDebug] = useState('');

  const [poolTitle, setPoolTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isValid = poolTitle.trim().length > 0 && goalAmount > 0;

  useEffect(() => {
    setContentHeight(300);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!textInputRef.current.isFocused()) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            textInputRef.current.focus();
          });
        });
      }
    }, []),
  );

  const handleTextInputBlur = () => {
    if (!poolTitle) {
      handleBackPressFunction?.();
    } else {
      handleCreatePool();
    }
  };

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
      setPoolDebug('Getting constants');

      const derivedWallet = await derivePoolWallet(
        accountMnemoinc,
        derivationIndex,
      );

      setPoolDebug('Deriving pool');

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

      const didSave = await savePoolToCloud(poolDocument);
      setPoolDebug('Saving pool');
      if (!didSave) {
        throw new Error('Failed to save pool');
      }

      setPoolDebug('updating pool index');

      toggleMasterInfoObject({
        currentDerivedPoolIndex: currentDerivedPoolIndex + 1,
      });

      setIsLoading(false);

      setPoolDebug('navigating');

      handleBackPressFunction(() => {
        navigate.goBack();
        navigate.replace('PoolDetailScreen', { poolId, pool: poolDocument });
      });
    } catch (err) {
      console.log('Error creating pool:', err);
      setIsLoading(false);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('wallet.pools.whatIsPoolFor')}
      />

      <CustomSearchInput
        textInputRef={textInputRef}
        inputText={poolTitle}
        setInputText={setPoolTitle}
        onBlurFunction={handleTextInputBlur}
        maxLength={100}
        autoFocus={true}
        placeholderText={t('wallet.pools.examplePlaceholder')}
      />

      <CustomButton
        buttonStyles={[
          styles.createButton,
          { opacity: !isValid ? HIDDEN_OPACITY : 1 },
        ]}
        textContent={
          isLoading ? t('wallet.pools.creating') : t('wallet.pools.createPool')
        }
        actionFunction={handleCreatePool}
        disabled={isLoading || !isValid}
      />

      {isLoading && (
        <View
          style={[
            styles.loadingOverlay,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            },
          ]}
        >
          <FullLoadingScreen
            text={poolDebug || t('wallet.pools.creatingPool')}
          />
        </View>
      )}
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

  createButton: {
    ...CENTER,
    marginTop: 'auto',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  loadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    ...CENTER,
    zIndex: 999,
  },
});
