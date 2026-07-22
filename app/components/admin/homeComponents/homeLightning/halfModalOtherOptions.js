import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import { ICONS } from '../../../../constants';
import { Image } from 'expo-image';

import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';

export default function SelectOtherReceiveOptionHalfModal({ onShowQR }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  // ── Chain step ──────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {[
          { id: 'bitcoin', label: 'Bitcoin' },
          { id: 'liquid', label: 'Liquid' },
          { id: 'rootstock', label: 'Rootstock' },
          { id: 'spark', label: 'Spark' },
        ].map(chain => (
          <ChainRow
            key={chain.id}
            chain={chain}
            onSelectAsset={() =>
              onShowQR({
                selectedRecieveOption:
                  chain.id === 'bitcoin' ? 'Bitcoin' : chain.id,
              })
            }
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
  const { t } = useTranslation();

  const subtext =
    chain.id === 'bitcoin'
      ? t('wallet.halfModal.bitcoinDesc')
      : chain.id === 'liquid'
      ? t('wallet.halfModal.liquidDesc')
      : chain.id === 'rootstock'
      ? t('wallet.halfModal.roostockDesc')
      : t('wallet.halfModal.sparkDesc');

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
              chain.id === 'bitcoin'
                ? theme && darkModeType
                  ? backgroundColor
                  : COLORS.bitcoinOrange
                : theme && darkModeType
                ? backgroundColor
                : COLORS.primary,
          },
        ]}
      >
        {chain.id === 'bitcoin' ? (
          <Image
            source={ICONS.bitcoinIcon}
            style={{ width: 26, height: 26, tintColor: 'white' }}
          />
        ) : (
          <Image
            style={styles.assetIcon}
            source={
              ICONS[
                chain.id === 'liquid'
                  ? 'liquidLogo'
                  : chain.id === 'spark'
                  ? 'sparkLogoLight'
                  : 'rootstockLogo'
              ]
            }
            contentFit="contain"
          />
        )}
      </View>
      <View style={styles.chainTextContainer}>
        <ThemeText styles={styles.optionLabel} content={chain.label} />
        <ThemeText
          styles={styles.chainSubtext}
          content={subtext}
          CustomNumberOfLines={2}
        />
      </View>

      <ThemeIcon iconName="ChevronRight" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  chainRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    // paddingVertical: 8,
    paddingBottom: 16,
  },
  chainIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 44,
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
  chainTextContainer: {
    flex: 1,
  },
  optionLabel: {
    includeFontPadding: false,
    marginBottom: 2,
  },
  chainSubtext: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
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
    width: '100%',
    height: '100%',
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
