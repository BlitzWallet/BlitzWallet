import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
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
import {
  ACCUMULATION_CHAINS,
  classifyReindexResponse,
  getPairKey,
  getReindexThrottle,
  REINDEX_TIMES_KEY,
} from '../../../../constants/accumulationAddresses';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../functions/localStorage';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
} from '../../../../constants';
import { createPdf } from 'react-native-pdf-from-image';
import { shareFile } from '../../../../functions/handleShare';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import fetchBackend from '../../../../../db/handleBackend';
import { useKeysContext } from '../../../../../context-store/keys';

function normalizeFileUri(uri) {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export default function AccumulationAddressDetail() {
  const navigate = useNavigation();
  const route = useRoute();
  const { sourceChain, sourceAsset, destinationAsset } = route.params;
  const triple = { sourceChain, sourceAsset, destinationAsset };
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { contactsPrivateKey, publicKey } = useKeysContext();

  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { addresses, addressesForOption, deleteAddress } =
    useAccumulationAddresses();
  const viewShotRef = useRef(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const groupAddresses = addressesForOption(triple);
  const selected =
    groupAddresses.find(a => a.accumulationAddressId === selectedId) ??
    groupAddresses[0];

  // Leave the screen if the viewed option is emptied externally (e.g. another
  // device's masterInfoObject sync). Ref latch avoids firing on the transient
  // pre-hydration mount where addresses is briefly empty.
  const hasHadAddressesRef = useRef(false);
  useEffect(() => {
    if (groupAddresses.length > 0) hasHadAddressesRef.current = true;
    else if (hasHadAddressesRef.current && !isDeleting) navigate.goBack();
  }, [groupAddresses.length, isDeleting, navigate]);

  const options = useMemo(() => {
    const byKey = new Map();
    for (const a of addresses) {
      const key = getPairKey(a);
      if (!byKey.has(key))
        byKey.set(key, {
          sourceChain: a.sourceChain,
          sourceAsset: a.sourceAsset,
          destinationAsset: a.destinationAsset,
        });
    }
    return Array.from(byKey.values());
  }, [addresses]);

  const chainLabel =
    ACCUMULATION_CHAINS.find(c => c.id === selected?.sourceChain)?.label ??
    selected?.sourceChain;
  const depositAddress = selected?.depositAddress ?? '';
  const shortAddress = `${depositAddress.slice(0, 8)}...${depositAddress.slice(
    -8,
  )}`;

  const disclaimer =
    selected?.destinationAsset === 'BTC'
      ? t('wallet.halfModal.depositQRInstruction_accumulation_bitcoin', {
          asset: selected?.sourceAsset,
          chain: chainLabel,
        })
      : t('wallet.halfModal.depositQRInstruction_stablecoins', {
          asset: selected?.sourceAsset,
          chain: chainLabel,
        });

  const handleCopy = useCallback(() => {
    copyToClipboard(depositAddress, showToast);
  }, [depositAddress, showToast]);

  const handleSelectAddress = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'accumulationAddressSelect',
      sliderHight: 0.5,
      addresses: groupAddresses,
      selectedId: selected.accumulationAddressId,
      onSelect: addr => setSelectedId(addr.accumulationAddressId),
    });
  }, [navigate, groupAddresses, selected]);

  const handlePrint = useCallback(async () => {
    try {
      setIsPrinting(true);
      const imageURI = await viewShotRef.current.capture();
      const pdfName = `accumulation-address-${selected.accumulationAddressId}.pdf`;
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
  }, [selected, t]);

  const handleAddressReindex = useCallback(async () => {
    if (!depositAddress) return;
    const showError = () =>
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.accumulationAddresses.detail.reindexError'),
      });
    try {
      const now = Date.now();
      const map =
        JSON.parse(await getLocalStorageItem(REINDEX_TIMES_KEY)) || {};
      const { throttled, remainingMs } = getReindexThrottle(
        map,
        depositAddress,
        now,
      );
      if (throttled) {
        showToast({
          type: 'error',
          title: t('screens.accumulationAddresses.detail.reindexThrottled', {
            minutes: Math.ceil(remainingMs / 60000),
          }),
        });
        return;
      }

      setIsCheckingBalance(true);
      const reindexResponse = await fetchBackend(
        'reindexAccumulationAddress',
        {
          depositAddress,
          requset_time: now,
        },
        contactsPrivateKey,
        publicKey,
      );

      const outcome = classifyReindexResponse(reindexResponse);

      if (outcome === 'error') {
        // Don't burn the 15m window on failure — allow immediate retry.
        showError();
        return;
      }

      map[depositAddress] = now;
      await setLocalStorageItem(REINDEX_TIMES_KEY, JSON.stringify(map));
      showToast({
        type: 'error',
        title: t(
          outcome === 'funds'
            ? 'screens.accumulationAddresses.detail.reindexFundsFound'
            : 'screens.accumulationAddresses.detail.reindexNoFunds',
        ),
      });
    } catch (err) {
      console.log('reindex error', err);
      showError();
    } finally {
      setIsCheckingBalance(false);
    }
  }, [depositAddress, t, contactsPrivateKey, publicKey, showToast, navigate]);

  const handleDelete = useCallback(() => {
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t(
        'screens.accumulationAddresses.detail.deleteConfirmBody',
      ),
      confirmFunction: async () => {
        setIsDeleting(true);
        const ok = await deleteAddress(selected.accumulationAddressId);
        setIsDeleting(false);
        if (ok) {
          if (groupAddresses.length <= 1) {
            navigate.goBack();
          } else {
            const next = groupAddresses.find(
              a => a.accumulationAddressId !== selected.accumulationAddressId,
            );
            setSelectedId(next?.accumulationAddressId ?? null);
          }
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(
              'screens.accumulationAddresses.errors.deleteFailed',
            ),
          });
        }
      },
    });
  }, [selected, groupAddresses, deleteAddress, navigate, t]);

  if (isDeleting || !selected) {
    return <FullLoadingScreen />;
  }

  return (
    <GlobalThemeView useStandardWidth>
      <CustomSettingsTopBar
        label={`${chainLabel}`}
        showLeftImage={true}
        leftImageStyles={{ height: 25 }}
        iconNew="Trash2"
        leftImageFunction={handleDelete}
        textStyles={{ textTransform: 'capitalize' }}
        rightContent={
          groupAddresses.length > 1 ? (
            <TouchableOpacity
              style={{ width: 22, height: 22 }}
              onPress={handlePrint}
            >
              {isPrinting ? (
                <FullLoadingScreen
                  loadingColor={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                  size="small"
                  showText={false}
                />
              ) : (
                <ThemeIcon iconName="Printer" size={22} />
              )}
            </TouchableOpacity>
          ) : null
        }
      />
      <View style={styles.innerContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Asset flow */}
          <View style={styles.assetRow}>
            <View style={styles.confirmIconWrapper}>
              <View
                style={[
                  styles.confirmChainCircle,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <Image
                  style={styles.confirmChainIcon}
                  source={ICONS[`chain_${chainLabel.toLowerCase()}`]}
                  contentFit="contain"
                />
              </View>
              <View
                style={[
                  styles.confirmCurrencyBadge,
                  { borderColor: backgroundColor },
                ]}
              >
                <Image
                  style={styles.confirmCurrencyIcon}
                  source={ICONS[`${selected.sourceAsset.toLowerCase()}Logo`]}
                  contentFit="contain"
                />
              </View>
            </View>
            <ThemeIcon styles={{ opacity: 0.7 }} iconName={'ArrowRight'} />
            <View style={styles.confirmIconWrapper}>
              <View
                style={[
                  styles.confirmChainCircle,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundOffset
                        : selected.destinationAsset === 'BTC'
                        ? COLORS.bitcoinOrange
                        : COLORS.dollarGreen,
                  },
                ]}
              >
                <Image
                  style={[styles.confirmChainIcon, { width: 30, height: 30 }]}
                  source={
                    ICONS[
                      selected.destinationAsset === 'BTC'
                        ? 'bitcoinIcon'
                        : 'dollarIcon'
                    ]
                  }
                  contentFit="contain"
                />
              </View>
            </View>
          </View>

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
            style={[styles.addressRow, { backgroundColor: backgroundOffset }]}
            onPress={handleCopy}
          >
            <ThemeText content={shortAddress} />
            <ThemeIcon iconName="Copy" size={18} />
          </TouchableOpacity>
        </ScrollView>
        {/* Print button */}
        <CustomButton
          buttonStyles={styles.printBtn}
          textContent={t('screens.accumulationAddresses.detail.reindex')}
          actionFunction={handleAddressReindex}
          useLoading={isCheckingBalance}
        />
        {/* View all address button*/}
        {groupAddresses.length > 1 && (
          <CustomButton
            buttonStyles={styles.viewAllBtn}
            textStyles={{ color: textColor }}
            textContent={t('screens.accumulationAddresses.detail.viewAll')}
            actionFunction={handleSelectAddress}
          />
        )}
        {/* Disclaimer */}
        <ThemeText styles={styles.disclaimer} content={disclaimer} />
      </View>
    </GlobalThemeView>
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
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  disclaimer: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginTop: 12,
    includeFontPadding: false,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  confirmIconWrapper: {
    position: 'relative',
  },
  confirmChainCircle: {
    width: 50,
    height: 50,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmChainIcon: {
    width: 50,
    height: 50,
  },
  confirmCurrencyBadge: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderRadius: 15,
    bottom: -4,
    right: -4,
    borderWidth: 2,
    overflow: 'hidden',
  },
  confirmCurrencyIcon: {
    width: '100%',
    height: '100%',
  },
  printBtn: { width: '100%', marginTop: CONTENT_KEYBOARD_OFFSET },
  viewAllBtn: { backgroundColor: 'transparent' },
  optionBtn: { width: '100%', marginBottom: 10 },
  deleteBtn: {
    width: '100%',
    backgroundColor: COLORS.cancelRed,
  },
  deleteText: { color: COLORS.white },
});
