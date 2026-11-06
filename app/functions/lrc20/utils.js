import { StyleSheet, View } from 'react-native';
import ContactAvatar from '../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';
import GetThemeColors from '../../hooks/themeColors';
import { USDB_TOKEN_ID } from '../../constants';

// [identifier, tokenInfo] entries; USDB is the Dollars balance, not a token.
export function getWalletTokens(tokens) {
  return Object.entries(tokens || {}).filter(([id]) => id !== USDB_TOKEN_ID);
}

export function TokensIconRow({ tokens, tokensImageCache }) {
  const { tokens: colorTokens } = GetThemeColors();
  const allTokens = getWalletTokens(tokens);
  if (!allTokens.length) return null;

  const icons = allTokens.slice(0, 2).map((item, index) => (
    <View
      key={item[0]}
      style={
        index > 0 && [
          styles.overlap,
          {
            backgroundColor: colorTokens.surface,
            borderColor: colorTokens.surface,
          },
        ]
      }
    >
      {getTokenIcon(item, 36, tokensImageCache, 12)}
    </View>
  ));

  return <View style={styles.tokensRow}>{icons}</View>;
}

export function getTokenIcon(token, size, tokensImageCache, fontSize) {
  return (
    <ContactAvatar
      name={token[1]?.tokenMetadata?.tokenName}
      seed={token[0]}
      uri={tokensImageCache[token[0]]}
      size={size}
      fontSize={fontSize}
    />
  );
}

const styles = StyleSheet.create({
  tokensRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlap: {
    marginLeft: -16,
    borderWidth: 2,
    borderRadius: 999,
  },
});

export function TokensNameRow(tokens, t) {
  const names = getWalletTokens(tokens).map(
    ([, item]) => item.tokenMetadata.tokenName,
  );
  if (!names.length) return '';
  const [first, second] = names;
  const prefix = 'wallet.homeLightning.home';
  if (names.length === 1) return t(`${prefix}.tokensOne`, { first });
  if (names.length === 2) return t(`${prefix}.tokensTwo`, { first, second });
  return t(`${prefix}.tokensMore`, {
    first,
    second,
    count: names.length - 2,
  });
}
