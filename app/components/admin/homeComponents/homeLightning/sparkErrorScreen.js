import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {CENTER, COLORS, ICONS} from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import {ThemeText} from '../../../../functions/CustomElements';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import {useState} from 'react';
import {initWallet} from '../../../../functions/initiateWalletConnection';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import {useKeysContext} from '../../../../../context-store/keys';
import {openComposer} from 'react-native-email-link';
import {useToast} from '../../../../../context-store/toastManager';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {copyToClipboard} from '../../../../functions';

export default function SparkErrorScreen(props) {
  const {accountMnemoinc} = useKeysContext();
  const {setSparkInformation} = useSparkWallet();
  const {showToast} = useToast();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const errorMessage = props.route.params.errorMessage;
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();

  const handleSubmit = async () => {
    try {
      setIsRetrying(true);
      if (retryCount < 1) {
        const {didWork, error} = await initWallet({
          setSparkInformation,
          // toggleGlobalContactsInformation,
          // globalContactsInformation,
          mnemonic: accountMnemoinc,
        });

        console.log(
          didWork,
          'did connect to spark wallet in error screen',
          error,
        );
        if (!didWork) {
          setRetryCount(retryCount + 1);
        } else {
          navigate.goBack();
        }
        return;
      }
      try {
        const didRun = await openComposer({
          to: 'blake@blitz-wallet.com',
          subject: 'Spark Wallet Error Report',
          message:
            errorMessage ||
            'An error occurred while connecting to Spark Wallet.',
        });
        console.log(didRun);
      } catch (err) {
        copyToClipboard('blake@blitz-wallet.com', showToast);
      }
    } catch (err) {
      console.log('handleing spark error submit', err);
    } finally {
      setIsRetrying(false);
    }
  };
  return (
    <View style={styles.globalContainer}>
      <View
        style={[
          styles.content,
          {
            backgroundColor: theme ? backgroundOffset : backgroundColor,
          },
        ]}>
        <TouchableOpacity
          onPress={navigate.goBack}
          style={{marginLeft: 'auto', marginBottom: 10}}>
          <ThemeImage
            lightModeIcon={ICONS.xSmallIcon}
            darkModeIcon={ICONS.xSmallIcon}
            lightsOutIcon={ICONS.xSmallIconWhite}
          />
        </TouchableOpacity>
        <ThemeText
          styles={styles.headerText}
          content={
            retryCount < 1
              ? 'We ran into an error loading your wallet, please try again.'
              : 'Unable to connect to your wallet, please report this error.'
          }
        />
        <CustomButton
          buttonStyles={{
            width: 'auto',
            backgroundColor: COLORS.darkModeText,
            marginTop: 30,
            ...CENTER,
          }}
          textStyles={{
            color: COLORS.lightModeText,
            paddingHorizontal: 20,
          }}
          useLoading={isRetrying}
          textContent={retryCount < 1 ? 'Retry' : 'Report Error'}
          actionFunction={handleSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '95%',
    maxWidth: 300,
    borderRadius: 8,
    padding: 20,
  },
  headerText: {
    width: '100%',
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 20,
  },
});
