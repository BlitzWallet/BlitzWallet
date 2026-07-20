import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CENTER, ICONS } from '../../../../constants';
import { COLORS, HIDDEN_OPACITY } from '../../../../constants/theme';
import {
  CHAIN_ASSET_ROW_HEIGHT,
  CHAIN_EXPAND_PADDING,
} from '../../../../constants/accumulationAddresses';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ThemeText } from '../../../../functions/CustomElements';
import { useEffect } from 'react';

export default function ChainRow({
  chain,
  expanded,
  disableExpand = false,
  onToggleExpand,
  onSelectAsset,
  isAssetTaken,
  onDisabledAssetPress,
  theme,
  darkModeType,
  backgroundColor,
  backgroundOffset,
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

  const isSpark = chain.id === 'spark';

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.chainRow}
        onPress={() => onToggleExpand(chain.id)}
      >
        <View
          style={[
            styles.chainIconContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
            isSpark && {
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary,
            },
          ]}
        >
          <Image
            style={[
              styles.assetIcon,
              isSpark && {
                width: 20,
                height: 20,
              },
            ]}
            source={
              ICONS[
                isSpark
                  ? 'sparkAsteriskWhite'
                  : `chain_${chain.label.toLowerCase()}`
              ]
            }
            contentFit="contain"
          />
        </View>
        <ThemeText styles={styles.optionLabel} content={chain.label} />

        <Animated.View style={[chevronStyle]}>
          <ThemeIcon
            iconName={disableExpand ? 'ChevronRight' : 'ChevronDown'}
            size={18}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.assetOptionsContainer, expandedStyle]}>
        {chain.assets.map(asset => {
          const disabled = isAssetTaken(asset);
          return (
            <TouchableOpacity
              key={asset}
              activeOpacity={0.7}
              style={[
                styles.assetOptionRow,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                  opacity: disabled ? HIDDEN_OPACITY : 1,
                },
              ]}
              onPress={() =>
                disabled ? onDisabledAssetPress() : onSelectAsset(chain, asset)
              }
            >
              <View style={styles.assetOptionIconContainer}>
                <Image
                  style={styles.assetOptionIcon}
                  source={ICONS[`${asset.toLowerCase()}Logo`]}
                  contentFit="contain"
                />
              </View>
              <ThemeText styles={styles.optionLabel} content={asset} />
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
    flexDirection: 'row',
    alignItems: 'center',
    // paddingVertical: 8,
  },
  chainIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 22.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionLabel: {
    flex: 1,
    includeFontPadding: false,
  },
  assetIcon: {
    width: 48,
    height: 48,
  },
  assetOptionsContainer: {
    overflow: 'hidden',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  assetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  assetOptionIconContainer: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetOptionIcon: {
    width: 35,
    height: 35,
  },
});
