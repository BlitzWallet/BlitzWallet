import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import { ICONS } from '../../../../constants';
import { Image } from 'expo-image';

import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';

export default function SelectOtherReceiveOptionHalfModal({
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  // ── Chain step ──────────────────────────────────────────────────────────────

  return (
    <View>
      <ThemeText
        styles={styles.stepTitle}
        content={t('wallet.halfModal.othersOptionTitle')}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {[
          { id: 'liquid', label: 'Liquid' },
          { id: 'rootstock', label: 'Rootstock' },
        ].map(chain => (
          <ChainRow
            key={chain.id}
            chain={chain}
            onSelectAsset={() => {
              handleBackPressFunction(() => {
                navigate.replace('ReceiveBTC', {
                  selectedRecieveOption: chain.id,
                });
              });
            }}
            theme={theme}
            darkModeType={darkModeType}
            backgroundColor={backgroundColor}
            backgroundOffset={backgroundOffset}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ChainRow({
  chain,
  onSelectAsset,
  theme,
  darkModeType,
  backgroundColor,
}) {
  return (
    <TouchableOpacity
      onPress={onSelectAsset}
      activeOpacity={0.7}
      style={styles.chainRow}
    >
      <View
        style={[
          styles.chainIconContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : COLORS.primary,
          },
        ]}
      >
        <Image
          style={styles.assetIcon}
          source={
            ICONS[chain.id === 'liquid' ? 'blockstreamLiquid' : 'rootstockLogo']
          }
          contentFit="contain"
        />
      </View>
      <ThemeText styles={styles.optionLabel} content={chain.label} />

      <ThemeIcon
        styles={{ opacity: HIDDEN_OPACITY }}
        iconName="ChevronRight"
        size={18}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  stepTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
  },
  chainRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  chainIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  optionLabel: {
    flex: 1,
    includeFontPadding: false,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetIcon: {
    width: 25,
    height: 25,
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
