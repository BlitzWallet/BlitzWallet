import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ACCUMULATION_CHAINS } from '../../../../constants/accumulationAddresses';
import { Image } from 'expo-image';
import { ICONS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';

export default function AccumulationAddressCard({ address }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const chainMeta = ACCUMULATION_CHAINS.find(c => c.id === address.sourceChain);
  const chainLabel = chainMeta?.label ?? address.sourceChain ?? '';
  const label = `${address.sourceAsset} → ${
    address.destinationAsset === 'BTC'
      ? t('constants.bitcoin_upper')
      : t('constants.dollars_upper')
  }`;

  if (!chainLabel) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() =>
        navigate.navigate('AccumulationAddressDetail', { address })
      }
    >
      <View style={styles.leftSection}>
        <Image
          style={styles.assetIcon}
          source={ICONS[`chain_${chainLabel.toLocaleLowerCase()}`]}
          contentFit="contain"
        />
      </View>
      <View style={styles.middleSection}>
        <ThemeText styles={styles.label} content={chainLabel} />
        <ThemeText styles={styles.swapMeta} content={label} />
      </View>
      <ThemeIcon iconName={'ChevronRight'} size={20} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 45,
    borderRadius: 16,
    paddingVertical: 10,
  },
  assetIcon: {
    width: 45,
    height: 45,
    borderRadius: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: 500,
    includeFontPadding: false,
  },
  swapMeta: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
  },
  middleSection: {
    flex: 1,
    gap: 2,
    marginLeft: 8,
    marginRight: 5,
  },
});
