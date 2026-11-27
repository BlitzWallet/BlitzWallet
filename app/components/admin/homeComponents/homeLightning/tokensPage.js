import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH, TYPE } from '../../../../constants';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useTheme } from '../../../../../context-store/theme';
import { getWalletTokens } from '../../../../functions/lrc20/utils';
import BalanceActions from './balanceActions';
import ActivityCard from './activityCard';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import TokenRow from './tokenRow';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';

const TOKENS_SHOWN = 4;

export default function TokensPage() {
  const { sparkInformation } = useSparkWallet();
  const { tokens: colorTokens } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const tokens = getWalletTokens(sparkInformation.tokens);
  const viewAllLabel = t('wallet.homeLightning.balancePage.viewAllTokens', {
    count: tokens.length,
  });

  return (
    <GlobalThemeView edgeToEdge useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar fade title={t('constants.tokens')} />
        <CustomScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
        >
          <ThemeText
            content={t('wallet.homeLightning.balancePage.balances')}
            variant={'hint'}
            styles={styles.label}
          />
          {/* Row dividers are inset; the one above View all spans the card. */}
          <ListCard style={styles.card}>
            <ListCard dividerInset={68} style={styles.rows}>
              {tokens.slice(0, TOKENS_SHOWN).map(token => (
                <TokenRow key={token[0]} token={token} />
              ))}
            </ListCard>
            {tokens.length > TOKENS_SHOWN && (
              <TouchableOpacity
                style={styles.viewAll}
                onPress={() => navigate.navigate('AllTokensPage')}
                accessibilityRole="button"
                accessibilityLabel={viewAllLabel}
              >
                <ThemeText content={viewAllLabel} styles={styles.viewAllText} />
                <ThemeIcon
                  redesign
                  iconName="ChevronRight"
                  size={16}
                  colorOverride={colorTokens.ink}
                />
              </TouchableOpacity>
            )}
          </ListCard>
          <View style={styles.buttons}>
            <BalanceActions
              showSwap={false}
              receiveRoute={'ReceiveAddressPage'}
              receiveParams={{
                selectedRecieveOption: 'spark',
                fromTokens: true,
              }}
            />
          </View>
          <ActivityCard
            scrollPosition={'tokens'}
            emptyText={t('wallet.homeLightning.balancePage.emptyTokens')}
            style={styles.activity}
          />
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingTop: FADE_TOP },
  label: { marginTop: 16, ...TYPE.label, marginBottom: 8 },
  card: { paddingVertical: 4 },
  rows: { paddingHorizontal: 0 },
  viewAll: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  viewAllText: { ...TYPE.body, includeFontPadding: false },
  buttons: { marginTop: 24 },
  activity: { marginTop: 36 },
});
