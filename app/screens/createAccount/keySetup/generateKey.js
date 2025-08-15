import {StyleSheet, View, ScrollView} from 'react-native';
import {KeyContainer} from '../../../components/login';
import {CENTER, COLORS, FONT, SIZES} from '../../../constants';
import {useTranslation} from 'react-i18next';
import {GlobalThemeView, ThemeText} from '../../../functions/CustomElements';
import LoginNavbar from '../../../components/login/navBar';
import CustomButton from '../../../functions/CustomElements/button';
import {copyToClipboard} from '../../../functions';
import {useNavigation} from '@react-navigation/native';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import {crashlyticsRecordErrorReport} from '../../../functions/crashlyticsLogs';
import {useKeysContext} from '../../../../context-store/keys';
import {useToast} from '../../../../context-store/toastManager';
import {useState} from 'react';
import GetThemeColors from '../../../hooks/themeColors';

export default function GenerateKey() {
  const {showToast} = useToast();
  const {accountMnemoinc} = useKeysContext();
  const mnemonic = accountMnemoinc.split(' ');
  const [showSeed, setShowSeed] = useState(false);
  const [keyContainerDimensions, setKeyContainerDimensions] = useState({
    height: 0,
    width: 0,
  });
  const [scrollViewDimensions, setScrollViewDimensions] = useState({
    height: 0,
    width: 0,
  });
  const [warningViewDimensions, setWarningViewDimensions] = useState({
    height: 0,
    width: 0,
  });
  const {t} = useTranslation();
  const hookNavigate = useNavigation();
  const {backgroundColor} = GetThemeColors();
  useHandleBackPressNew();

  const handleScrollViewLayout = e => {
    setScrollViewDimensions(e.nativeEvent.layout);
  };
  const handleKeyContainerLayout = e => {
    setKeyContainerDimensions(e.nativeEvent.layout);
  };
  const handleWarningMessageLayout = e => {
    setWarningViewDimensions(e.nativeEvent.layout);
  };
  return (
    <GlobalThemeView useStandardWidth={true}>
      <LoginNavbar />
      <View style={styles.container}>
        <ThemeText
          styles={styles.header}
          content={t('createAccount.keySetup.generateKey.header')}
        />

        {mnemonic.length != 12 ? (
          <FullLoadingScreen
            showLoadingIcon={false}
            text={t('createAccount.keySetup.generateKey.keyGenError')}
          />
        ) : (
          <ScrollView
            onLayout={handleScrollViewLayout}
            showsHorizontalScrollIndicator={false}
            style={styles.scrollViewContainer}>
            <View onLayout={handleKeyContainerLayout}>
              <KeyContainer keys={mnemonic} />
            </View>
            {!showSeed && (
              <View
                style={{
                  height: keyContainerDimensions.height,
                  width: keyContainerDimensions.width,
                  backgroundColor,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  alignItems: 'center',
                }}>
                <View
                  onLayout={handleWarningMessageLayout}
                  style={{
                    backgroundColor: COLORS.darkModeText,
                    padding: 15,
                    borderRadius: 8,
                    position: 'absolute',
                    top: Math.max(
                      0,
                      (scrollViewDimensions.height -
                        warningViewDimensions.height) /
                        2,
                    ),
                  }}>
                  <ThemeText
                    styles={styles.seedPrivacyMessage}
                    content={t(
                      'createAccount.keySetup.generateKey.seedPrivacyMessage',
                    )}
                  />
                  <CustomButton
                    actionFunction={() => {
                      setShowSeed(true);
                    }}
                    buttonStyles={{backgroundColor: backgroundColor}}
                    textContent={t('createAccount.keySetup.generateKey.showIt')}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        <ThemeText
          styles={{width: '80%', textAlign: 'center'}}
          content={t('createAccount.keySetup.generateKey.subHeader')}
        />
        <ThemeText
          styles={{fontWeight: 'bold'}}
          content={t('createAccount.keySetup.generateKey.disclaimer')}
        />
        <View style={styles.buttonsContainer}>
          <CustomButton
            buttonStyles={{
              width: 145,
              marginRight: 10,
              opacity: mnemonic.length === 0 ? 0.5 : 1,
            }}
            textContent={t('constants.copy')}
            actionFunction={() => {
              if (mnemonic.length !== 12) {
                crashlyticsRecordErrorReport(
                  'Not able to genrate valid seed on create account path',
                );
                hookNavigate.navigate('ErrorScreen', {
                  errorMessage:
                    'createAccount.keySetup.generateKey.invalidSeedError',
                });
                return;
              }
              copyToClipboard(mnemonic.join(' '), showToast);
            }}
          />
          <CustomButton
            buttonStyles={{
              width: 145,
              backgroundColor: COLORS.primary,
              opacity: mnemonic.length != 12 ? 0.2 : 1,
            }}
            textStyles={{
              color: COLORS.darkModeText,
            }}
            textContent={t('constants.next')}
            actionFunction={() => {
              if (mnemonic.length != 12) return;
              hookNavigate.navigate('RestoreWallet', {
                fromPath: 'newWallet',
                goBackName: 'GenerateKey',
              });
            }}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  container: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: 20,
    justifyContent: 'center',
  },

  header: {
    width: '80%',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 30,
  },
  subHeader: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Regular,
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.lightModeText,
  },
  scrollViewContainer: {
    flex: 1,
    width: '90%',
    marginBottom: 20,
    ...CENTER,
  },
  button: {
    width: '45%',
    height: 45,

    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,

    borderRadius: 5,
  },

  buttonText: {
    fontSize: SIZES.large,
    paddingVertical: 5,
  },

  seedPrivacyMessage: {textAlign: 'center', marginBottom: 20},
  buttonsContainer: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
});
