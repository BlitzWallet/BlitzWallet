import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { ThemeText } from '../../../../functions/CustomElements';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import { getTokenIcon } from '../../../../functions/lrc20/utils';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import formatBalanceAmount from '../../../../functions/formatNumber';

// `token` is an [identifier, tokenInfo] entry of sparkInformation.tokens.
export default function TokenRow({ token }) {
  const navigate = useNavigation();
  const { tokensImageCache } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const metadata = token[1]?.tokenMetadata;
  return (
    <ListRow
      onPress={() =>
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'ViewAllTokensHalfModal',
          token,
        })
      }
      lead={getTokenIcon(token, 40, tokensImageCache, 13)}
      title={metadata?.tokenName}
      sub={metadata?.tokenTicker}
      titleStyle={styles.title}
      subStyle={styles.sub}
      minHeight={64}
      paddingVertical={10}
      chevronSize={18}
      showChevron
      trailing={
        <ThemeText
          styles={styles.amount}
          content={
            masterInfoObject.userBalanceDenomination === 'hidden'
              ? '••••'
              : formatBalanceAmount(
                  formatTokensNumber(token[1]?.balance, metadata?.decimals),
                  true,
                  masterInfoObject,
                )
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, lineHeight: 21 },
  sub: { fontSize: 13, lineHeight: 19, includeFontPadding: false },
  amount: {
    fontSize: 17,
    letterSpacing: -0.17,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
