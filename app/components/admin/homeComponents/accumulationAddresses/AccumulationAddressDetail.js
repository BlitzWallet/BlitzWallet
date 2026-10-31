import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ViewShot from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import {
  ACCUMULATION_CHAINS,
  classifyReindexResponse,
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
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { createPdf } from 'react-native-pdf-from-image';
import { shareFile } from '../../../../functions/handleShare';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import fetchBackend from '../../../../../db/handleBackend';
import { useKeysContext } from '../../../../../context-store/keys';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import QrCard from '../../../../functions/CustomElements/redesign/QrCard';
import Note from '../../../../functions/CustomElements/redesign/Note';
import {
  CoinChainLogo,
  destinationLabel,
  shortenAddress,
} from './AccumulationAddressCard';

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
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { tokens } = GetThemeColors();
  const { addressesForOption, deleteAddress } = useAccumulationAddresses();
  const viewShotRef = useRef(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [selectedId, setSelectedId] = useState(
    route.params?.selectedId ?? null,
  );

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

  const chainLabel =
    ACCUMULATION_CHAINS.find(c => c.id === selected?.sourceChain)?.label ??
    selected?.sourceChain;
  const depositAddress = selected?.depositAddress ?? '';
  const hasSeveral = groupAddresses.length > 1;

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
    if (Platform.OS === 'web') return;
    if (!viewShotRef.current?.capture) return;
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
          requsetTime: now,
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
        type: outcome === 'funds' ? 'success' : 'error',
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
    navigate.navigate('ConfirmDialog', {
      title: t('screens.accumulationAddresses.detail.deleteConfirmTitle'),
      message: t('screens.accumulationAddresses.detail.deleteConfirmBody'),
      cancelLabel: t('constants.cancel'),
      confirmLabel: t('constants.delete'),
      onConfirm: async () => {
        setIsDeleting(true);
        const ok = await deleteAddress(selected.accumulationAddressId);
        setIsDeleting(false);
        if (ok) {
          if (groupAddresses.length > 1) {
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
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={`${selected.sourceAsset} → ${destinationLabel(
            selected.destinationAsset,
            t,
          )}`}
          right={
            <IconButton
              icon="Trash2"
              label="screens.accumulationAddresses.detail.deleteButton"
              onPress={handleDelete}
            />
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 200 ms cross-fade when another address in the group is picked */}
          <Animated.View
            key={selected.accumulationAddressId}
            entering={FadeIn.duration(200)}
          >
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'jpg', quality: 0.9 }}
            >
              <QrCard
                value={depositAddress}
                badge={
                  <CoinChainLogo
                    asset={selected.sourceAsset}
                    chainLabel={chainLabel}
                  />
                }
              >
                <TouchableOpacity
                  disabled={!hasSeveral}
                  onPress={handleSelectAddress}
                  accessibilityRole={hasSeveral ? 'button' : undefined}
                  style={styles.addressRow}
                >
                  <ThemeText
                    styles={[styles.address, { color: tokens.muted }]}
                    content={shortenAddress(depositAddress)}
                  />
                  {hasSeveral && (
                    <ThemeIcon
                      redesign
                      iconName="ChevronDown"
                      size={16}
                      colorOverride={tokens.muted}
                    />
                  )}
                </TouchableOpacity>
              </QrCard>
            </ViewShot>
          </Animated.View>

          <View style={styles.note}>
            <Note tone="warn" text={disclaimer} />
          </View>

          <View style={styles.pillRow}>
            <CustomButton
              buttonStyles={styles.pill}
              size="regular"
              tone="secondary"
              icon="Copy"
              textContent={t('constants.copy')}
              actionFunction={handleCopy}
            />
            {Platform.OS !== 'web' && (
              <CustomButton
                buttonStyles={styles.pill}
                size="regular"
                tone="secondary"
                icon="Printer"
                textContent={t('constants.print')}
                actionFunction={handlePrint}
                useLoading={isPrinting}
              />
            )}
          </View>
        </CustomScrollView>
        <CustomButton
          buttonStyles={styles.bottomButton}
          size="regular"
          textContent={t('screens.accumulationAddresses.detail.reindex')}
          actionFunction={handleAddressReindex}
          useLoading={isCheckingBalance}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  address: {
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },
  note: { marginTop: 16 },
  pillRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pill: { flex: 1, width: 'auto' },
  bottomButton: { marginTop: CONTENT_KEYBOARD_OFFSET },
  qrContainer: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginVertical: 20,
  },
  optionBtn: { width: '100%', marginBottom: 10 },
  deleteBtn: {
    width: '100%',
    backgroundColor: COLORS.cancelRed,
  },
  deleteText: { color: COLORS.white },
});
