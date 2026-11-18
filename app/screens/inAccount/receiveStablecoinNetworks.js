import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import { ThemeText } from '../../functions/CustomElements';
import { useTheme } from '../../../context-store/theme';
import { ChainLogo } from '../../components/admin/homeComponents/receiveBitcoin/receiveParts';
import { chainsForAsset } from '../../components/admin/homeComponents/receiveBitcoin/ReceiveAssetSheet';

// Receive USDT / USDC: pick a network (ReceiveMore.dc.html). A network goes
// straight to its address, no amount needed.
export default function ReceiveStablecoinNetworks(props) {
  const { asset } = props.route.params;
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <GlobalThemeView useStandardWidth={false}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('receive.receiveAsset', { asset })} />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <ThemeText
            styles={[styles.sub, { color: tokens.muted }]}
            content={t('receive.pickNetworkSub')}
          />
          <ListCard>
            {chainsForAsset(asset).map(chain => (
              <ListRow
                key={chain.id}
                lead={<ChainLogo chain={chain} />}
                title={chain.label}
                showChevron
                onPress={() =>
                  navigate.navigate('ReceiveAddressPage', {
                    selectedRecieveOption: 'Stablecoins',
                    sourceChain: chain.id,
                    sourceAsset: asset,
                    destinationAsset: 'USDB',
                  })
                }
              />
            ))}
          </ListCard>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scroll: { paddingTop: 20, paddingBottom: 20 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 12, marginHorizontal: 4 },
});
