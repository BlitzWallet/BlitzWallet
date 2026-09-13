import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import { ICONS } from '../../../../constants';
import { Image } from 'expo-image';

import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import {
  ACCUMULATION_BTC_SOURCES,
  ACCUMULATION_CHAINS,
} from '../../../../constants/accumulationAddresses';

const CHAINS = [
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    iconSource: ICONS.bitcoinIcon,
    isBitcoinIcon: true,
  },
  // {
  //   id: 'liquid',
  //   label: 'Liquid',
  //   subtextKey: 'wallet.halfModal.liquidDesc',
  //   iconSource: ICONS.liquidLogo,
  // },
  // {
  //   id: 'rootstock',
  //   label: 'Rootstock',
  //   subtextKey: 'wallet.halfModal.roostockDesc',
  //   iconSource: ICONS.rootstockLogo,
  // },
  // {
  //   id: 'spark',
  //   label: 'Spark',
  //   subtextKey: 'wallet.halfModal.sparkDesc',
  //   iconSource: ICONS.sparkLogoLight,
  // },
];

export default function SelectOtherReceiveOptionHalfModal({ onShowQR }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const isDark = theme && darkModeType;
  const getCircleBackground = isOrange =>
    isDark
      ? backgroundOffset
      : isOrange
      ? COLORS.bitcoinOrange
      : COLORS.primary;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {CHAINS.map(chain => (
          <ReceiveOptionRow
            key={chain.id}
            label={chain.label}
            subtext={t(chain.subtextKey)}
            iconSource={chain.iconSource}
            isBitcoinIcon={chain.isBitcoinIcon}
            circleBackground={getCircleBackground(chain.id === 'bitcoin')}
            onPress={() =>
              onShowQR({
                selectedRecieveOption:
                  chain.id === 'bitcoin' ? 'Bitcoin' : chain.id,
              })
            }
          />
        ))}

        {/* Bitcoin held on other chains — routed to BTC via an accumulation
            address, so it reuses the 'Stablecoins' (accumulation) QR path. */}
        {ACCUMULATION_BTC_SOURCES.map(source => {
          const chainLabel =
            ACCUMULATION_CHAINS.find(c => c.id === source.chain)?.label ??
            source.chain;
          return (
            <ReceiveOptionRow
              key={`${source.chain}:${source.asset}`}
              label={chainLabel}
              subtext={`${source.asset} · ${source.name}`}
              iconSource={ICONS[`chain_${chainLabel.toLowerCase()}`]}
              circleBackground={getCircleBackground(true)}
              onPress={() =>
                onShowQR({
                  selectedRecieveOption: 'Stablecoins',
                  sourceChain: source.chain,
                  sourceAsset: source.asset,
                  destinationAsset: 'BTC',
                })
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function ReceiveOptionRow({
  label,
  subtext,
  iconSource,
  isBitcoinIcon,
  circleBackground,
  onPress,
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
      <View
        style={[styles.iconContainer, { backgroundColor: circleBackground }]}
      >
        <Image
          source={iconSource}
          style={isBitcoinIcon ? styles.bitcoinIcon : styles.assetIcon}
          contentFit="contain"
        />
      </View>
      <View style={styles.textContainer}>
        <ThemeText styles={styles.optionLabel} content={label} />
        {!!subtext && <ThemeText styles={styles.subtext} content={subtext} />}
      </View>
      <ThemeIcon iconName="ChevronRight" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  bitcoinIcon: {
    width: 26,
    height: 26,
    tintColor: 'white',
  },
  assetIcon: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
  },
  optionLabel: {
    includeFontPadding: false,
    marginBottom: 2,
  },
  subtext: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
});
