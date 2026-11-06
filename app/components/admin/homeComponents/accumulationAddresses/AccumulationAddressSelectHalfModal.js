import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../constants';
import { ACCUMULATION_CHAINS } from '../../../../constants/accumulationAddresses';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import { CoinChainLogo, shortenAddress } from './AccumulationAddressCard';

const ROW_HEIGHT = 61;

// Backend objects carry no timestamp today; the date line shows once one does.
function createdDate(addr) {
  const raw = addr.createdAt ?? addr.created_at ?? addr.createdTime;
  if (!raw) return null;
  const date = new Date(raw);
  if (isNaN(date)) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AccumulationAddressSelectHalfModal({
  addresses,
  selectedId,
  onSelect,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const list = addresses || [];
  const first = list[0];
  const chainLabel =
    ACCUMULATION_CHAINS.find(c => c.id === first?.sourceChain)?.label ??
    first?.sourceChain;

  useEffect(() => {
    setContentHeight(Math.min(640, 174 + list.length * ROW_HEIGHT));
  }, [setContentHeight, list.length]);

  const handleSelect = addr => {
    if (addr.accumulationAddressId !== selectedId) onSelect(addr);
    handleBackPressFunction();
  };

  return (
    <View style={styles.container}>
      <SheetHeader
        first={true}
        title={t('screens.accumulationAddresses.detail.selectAddress')}
        sub={t('screens.accumulationAddresses.detail.selectAddressSub', {
          count: list.length,
          asset: first?.sourceAsset,
          chain: chainLabel,
        })}
      />
      <CustomScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
      >
        <ListCard>
          {list.map(addr => {
            const date = createdDate(addr);
            return (
              <PickRow
                key={addr.accumulationAddressId}
                title={shortenAddress(addr.depositAddress)}
                titleStyle={styles.address}
                sub={
                  date
                    ? t('screens.accumulationAddresses.detail.created', {
                        date,
                      })
                    : undefined
                }
                lead={
                  <CoinChainLogo
                    asset={addr.sourceAsset}
                    chainLabel={chainLabel}
                  />
                }
                selected={addr.accumulationAddressId === selectedId}
                onPress={() => handleSelect(addr)}
                minHeight={60}
              />
            );
          })}
        </ListCard>
      </CustomScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: { flexGrow: 0 },
  address: {
    fontFamily: FONT.mono,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
});
