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

export default function GenerateKey() {
  const {accountMnemoinc} = useKeysContext();
  const mnemonic = accountMnemoinc.split(' ');
  const {t} = useTranslation();
  const hookNavigate = useNavigation();
  useHandleBackPressNew();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.contentContainer}>
        <LoginNavbar />
        <View style={styles.container}>
          <ThemeText
            styles={{...styles.header, marginTop: 30, marginBottom: 30}}
            content={t('createAccount.generateKeyPage.header')}
          />

          {mnemonic.length != 12 ? (
            <FullLoadingScreen
              showLoadingIcon={false}
              text={'Not able to generate valid seed'}
            />
          ) : (
            <ScrollView
              showsHorizontalScrollIndicator={false}
              style={styles.scrollViewContainer}>
              <KeyContainer keys={mnemonic} />
            </ScrollView>
          )}

          <ThemeText
            styles={{width: '80%', textAlign: 'center'}}
            content={t('createAccount.generateKeyPage.subHeader')}
          />
          <ThemeText
            styles={{fontWeight: 'bold'}}
            content={t('createAccount.generateKeyPage.disclaimer')}
          />
          <View
            style={{
              width: '90%',
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 30,
            }}>
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
                    errorMessage: 'Not able to generate valid seed',
                  });
                  return;
                }
                copyToClipboard(mnemonic.join(' '), hookNavigate);
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
});
