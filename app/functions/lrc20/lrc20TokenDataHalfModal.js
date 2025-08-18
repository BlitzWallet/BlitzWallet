import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useSparkWallet} from '../../../context-store/sparkContext';
import {ThemeText} from '../CustomElements';
import {CENTER, SIZES, TOKEN_TICKER_MAX_LENGTH} from '../../constants';
import {useRef} from 'react';
import {COLORS, INSET_WINDOW_WIDTH} from '../../constants/theme';
import formatBalanceAmount from '../formatNumber';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalInsets} from '../../../context-store/insetsProvider';
import {useToast} from '../../../context-store/toastManager';
import copyToClipboard from '../copyToClipboard';
import formatTokensNumber from './formatTokensBalance';
import {useTranslation} from 'react-i18next';

export default function LRC20TokenInformation({
  theme,
  darkModeType,
  slideHeight,
  tokenIdentifier,
  setContentHeight,
}) {
  const {showToast} = useToast();
  const {sparkInformation} = useSparkWallet();
  const selectedToken = sparkInformation.tokens?.[tokenIdentifier];
  const {balance, tokenMetadata} = selectedToken;
  console.log(selectedToken);
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const initialValue = useRef(null);
  const {topPadding} = useGlobalInsets();
  const {t} = useTranslation();

  return (
    <View
      onLayout={e => {
        if (!initialValue.current) {
          initialValue.current = e.nativeEvent.layout.height;
          setContentHeight(e.nativeEvent.layout.height + 80);
        }
      }}
      style={{...styles.container, paddingBottom: topPadding}}>
      <ThemeText
        CustomNumberOfLines={1}
        styles={styles.titleText}
        content={tokenMetadata.tokenName?.toUpperCase()}
      />

      <View
        style={{
          ...styles.innerContainer,
          backgroundColor: theme
            ? darkModeType
              ? backgroundColor
              : backgroundOffset
            : COLORS.darkModeText,
        }}>
        <View
          style={{
            ...styles.itemRow,
            borderBottomColor: theme
              ? darkModeType
                ? backgroundOffset
                : backgroundColor
              : backgroundColor,
          }}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItemDescription}
            content={t('screens.inAccount.lrc20TokenDataHalfModal.balance')}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItem}
            content={formatBalanceAmount(
              formatTokensNumber(balance, tokenMetadata?.decimals),
              true,
            )}
          />
        </View>
        <View
          style={{
            ...styles.itemRow,
            borderBottomColor: theme
              ? darkModeType
                ? backgroundOffset
                : backgroundColor
              : backgroundColor,
          }}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItemDescription}
            content={t('screens.inAccount.lrc20TokenDataHalfModal.maxSupply')}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItem}
            content={formatBalanceAmount(
              formatTokensNumber(
                tokenMetadata.maxSupply,
                tokenMetadata?.decimals,
              ),
              true,
            )}
          />
        </View>
        <View
          style={{
            ...styles.itemRow,
            borderBottomColor: theme
              ? darkModeType
                ? backgroundOffset
                : backgroundColor
              : backgroundColor,
          }}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItemDescription}
            content={t('screens.inAccount.lrc20TokenDataHalfModal.tokenTicker')}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItem}
            content={tokenMetadata.tokenTicker
              ?.toUpperCase()
              .slice(0, TOKEN_TICKER_MAX_LENGTH)}
          />
        </View>
        <View
          style={{
            ...styles.itemRow,
            borderBottomWidth: 0,
          }}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textItemDescription}
            content={t('screens.inAccount.lrc20TokenDataHalfModal.tokenPubKey')}
          />
          <TouchableOpacity
            onPress={() => {
              copyToClipboard(tokenMetadata.tokenPublicKey, showToast);
            }}
            style={styles.textItem}>
            <ThemeText
              CustomNumberOfLines={1}
              content={tokenMetadata.tokenPublicKey}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  innerContainer: {
    width: '85%',
    ...CENTER,

    borderRadius: 8,
  },
  itemRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 12,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,

    borderBottomWidth: 1,
  },
  titleText: {
    width: INSET_WINDOW_WIDTH,
    fontSize: SIZES.large,
    marginBottom: 10,
    textAlign: 'center',
  },
  textItemDescription: {
    includeFontPadding: false,
    flex: 1,
    marginRight: 5,
  },
  textItem: {
    includeFontPadding: false,
    flexShrink: 1,
    maxWidth: '50%',
  },
});
