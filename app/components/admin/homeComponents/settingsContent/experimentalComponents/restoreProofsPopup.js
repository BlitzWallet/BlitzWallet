import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../../../../constants';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  restoreMintProofs,
  restoreProofsEventListener,
  RESTORE_PROOFS_EVENT_NAME,
} from '../../../../../functions/eCash/restore';
import {
  deleteMint,
  getAllMints,
  selectMint,
} from '../../../../../functions/eCash/db';
import {useKeysContext} from '../../../../../../context-store/keys';

export default function RestoreProofsPopup(props) {
  const {mintURL} = props?.route?.params;
  const navigate = useNavigation();
  const {accountMnemoinc} = useKeysContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const [restoreProcessText, setRestoreProcessText] = useState('');
  const [didFinish, setDidFinish] = useState(false);

  useEffect(() => {
    async function handleRestoreProofEvents(eventName) {
      if (eventName === 'end') {
        setDidFinish(true);
        return;
      } else if (eventName.toLowerCase().includes('error')) {
        setRestoreProcessText(eventName);
        await deleteMint(mintURL);
        const mints = await getAllMints();

        if (mints.length) {
          await selectMint(mints[0].mintURL);
        }

        setTimeout(() => {
          navigate.goBack();
        }, 2000);
        return;
      }
      setRestoreProcessText(eventName);
    }
    restoreProofsEventListener.on(
      RESTORE_PROOFS_EVENT_NAME,
      handleRestoreProofEvents,
    );
    return () =>
      restoreProofsEventListener.removeAllListeners(RESTORE_PROOFS_EVENT_NAME);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      restoreMintProofs(mintURL, accountMnemoinc);
    }, 500);
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
          showLoadingIcon={!didFinish}
          text={
            didFinish
              ? 'Restore successful'
              : restoreProcessText || 'Starting restore process'
          }
        />
        {didFinish && (
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
