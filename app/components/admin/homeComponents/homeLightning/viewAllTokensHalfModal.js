import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTheme } from '../../../../../context-store/theme';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { copyToClipboard, formatBalanceAmount } from '../../../../functions';
import { useToast } from '../../../../../context-store/toastManager';
import {
  CENTER,
  FONT,
  INFINITY_SYMBOL,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';
import { middleEllipsis } from '../../../../functions/CustomElements/redesign/KeyValueRow';
import { getTokenIcon } from '../../../../functions/lrc20/utils';
import { convertToBech32m } from '../../../../functions/lrc20/bech32';
import openWebBrowser from '../../../../functions/openWebBrowser';
import { useNavigation } from '@react-navigation/native';

function DetailRow({ label, value }) {
  const { tokens } = useTheme();
  return (
    <ListRow
      title={label}
      titleStyle={{ ...styles.detail, color: tokens.muted }}
      minHeight={48}
      paddingVertical={8}
      trailing={<ThemeText content={value} styles={styles.detail} />}
    />
  );
}

export default function ViewAllTokensHalfModal({ token, setContentHeight }) {
  const { tokensImageCache } = useSparkWallet();
  const { tokens } = useTheme();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const metadata = token[1]?.tokenMetadata;
  const publicKey = metadata?.tokenPublicKey;

  return (
    <View
      style={[styles.container, { width: contentWidth }]}
      // 49 = sheet grabber (15) + bottom padding (34).
      onLayout={e =>
        setContentHeight(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <ListRow
        lead={getTokenIcon(token, 48, tokensImageCache, 15)}
        title={metadata?.tokenName}
        sub={t('wallet.homeLightning.balancePage.tokenOnSpark')}
        titleStyle={styles.name}
        subStyle={styles.sub}
        minHeight={48}
        paddingVertical={0}
      />
      <ListCard style={styles.card}>
        <DetailRow
          label={t('screens.inAccount.lrc20TokenDataHalfModal.balance')}
          value={
            masterInfoObject.userBalanceDenomination === 'hidden'
              ? '••••'
              : `${formatBalanceAmount(
                  formatTokensNumber(token[1]?.balance, metadata?.decimals),
                  true,
                  masterInfoObject,
                )} ${metadata?.tokenTicker}`
          }
        />
        <DetailRow
          label={t('screens.inAccount.lrc20TokenDataHalfModal.maxSupply')}
          value={
            !metadata?.maxSupply
              ? INFINITY_SYMBOL
              : formatBalanceAmount(
                  formatTokensNumber(metadata?.maxSupply, metadata?.decimals),
                  true,
                  masterInfoObject,
                )
          }
        />
        <DetailRow
          label={t('wallet.homeLightning.balancePage.ticker')}
          value={metadata?.tokenTicker}
        />
        <ListRow
          title={t('screens.inAccount.lrc20TokenDataHalfModal.tokenPubKey')}
          sub={middleEllipsis(publicKey, 6, 6)}
          titleStyle={{ ...styles.detail, color: tokens.muted }}
          subStyle={styles.key}
          minHeight={64}
          paddingVertical={8}
          trailing={
            <IconButton
              icon={'Copy'}
              iconSize={18}
              label={'constants.copy'}
              onPress={() => copyToClipboard(publicKey, showToast)}
            />
          }
        />
      </ListCard>
      <TextButton
        align="center"
        text={t('screens.inAccount.lrc20TokenDataHalfModal.tokenInfo')}
        onPress={() => {
          try {
            const tokenIdentifierHex = Buffer.from(
              Object.values(metadata?.rawTokenIdentifier),
            ).toString('hex');
            openWebBrowser({
              navigate,
              link: `https://sparkscan.io/token/${convertToBech32m(
                tokenIdentifierHex,
              )}`,
            });
          } catch (err) {
            console.log(err, 'error in webview');
            navigate.navigate('ErrorScreen', {
              errorMessage: t('errormessages.genericError'),
            });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...CENTER, paddingTop: 16 },
  card: { marginTop: 16, marginBottom: 8 },
  name: { fontSize: 15, lineHeight: 21 },
  sub: { fontSize: 13, lineHeight: 19, includeFontPadding: false },
  detail: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  key: {
    fontFamily: FONT.mono,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
});
