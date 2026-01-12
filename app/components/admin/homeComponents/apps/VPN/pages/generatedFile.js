import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import { copyToClipboard } from '../../../../../../functions';
import { useNavigation } from '@react-navigation/native';
import { CENTER } from '../../../../../../constants';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import QrCodeWrapper from '../../../../../../functions/CustomElements/QrWrapper';
import writeAndShareFileToFilesystem from '../../../../../../functions/writeFileToFilesystem';
import { useToast } from '../../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import customUUID from '../../../../../../functions/customUUID';
import sha256Hash from '../../../../../../functions/hash';

export default function GeneratedVPNFile(props) {
  const generatedFile =
    props?.generatedFile || props?.route?.params?.generatedFile;

  return (
    <GlobalThemeView>
      {props?.generatedFile ? (
        <View style={styles.vpnQrContainer}>
          <VPNFileDisplay generatedFile={generatedFile} />
        </View>
      ) : (
        <View style={styles.viewingAsPageStyle}>
          <CustomSettingsTopBar />
          <View style={styles.vpnQrContainer}>
            <VPNFileDisplay generatedFile={generatedFile} />
          </View>
        </View>
      )}
    </GlobalThemeView>
  );
}

function VPNFileDisplay({ generatedFile }) {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  console.log(generatedFile, typeof generatedFile);

  const configData =
    typeof generatedFile === 'string'
      ? generatedFile
      : generatedFile.join('\n');

  return (
    <>
      <ThemeText
        styles={styles.headerText}
        content={t('apps.VPN.generatedFile.title')}
      />

      <TouchableOpacity
        onPress={() => {
          copyToClipboard(configData, showToast);
        }}
      >
        <QrCodeWrapper QRData={configData} />
      </TouchableOpacity>

      <View style={styles.copyButtonsContainer}>
        <CustomButton
          buttonStyles={styles.buttonContainer}
          textContent={t('constants.download')}
          actionFunction={() => {
            downloadVPNFile({ generatedFile: configData, navigate });
          }}
        />
        <CustomButton
          buttonStyles={styles.buttonContainer}
          textContent={t('constants.copy')}
          actionFunction={() => {
            copyToClipboard(configData, showToast);
          }}
        />
      </View>
      <ThemeText
        styles={styles.instrucText}
        content={
          Platform.OS === 'ios'
            ? t('apps.VPN.generatedFile.iosDownloadInstructions')
            : t('apps.VPN.generatedFile.androidDownloadInstructions')
        }
      />
    </>
  );
}

async function downloadVPNFile({ generatedFile, navigate }) {
  const content = generatedFile;
  const fileHash = sha256Hash(content);
  const fileName = `blitzVPN-${fileHash?.slice(0, 8) || customUUID()}.conf`;

  const response = await writeAndShareFileToFilesystem(
    content,
    fileName,
    'application/octet-stream',
    navigate,
  );
  if (!response.success) {
    navigate.navigate('ErrorScreen', {
      errorMessage: response.error,
      useTranslationString: true,
    });
  }
}

const styles = StyleSheet.create({
  vpnQrContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewingAsPageStyle: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },

  headerText: { marginBottom: 10 },
  copyButtonsContainer: {
    maxWidth: 275,
    width: '100%',
    flexDirection: 'row',
    marginTop: 20,
    columnGap: 10,
    flexWrap: 'wrap',
  },
  buttonContainer: { flexGrow: 1, minWidth: 90, maxWidth: '48%' },
  instrucText: {
    marginTop: 20,
    textAlign: 'center',
    width: INSET_WINDOW_WIDTH,
  },
});
