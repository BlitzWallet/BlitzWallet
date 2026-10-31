import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ACCUMULATION_CHAINS } from '../../../../constants/accumulationAddresses';
import { Image } from 'expo-image';
import { COLORS, ICONS } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import GetThemeColors from '../../../../hooks/themeColors';

// Coin logo with the chain as a small badge (list rows, select sheet, confirm).
export function CoinChainLogo({
  asset,
  chainLabel,
  size = 40,
  badgeSize = 18,
}) {
  const { tokens } = GetThemeColors();
  const isBitcoin = asset?.includes('BTC');

  return (
    <View style={{ width: size, height: size }}>
      {isBitcoin ? (
        <View style={styles.bitcoinContainer}>
          <Image
            style={{ width: size / 1.75, height: size / 1.75 }}
            source={ICONS.bitcoinIcon}
            contentFit="contain"
          />
        </View>
      ) : (
        <Image
          style={{ width: size, height: size, borderRadius: size / 2 }}
          source={
            ICONS[isBitcoin ? 'bitcoinIcon' : `${asset?.toLowerCase()}Logo`]
          }
          contentFit="contain"
        />
      )}
      <View
        style={[
          styles.badge,
          {
            width: badgeSize + 4,
            height: badgeSize + 4,
            borderRadius: (badgeSize + 4) / 2,
            backgroundColor: tokens.surface,
          },
        ]}
      >
        <Image
          style={{
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
          }}
          source={ICONS[`chain_${chainLabel?.toLowerCase()}`]}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

export function destinationLabel(destinationAsset, t) {
  return destinationAsset === 'BTC'
    ? t('constants.bitcoin_upper')
    : t('constants.dollars_upper');
}

export function shortenAddress(address = '') {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function AccumulationAddressCard({ group }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const chainMeta = ACCUMULATION_CHAINS.find(c => c.id === group.sourceChain);
  const chainLabel = chainMeta?.label ?? group.sourceChain ?? '';

  if (!chainLabel) return null;

  return (
    <ListRow
      onPress={() =>
        navigate.navigate('AccumulationAddressDetail', {
          sourceChain: group.sourceChain,
          sourceAsset: group.sourceAsset,
          destinationAsset: group.destinationAsset,
        })
      }
      lead={<CoinChainLogo asset={group.sourceAsset} chainLabel={chainLabel} />}
      title={`${group.sourceAsset} → ${destinationLabel(
        group.destinationAsset,
        t,
      )}`}
      titleStyle={styles.title}
      sub={`${chainLabel}${
        group.count > 1
          ? ` · ${t('screens.accumulationAddresses.addressCount', {
              count: group.count,
            })}`
          : ''
      }`}
      subLines={1}
      minHeight={64}
      trailing="chevron"
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, lineHeight: 21 },
  bitcoinContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bitcoinOrange,
    borderRadius: 999,
  },
});
