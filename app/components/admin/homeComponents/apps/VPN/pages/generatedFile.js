import {
  Image,
  Platform,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import {copyToClipboard} from '../../../../../../functions';
import {useNavigation} from '@react-navigation/native';
import {CENTER, ICONS} from '../../../../../../constants';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {SIZES, WINDOWWIDTH} from '../../../../../../constants/theme';
import {backArrow} from '../../../../../../constants/styles';
import GetThemeColors from '../../../../../../hooks/themeColors';
import QrCodeWrapper from '../../../../../../functions/CustomElements/QrWrapper';
import writeAndShareFileToFilesystem from '../../../../../../functions/writeFileToFilesystem';
import {useToast} from '../../../../../../../context-store/toastManager';

export default function GeneratedVPNFile(props) {
  const navigate = useNavigation();
  const generatedFile =
    props?.generatedFile || props?.route?.params?.generatedFile;

  return (
    <GlobalThemeView>
      {props?.generatedFile ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <VPNFileDisplay generatedFile={generatedFile} />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            width: WINDOWWIDTH,
            ...CENTER,
          }}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={{marginRight: 'auto'}}
              onPress={() => {
                navigate.goBack();
              }}>
              <Image style={[backArrow]} source={ICONS.smallArrowLeft} />
            </TouchableOpacity>
          </View>
          <View
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <VPNFileDisplay generatedFile={generatedFile} />
          </View>
        </View>
      )}
    </GlobalThemeView>
  );
}

function VPNFileDisplay({generatedFile}) {
  const {showToast} = useToast();
  const navigate = useNavigation();
  const {backgroundOffset} = GetThemeColors();

  console.log(generatedFile);

  return (
    <>
      <ThemeText
        styles={{marginBottom: 10}}
        content={'Wiregurard Config File'}
      />

      <TouchableOpacity
        onPress={() => {
          copyToClipboard(generatedFile.join('\n'), showToast);
        }}>
        <QrCodeWrapper QRData={generatedFile.join('\n')} />
      </TouchableOpacity>

      <View style={{flexDirection: 'row', marginTop: 20}}>
        <CustomButton
          buttonStyles={{...CENTER, marginRight: 10, width: 'auto'}}
          textContent={'Download'}
          actionFunction={() => {
            downloadVPNFile({generatedFile, navigate});
          }}
        />
        <CustomButton
          buttonStyles={{...CENTER, with: 'auto'}}
          textContent={'Copy'}
          actionFunction={() => {
            copyToClipboard(generatedFile.join('\n'), showToast);
          }}
        />
      </View>
      <ThemeText
        styles={{marginTop: 10, textAlign: 'center'}}
        content={
          Platform.OS === 'ios'
            ? 'When dowloading, click save to files'
            : 'When dowloading, you will need to give permission to a location where we can save the config file to.'
        }
      />
    </>
  );
}

async function downloadVPNFile({generatedFile, navigate}) {
  const content = generatedFile.join('\n');
  const fileName = `blitzVPN.conf`;

  const response = await writeAndShareFileToFilesystem(
    content,
    fileName,
    'application/octet-stream',
    navigate,
  );
  if (!response.success) {
    navigate.navigate('ErrorScreen', {errorMessage: response.error});
  }
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },
  topBarText: {
    fontSize: SIZES.large,
    textTransform: 'capitalize',
    includeFontPadding: false,
  },
});
