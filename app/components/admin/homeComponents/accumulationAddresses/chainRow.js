import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ICONS } from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import {
  CHAIN_ASSET_ROW_HEIGHT,
  CHAIN_EXPAND_PADDING,
} from '../../../../constants/accumulationAddresses';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ThemeText } from '../../../../functions/CustomElements';
import { useEffect } from 'react';
import { useTheme } from '../../../../../context-store/theme';

// Flush chain row (52, 32 logo, chevron-down) that opens its coins in place.
export default function ChainRow({
  chain,
  expanded,
  disableExpand = false,
  onToggleExpand,
  onSelectAsset,
  isAssetTaken,
  onDisabledAssetPress,
}) {
  const expandHeight = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    expandHeight.value = withTiming(expanded ? 1 : 0, { duration: 200 });
    chevronRotation.value = withTiming(expanded ? 1 : 0, { duration: 200 });
  }, [expanded]);

  const expandedStyle = useAnimatedStyle(() => ({
    height:
      expandHeight.value *
      (chain.assets.length * CHAIN_ASSET_ROW_HEIGHT + CHAIN_EXPAND_PADDING),
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));
  const { tokens } = useTheme();

  const isSpark = chain.id === 'spark';

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.chainRow}
        onPress={() => onToggleExpand(chain.id)}
        accessibilityRole="button"
        accessibilityState={disableExpand ? undefined : { expanded }}
      >
        <View
          style={[
            styles.chainIconContainer,
            isSpark && { backgroundColor: tokens.accent },
          ]}
        >
          <Image
            style={styles.chainIcon}
            source={
              ICONS[
                isSpark
                  ? 'sparkLogoLight'
                  : `chain_${chain.label.toLowerCase()}`
              ]
            }
            contentFit="contain"
          />
        </View>
        <ThemeText styles={styles.label} content={chain.label} />

        <Animated.View style={[chevronStyle]}>
          <ThemeIcon
            redesign
            iconName={disableExpand ? 'ChevronRight' : 'ChevronDown'}
            size={18}
            colorOverride={tokens.muted}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[styles.assetOptionsContainer, expandedStyle]}
      >
        {chain.assets.map(asset => {
          const disabled = isAssetTaken(asset);
          return (
            <TouchableOpacity
              key={asset}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${asset} ${chain.label}`}
              accessibilityState={{ disabled }}
              style={[
                styles.assetOptionRow,
                { opacity: disabled ? HIDDEN_OPACITY : 1 },
              ]}
              onPress={() =>
                disabled ? onDisabledAssetPress() : onSelectAsset(chain, asset)
              }
            >
              <Image
                style={styles.assetOptionIcon}
                source={ICONS[`${asset.toLowerCase()}Logo`]}
                contentFit="contain"
              />
              <ThemeText styles={styles.label} content={asset} />
              <ThemeIcon
                redesign
                iconName="ChevronRight"
                size={18}
                colorOverride={tokens.muted}
              />
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  chainRow: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chainIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainIcon: {
    width: '100%',
    height: '100%',
  },
  label: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  assetOptionsContainer: {
    overflow: 'hidden',
    paddingTop: CHAIN_EXPAND_PADDING / 2,
    paddingBottom: CHAIN_EXPAND_PADDING / 2,
  },
  // 32 spacer + 12 gap, then the 28 coin logo (design D224).
  assetOptionRow: {
    height: CHAIN_ASSET_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 44,
    gap: 12,
  },
  assetOptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
