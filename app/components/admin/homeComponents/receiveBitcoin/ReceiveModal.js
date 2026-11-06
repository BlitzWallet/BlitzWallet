import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { SHADOWS } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import { SheetSurface } from '../../../../functions/CustomElements/redesign/sheetSurface';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { QrBadge } from './receiveParts';
import ReceiveAssetSheet from './ReceiveAssetSheet';

const DURATION = 250;

// "Receive from another wallet or exchange" panel docked under the contact
// list (Receive.dc.html). It sits in the page flow so the contact list keeps
// its own scroll; Bitcoin and Dollars float the panel over the page and grow
// it upwards into the Receive sheet (an in-page copy of halfModal.js).
// Closing shrinks it back into the dock. Tokens goes straight to the token QR.
export default function ReceiveModal({ contentWidth }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { bottomPadding } = useGlobalInsets();
  const { showTokensInformation } = useSparkWallet();

  // Asset whose sheet is open; null while docked.
  const [asset, setAsset] = useState(null);
  const [dockedHeight, setDockedHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(0);
  const openHeight = useSharedValue(0);
  const isClosing = useRef(false);
  const assetRef = useRef(null);
  assetRef.current = asset;

  useEffect(() => {
    if (!asset || !contentHeight) return;
    openHeight.value = Math.max(contentHeight, dockedHeight);
    progress.value = withTiming(1, { duration: DURATION });
  }, [asset, contentHeight]);

  const finishClose = useCallback(() => {
    isClosing.current = false;
    setAsset(null);
    setContentHeight(0);
  }, []);

  // A drag on the grab can interrupt the close; without this the sheet would
  // spring back open and ignore every later close.
  const cancelClose = useCallback(() => {
    isClosing.current = false;
  }, []);

  // Same contract as halfModal's handleBackPressFunction: shrink back into
  // the dock, then run the optional follow-up (opening the next screen).
  const close = useCallback(
    next => {
      if (!assetRef.current || isClosing.current) return true;
      isClosing.current = true;
      progress.value = withTiming(0, { duration: DURATION }, finished => {
        scheduleOnRN(finished ? finishClose : cancelClose);
      });
      if (typeof next === 'function') next();
      return true;
    },
    [finishClose, cancelClose],
  );

  // Stable identity keeps this under the sheet's own "networks → options"
  // back handler on the LIFO BackHandler stack.
  useHandleBackPressNew(
    useCallback(() => (assetRef.current ? close() : false), [close]),
  );

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      const range = openHeight.value - dockedHeight;
      if (e.translationY > 0 && range > 0) {
        progress.value = Math.max(0, 1 - e.translationY / range);
      }
    })
    .onEnd(e => {
      if (e.translationY > 100) {
        scheduleOnRN(close);
      } else {
        progress.value = withSpring(1);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [dockedHeight, openHeight.value],
    ),
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const dockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <>
      {!!asset && (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: tokens.scrim },
              scrimStyle,
            ]}
          >
            <Pressable style={styles.fill} onPress={() => close()} />
          </Animated.View>
          {/* Holds the dock's place so the contact list doesn't jump. */}
          <View style={{ height: dockedHeight }} />
        </>
      )}
      <Animated.View
        onLayout={
          asset ? undefined : e => setDockedHeight(e.nativeEvent.layout.height)
        }
        style={[
          styles.panel,
          { backgroundColor: tokens.surface, paddingBottom: bottomPadding },
          !!asset && [styles.floating, panelStyle],
        ]}
      >
        <Animated.View
          pointerEvents={asset ? 'none' : 'auto'}
          style={[{ width: contentWidth }, dockStyle]}
        >
          <SectionHeader first title={t('receive.fromAnotherWallet')} />
          <ListCard forceSheetColor>
            <ListRow
              onPress={() => setAsset('bitcoin')}
              lead={<QrBadge kind="bitcoin" size={36} />}
              title={t('constants.bitcoin_upper')}
              showChevron
            />
            <ListRow
              onPress={() => setAsset('dollars')}
              lead={<QrBadge kind="dollar" size={36} />}
              title={t('constants.dollars_upper')}
              showChevron
            />
            {showTokensInformation && (
              <ListRow
                onPress={() =>
                  navigate.navigate('ReceiveAddressPage', {
                    selectedRecieveOption: 'spark',
                    fromTokens: true,
                  })
                }
                lead={<Disc icon="Layers" />}
                title={t('constants.tokens')}
                showChevron
              />
            )}
          </ListCard>
        </Animated.View>

        {!!asset && (
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <GestureDetector gesture={panGesture}>
              <View style={styles.grabArea}>
                <View style={[styles.grab, { backgroundColor: tokens.grab }]} />
              </View>
            </GestureDetector>
            <SheetSurface>
              <ReceiveAssetSheet
                asset={asset}
                setContentHeight={setContentHeight}
                handleBackPressFunction={close}
              />
            </SheetSurface>
          </Animated.View>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  panel: {
    width: '100%',
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...SHADOWS.small,
  },
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Matches halfModal's redesign sheet: grab on top, 34 below the content.
  sheet: { ...StyleSheet.absoluteFillObject, paddingBottom: 34 },
  grabArea: { paddingTop: 10, alignItems: 'center' },
  grab: { width: 36, height: 5, borderRadius: 999 },
});
