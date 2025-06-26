import {StyleSheet, View} from 'react-native';
import {
  CENTER,
  COLORS,
  MIGRATE_ECASH_STORAGE_KEY,
  SIZES,
} from '../../../../../constants';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {
  formatEcashTx,
  migrateEcashWallet,
} from '../../../../../functions/eCash/wallet';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobaleCash} from '../../../../../../context-store/eCash';
import {
  addMint,
  getStoredProofs,
  selectMint,
  storeEcashTransactions,
  storeProofs,
} from '../../../../../functions/eCash/db';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useKeysContext} from '../../../../../../context-store/keys';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {setLocalStorageItem} from '../../../../../functions';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {
  RESTORE_PROOFS_EVENT_NAME,
  restoreMintProofs,
  restoreProofsEventListener,
} from '../../../../../functions/eCash/restore';

export default function MigrateProofsPopup(props) {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {toggleMasterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey, publicKey, accountMnemoinc} = useKeysContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const {parsedEcashInformation, toggleGLobalEcashInformation} =
    useGlobaleCash();
  const [wasSuccessfull, setWasSuccesfull] = useState('');
  const [migrationUpdates, setMigrationUpdates] =
    useState('Migration starting');

  useEffect(() => {
    function handleRestoreProofEvents(eventName) {
      if (eventName === 'end' || eventName.toLowerCase().includes('error')) {
        return;
      }
      setMigrationUpdates(eventName);
    }
    restoreProofsEventListener.on(
      RESTORE_PROOFS_EVENT_NAME,
      handleRestoreProofEvents,
    );
    return () =>
      restoreProofsEventListener.removeAllListeners(RESTORE_PROOFS_EVENT_NAME);
  }, []);

  useEffect(() => {
    if (!parsedEcashInformation || !Array.isArray(parsedEcashInformation))
      return;
    const transformedMints = parsedEcashInformation.map(mint => {
      return {
        ...mint,
        mintURL: mint.mintURL.replace(
          /stablenut\.umint\.cash/g,
          'stablenut.cashu.network',
        ),
      };
    });

    async function handleMigration() {
      await setLocalStorageItem(
        MIGRATE_ECASH_STORAGE_KEY,
        JSON.stringify(true),
      );
      let migratedMints = [];
      let failedMints = [];
      let count = 0;
      try {
        for (const mint of transformedMints) {
          console.log('running restore for mint:', mint.mintURL);
          count += 1;
          setMigrationUpdates(
            `Migrating ${count} of ${transformedMints.length} mints`,
          );
          const {wallet, reason, didWork} = await migrateEcashWallet(
            mint.mintURL,
          );

          if (!didWork) {
            console.log('Unable to load mint:', reason);
            failedMints.push(mint.mintURL);
            continue;
          }

          const didAdd = await addMint(mint.mintURL);
          if (!didAdd) {
            failedMints.push(mint.mintURL);
            continue;
          }
          console.log('added mint to database');
          if (mint.isCurrentMint) {
            const didSelect = await selectMint(mint.mintURL);
            if (!didSelect) {
              failedMints.push(mint.mintURL);
              continue;
            }
            console.log('selected current mint');
          }

          await restoreMintProofs(mint.mintURL, accountMnemoinc);

          if (mint.proofs?.length) {
            console.log('adding proofs to database', mint.proofs);
            const proofStates = await wallet.checkProofsStates(mint.proofs);
            console.log('checking proofs state', proofStates);
            const unspentProofs = mint.proofs.filter(
              (proof, index) => proofStates[index].state === 'UNSPENT',
            );
            if (unspentProofs.length > 0) {
              const storedProofs = await getStoredProofs(mint.mintURL);
              const newProofs = unspentProofs.filter(proof => {
                console.log(proof, 'UNSPEND PROOF');
                return !storedProofs.find(p2 => {
                  console.log(p2, 'STORED PROOFs');
                  return p2.secret === proof.secret;
                });
              });
              console.log(newProofs, 'NEW PROOFS');
              if (newProofs.length > 0) {
                const didStore = await storeProofs(newProofs, mint.mintURL);
                if (!didStore) {
                  failedMints.push(mint.mintURL);
                  continue;
                }
              }
            }
          }

          if (mint.transactions?.length) {
            console.log('Migrating mint transactions');
            let formattedTransactions = [];
            for (const tx of mint.transactions) {
              const formattedEcashTx = formatEcashTx({
                time: tx.time,
                amount: tx.amount,
                fee: tx.fee,
                paymentType: tx.paymentType,
              });
              formattedTransactions.push(formattedEcashTx);
            }

            await storeEcashTransactions(formattedTransactions, mint.mintURL);
          }
          migratedMints.push(mint.mintURL);
        }

        if (failedMints.length) {
          console.log('Updating db mint list to only failed mints');
          const newSavedMintList = transformedMints.filter(savedMint =>
            failedMints.includes(savedMint.mintURL),
          );
          console.log(newSavedMintList, 'filtered mint list');
          const em = encriptMessage(
            contactsPrivateKey,
            publicKey,
            JSON.stringify(newSavedMintList),
          );
          console.log(em);
          toggleGLobalEcashInformation(em, true);
        } else toggleGLobalEcashInformation(null, true);

        const hasSelectedMint = migratedMints.filter(mint => {
          console.log(mint, 'IN FILTER MINT');
          return transformedMints.find(
            parsedMint =>
              parsedMint.mintURL === mint && parsedMint.isCurrentMint,
          );
        }).length;
        console.log(hasSelectedMint, 'asjdflaksjfklasjflkasdjf');
        if (!hasSelectedMint && migratedMints.length) {
          console.log('Selecting mint if none are selcted');
          await selectMint(migratedMints[0]);
        }

        toggleMasterInfoObject({enabledEcash: true});

        setWasSuccesfull(
          `Migrated ${migratedMints.length} of ${
            transformedMints.length
          } mints. ${
            failedMints.length
              ? failedMints.join(' ') +
                (failedMints.length === 1 ? ' is' : ' are') +
                ' unavailable.'
              : ''
          }`,
        );
      } catch (err) {
        console.log('ecash migration error', err);
        navigate.goBack();
        setTimeout(() => {
          navigate.navigate('ErrorScreen', {
            errorMessage: String(err),
          });
        }, 250);
      }
    }
    handleMigration();
  }, []);
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.content,
          {
            height: 200,
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            padding: 10,
          },
        ]}>
        <FullLoadingScreen
          containerStyles={{width: '95%', ...CENTER}}
          textStyles={{textAlign: 'center'}}
          showLoadingIcon={!wasSuccessfull}
          text={wasSuccessfull || migrationUpdates}
        />
        {wasSuccessfull && (
          <CustomButton
            actionFunction={() => navigate.goBack()}
            textContent={'Go back'}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
  },
  button: {
    width: '50%',
    height: 30,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: SIZES.large,
  },

  content: {
    width: '95%',
    maxWidth: 300,
    borderRadius: 8,
  },
  headerText: {
    width: '90%',
    paddingVertical: 15,
    textAlign: 'center',
    ...CENTER,
  },
  border: {
    height: '100%',
    width: 1,
  },
});
