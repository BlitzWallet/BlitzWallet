import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CENTER, COLORS } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { useState } from 'react';
import { initWallet } from '../../../../functions/initiateWalletConnection';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useKeysContext } from '../../../../../context-store/keys';
import { openComposer } from 'react-native-email-link';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../context-store/webViewContext';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function SparkErrorScreen(props) {
  const { accountMnemoinc } = useKeysContext();
  const { setSparkInformation } = useSparkWallet();
  const { showToast } = useToast();
  const { backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const errorMessage = props.route.params.errorMessage;
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { sendWebViewRequest } = useWebView();

  const handleSubmit = async () => {
    try {
      setIsRetrying(true);
      if (retryCount < 1) {
        const { didWork, error } = await initWallet({
          setSparkInformation,
          // toggleGlobalContactsInformation,
          // globalContactsInformation,
          mnemonic: accountMnemoinc,
          sendWebViewRequest,
          hasRestoreCompleted: false,
        });

        if (!didWork) {
          setRetryCount(retryCount + 1);
        } else {
          navigate.goBack();
        }
        return;
      }
      try {
        const didRun = await openComposer({
          to: 'blake@blitzwalletapp.com',
          subject: 'Spark Wallet Error Report',
          body:
            errorMessage ||
            'An error occurred while connecting to Spark Wallet.',
        });
        console.log(didRun);
      } catch (err) {
        copyToClipboard('blake@blitzwalletapp.com', showToast);
      }
    } catch (err) {
      console.log('handleing spark error submit', err);
    } finally {
      setIsRetrying(false);
    }
  };
  return (
    <View
      style={[styles.globalContainer, { backgroundColor: transparentOveraly }]}
    >
      <View
        style={[
          styles.content,
          {
            backgroundColor: theme ? backgroundOffset : backgroundColor,
          },
        ]}
      >
        <TouchableOpacity
          onPress={navigate.goBack}
          style={{ marginLeft: 'auto' }}
        >
          <ThemeIcon iconName={'X'} />
        </TouchableOpacity>
        <ThemeText
          styles={styles.headerText}
          content={
            retryCount < 1
              ? t('wallet.homeLightning.sparkErrorScreen.retry')
              : t('wallet.homeLightning.sparkErrorScreen.connectionError')
          }
        />
        <CustomButton
          buttonStyles={{
            width: 'auto',
            backgroundColor: COLORS.darkModeText,

            ...CENTER,
          }}
          textStyles={{
            color: COLORS.lightModeText,
            paddingHorizontal: 20,
          }}
          useLoading={isRetrying}
          textContent={
            retryCount < 1 ? t('constants.retry') : t('constants.reportError')
          }
          actionFunction={handleSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
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
    marginTop: 20,
  },
});
