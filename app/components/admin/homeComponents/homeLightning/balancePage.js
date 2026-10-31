import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import { useTranslation } from 'react-i18next';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { getAssetBalanceText } from './balanceCard';
import BalanceActions from './balanceActions';
import ActivityCard from './activityCard';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';

export default function BalancePage(props) {
  const { asset } = props?.route?.params;
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const isBitcoin = asset === 'bitcoin';
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const balance = isBitcoin ? bitcoinBalance : dollarBalanceToken;
  // Under a cent reads $0.00: nothing to send.
  const isEmpty = isBitcoin ? !balance : balance < 0.01;

  return (
    <GlobalThemeView styles={styles.page} useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t(`constants.${isBitcoin ? 'bitcoin' : 'dollars'}_upper`)}
        />
        <CustomScrollView showsVerticalScrollIndicator={false}>
          <ThemeText
            content={t('constants.balance')}
            variant={'hint'}
            styles={styles.label}
          />
          <View style={styles.hero}>
            <AmountHero
              formatAmount={false}
              amount={getAssetBalanceText({
                isBitcoin,
                amount: balance,
                masterInfoObject,
                fiatStats,
              })}
              amountSize={60}
              isHidden={masterInfoObject.userBalanceDenomination === 'hidden'}
            />
          </View>
          <View style={styles.buttons}>
            <BalanceActions
              receiveOnlyLabel={
                isEmpty
                  ? t(
                      `wallet.homeLightning.balancePage.${
                        isBitcoin ? 'receiveBitcoin' : 'receiveDollars'
                      }`,
                    )
                  : undefined
              }
              receiveRoute={'CustomHalfModal'}
              receiveParams={{ wantedContent: 'receiveAsset', asset }}
              swapParams={{ fromAsset: isBitcoin ? 'BTC' : 'USD' }}
            />
          </View>
          <ActivityCard
            scrollPosition={isBitcoin ? 'sats' : 'usd'}
            emptyText={t(
              `wallet.homeLightning.balancePage.${
                isBitcoin ? 'emptyBitcoin' : 'emptyDollars'
              }`,
            )}
            style={[styles.activity, { marginBottom: bottomPadding + 20 }]}
          />
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER, paddingTop: 7 },
  hero: { alignItems: 'flex-start', minHeight: 84, justifyContent: 'center' },
  label: { marginTop: 56, fontSize: 14 },
  buttons: { marginTop: 24 },
  activity: { marginTop: 36 },
});
