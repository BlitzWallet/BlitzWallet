import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
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

export default function RestoreProofsPopup(props) {
  const {mintURL} = props?.route?.params;
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  // const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProcessText, setRestoreProcessText] = useState('');
  const [didFinish, setDidFinish] = useState(false);

  useEffect(() => {
    function handleRestoreProofEvents(eventName) {
      if (eventName === 'end') {
        setDidFinish(true);
        return;
      } else if (eventName.toLowerCase().includes('error')) {
        setRestoreProcessText('An error occured during the restore process.');
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
      restoreProofsEventListener.off(
        RESTORE_PROOFS_EVENT_NAME,
        handleRestoreProofEvents,
      );
  }, []);

  useEffect(() => {
    // setIsRestoring(true);
    setTimeout(() => {
      restoreMintProofs(mintURL);
    }, 500);
  }, []);

  return (
    <View style={styles.container}>
      {/* {isRestoring ? ( */}
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
      {/* ) : (
        <View
          style={[
            styles.content,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            },
          ]}>
          <ThemeText
            styles={styles.headerText}
            content={`Would you like to restore proofs?`}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => {
                setIsRestoring(true);
                setTimeout(() => {
                  restoreMintProofs(mintURL);
                }, 500);
              }}
              style={[styles.button]}>
              <ThemeText styles={styles.buttonText} content={'Yes'} />
            </TouchableOpacity>
            <View
              style={{
                height: '100%',
                width: 2,
                backgroundColor: theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
              }}
            />
            <TouchableOpacity onPress={navigate.goBack} style={styles.button}>
              <ThemeText styles={styles.buttonText} content={'No'} />
            </TouchableOpacity>
          </View>
        </View>
      )} */}
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
