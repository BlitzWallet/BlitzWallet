import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow, {
  RowShell,
} from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import AnimatedStep from '../../../../functions/CustomElements/redesign/AnimatedStep';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {
  ACCUMULATION_BTC_SOURCES,
  ACCUMULATION_CHAINS,
} from '../../../../constants/accumulationAddresses';
import { SheetTitle } from '../savings/savingsSheetParts';
import { AssetLogo, QrBadge } from './receiveParts';

// Receive Bitcoin / Receive Dollars sheet (Receive.dc.html "Bitcoin tapped",
// "Dollars tapped", "Other networks"). Other networks is a second step in
// the same sheet; both steps share one height so the slide never runs while
// the sheet resizes.

// Networks shown first on the chain pills and network lists.
const CHAIN_ORDER = ['tron', 'base', 'ethereum', 'solana'];
export function chainsForAsset(asset) {
  const rank = id =>
    CHAIN_ORDER.includes(id) ? CHAIN_ORDER.indexOf(id) : CHAIN_ORDER.length;
  return ACCUMULATION_CHAINS.filter(chain => chain.assets.includes(asset)).sort(
    (a, b) => rank(a.id) - rank(b.id),
  );
}

// Coinbase BTC (Base) before Solana BTC, as drawn.
const BTC_SOURCES = [...ACCUMULATION_BTC_SOURCES].sort((a, b) =>
  a.chain.localeCompare(b.chain),
);

const SHEET_HEIGHT = { bitcoin: 400, dollars: 370 };

export default function ReceiveAssetSheet({
  asset,
  setContentHeight,
  handleBackPressFunction,
  isHalfModal = false,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [step, setStep] = useState('options');
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    setContentHeight(SHEET_HEIGHT[asset]);
  }, [asset, setContentHeight]);

  const goTo = useCallback(next => {
    setDirection(next === 'networks' ? 1 : -1);
    setStep(next);
  }, []);

  useHandleBackPressNew(
    useCallback(() => {
      if (step !== 'networks') return false;
      goTo('options');
      return true;
    }, [step, goTo]),
  );

  // Close the sheet and open the next screen. As a CustomHalfModal it is its
  // own route, so the next screen replaces it; docked it lives in the Receive
  // page, which stays underneath.
  const open = (name, params) =>
    handleBackPressFunction(() =>
      isHalfModal
        ? navigate.replace(name, params)
        : navigate.navigate(name, params),
    );

  const createInvoice = () =>
    open('EditReceivePaymentInformation', {
      from: 'homepage',
      receiveType: 'Lightning',
      endReceiveType: asset === 'dollars' ? 'USD' : 'BTC',
      userReceiveAmount: 0,
    });

  const invoiceRow = (
    <PillRow
      lead={<QrBadge kind="lightning" size={36} />}
      title={t('receive.createInvoice')}
      pills={[t('receive.lightning')]}
      onPress={createInvoice}
    />
  );

  return (
    <View style={styles.container}>
      <AnimatedStep active={step === 'options'} direction={direction}>
        <View style={styles.page}>
          <SheetTitle
            first
            title={t(
              asset === 'dollars'
                ? 'receive.receiveDollars'
                : 'receive.receiveBitcoin',
            )}
          />
          <ListCard style={styles.card}>
            {invoiceRow}
            {asset === 'dollars'
              ? ['USDT', 'USDC'].map(coin => (
                  <StablecoinRow
                    key={coin}
                    coin={coin}
                    onPress={() =>
                      open('ReceiveStablecoinNetworks', { asset: coin })
                    }
                  />
                ))
              : [
                  <PillRow
                    key="address"
                    lead={<QrBadge kind="bitcoin" size={36} />}
                    title={t('receive.bitcoinAddress')}
                    pills={[t('receive.onChain')]}
                    onPress={() =>
                      open('ReceiveAddressPage', {
                        selectedRecieveOption: 'Bitcoin',
                      })
                    }
                  />,
                  <ListRow
                    key="networks"
                    lead={<Disc icon="Ellipsis" />}
                    title={t('receive.otherNetworks')}
                    sub={BTC_SOURCES.map(source =>
                      t(`receive.btcSource_${source.chain}`),
                    ).join(' · ')}
                    onPress={() => goTo('networks')}
                    showChevron
                  />,
                ]}
          </ListCard>
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={step === 'networks'}
        direction={direction}
        exitsBack
      >
        <View style={styles.page}>
          <IconButton
            icon="ArrowLeft"
            label="constants.back"
            tone="disc"
            onPress={() => goTo('options')}
          />
          <SheetTitle
            title={t('receive.otherNetworks')}
            sub={t('receive.otherNetworksSub')}
          />
          <ListCard style={styles.card}>
            {BTC_SOURCES.map(source => {
              const chain = ACCUMULATION_CHAINS.find(
                c => c.id === source.chain,
              );
              return (
                <ListRow
                  key={source.chain}
                  lead={<QrBadge kind="bitcoin" size={36} />}
                  title={t(`receive.btcSource_${source.chain}`)}
                  sub={source.asset}
                  trailing={<ChainPill label={chain?.label} />}
                  onPress={() =>
                    open('ReceiveAddressPage', {
                      selectedRecieveOption: 'Stablecoins',
                      sourceChain: source.chain,
                      sourceAsset: source.asset,
                      destinationAsset: 'BTC',
                    })
                  }
                />
              );
            })}
          </ListCard>
        </View>
      </AnimatedStep>
    </View>
  );
}

// USDT · [Tron] [Ethereum] [Solana] +5
function StablecoinRow({ coin, onPress }) {
  const chains = chainsForAsset(coin);
  return (
    <PillRow
      lead={<AssetLogo asset={coin} />}
      title={coin}
      accessibilityLabel={coin}
      pills={chains.slice(0, 3).map(chain => chain.label)}
      more={chains.length > 3 ? `+${chains.length - 3}` : undefined}
      onPress={onPress}
    />
  );
}

// Row with chain/type pills under the title, e.g. Create invoice · [Lightning].
function PillRow({ lead, title, pills = [], more, onPress, accessibilityLabel }) {
  const { tokens } = useTheme();
  return (
    <RowShell
      onPress={onPress}
      lead={lead}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      trailing={
        <ThemeIcon
          redesign
          iconName="ChevronRight"
          size={20}
          colorOverride={tokens.muted}
        />
      }
    >
      <View style={styles.rowTexts}>
        <ThemeText styles={styles.rowTitle} content={title} />
        <View style={styles.pills}>
          {pills.map(label => (
            <ChainPill key={label} label={label} />
          ))}
          {!!more && (
            <ThemeText
              styles={[styles.more, { color: tokens.muted }]}
              content={more}
            />
          )}
        </View>
      </View>
    </RowShell>
  );
}

function ChainPill({ label }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: tokens.surface }]}>
      <ThemeText
        styles={[styles.pillText, { color: tokens.muted }]}
        content={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  page: { flex: 1, paddingHorizontal: 20 },
  card: { marginTop: 16 },
  rowTexts: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 17, lineHeight: 24, includeFontPadding: false },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 12, lineHeight: 17, includeFontPadding: false },
  more: { fontSize: 12, lineHeight: 17, includeFontPadding: false },
});
