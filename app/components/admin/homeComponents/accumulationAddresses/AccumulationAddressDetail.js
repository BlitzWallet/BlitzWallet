import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ViewShot from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import { CENTER, COLORS } from '../../../../constants';
import { createPdf } from 'react-native-pdf-from-image';
import { shareFile } from '../../../../functions/handleShare';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';

function normalizeFileUri(uri) {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export default function AccumulationAddressDetail() {
  const navigate = useNavigation();
  const route = useRoute();
  const { address } = route.params;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { deleteAddress } = useAccumulationAddresses();
  const viewShotRef = useRef(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const depositAddress = address.depositAddress;
  const shortAddress = `${depositAddress.slice(0, 8)}...${depositAddress.slice(
    -8,
  )}`;

  const handleCopy = useCallback(() => {
    copyToClipboard(depositAddress, showToast);
  }, [depositAddress, showToast]);

  const handlePrint = useCallback(async () => {
    try {
      setIsPrinting(true);
      const imageURI = await viewShotRef.current.capture();
      const pdfName = `accumulation-address-${address.accumulationAddressId}.pdf`;
      const response = await createPdf({
        imagePaths: [imageURI],
        name: pdfName,
      });
      const destinationPath = `${FileSystem.documentDirectory}${pdfName}`;
      await FileSystem.copyAsync({
        from: normalizeFileUri(response.filePath),
        to: destinationPath,
      });
      await shareFile(destinationPath, {
        mimeType: 'application/pdf',
        dialogTitle: t('screens.accumulationAddresses.detail.printQR'),
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      console.log('print error', err);
    } finally {
      setIsPrinting(false);
    }
  }, [address.accumulationAddressId, t]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      t('screens.accumulationAddresses.detail.deleteConfirmTitle'),
      t('screens.accumulationAddresses.detail.deleteConfirmBody'),
      [
        { text: t('constants.cancel'), style: 'cancel' },
        {
          text: t('screens.accumulationAddresses.detail.deleteButton'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const ok = await deleteAddress(address.accumulationAddressId);
            setIsDeleting(false);
            if (ok) {
              navigate.goBack();
            } else {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(
                  'screens.accumulationAddresses.errors.deleteFailed',
                ),
              });
            }
          },
        },
      ],
    );
  }, [address, deleteAddress, navigate, t]);

  if (isDeleting) {
    return <FullLoadingScreen />;
  }

  return (
    <GlobalThemeView useStandardWidth>
      <CustomSettingsTopBar
        label={`${address.sourceChain}`}
        showLeftImage={true}
        leftImageStyles={{ height: 25 }}
        iconNew="Trash2"
        leftImageFunction={handleDelete}
        textStyles={{ textTransform: 'capitalize' }}
      />
      <View style={styles.innerContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* QR Code */}
          <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
            <QrCodeWrapper
              QRData={depositAddress}
              outerContainerStyle={{
                backgroundColor: COLORS.darkModeText,
                marginTop: 20,
              }}
            />
          </ViewShot>

          {/* Address display */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.addressRow}
            onPress={handleCopy}
          >
            <ThemeText styles={styles.addressText} content={shortAddress} />
            <ThemeIcon iconName="Copy" size={18} />
          </TouchableOpacity>

          {/* Metadata */}
          <View style={styles.metaRow}>
            <MetaCell
              label={t('screens.accumulationAddresses.detail.chain')}
              value={address.sourceChain}
            />
            <MetaCell
              label={t('screens.accumulationAddresses.detail.source')}
              value={address.sourceAsset}
            />
            <MetaCell
              label={t('screens.accumulationAddresses.detail.Destination')}
              value={
                address.destinationAsset === 'BTC'
                  ? t('constants.bitcoin_upper')
                  : t('constants.dollars_upper')
              }
            />
          </View>
        </ScrollView>
        {/* Print button */}
        <CustomButton
          buttonStyles={styles.printBtn}
          textContent={t('screens.accumulationAddresses.detail.printQR')}
          actionFunction={handlePrint}
          useLoading={isPrinting}
        />
      </View>
    </GlobalThemeView>
  );
}

function MetaCell({ label, value }) {
  return (
    <View style={styles.metaCell}>
      <ThemeText styles={styles.metaLabel} content={label} />
      <ThemeText styles={styles.metaValue} content={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  qrContainer: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginVertical: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    marginTop: 20,
  },
  addressText: { fontFamily: 'monospace', fontSize: 14 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  metaCell: { alignItems: 'center' },
  metaLabel: { fontSize: 12, opacity: 0.6, marginBottom: 2 },
  metaValue: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  printBtn: { width: '100%', marginBottom: 12 },
  deleteBtn: {
    width: '100%',
    backgroundColor: COLORS.cancelRed,
  },
  deleteText: { color: COLORS.white },
});
