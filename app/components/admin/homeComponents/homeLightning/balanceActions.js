import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../../../context-store/appStatus';
import useGuardedNavigation from '../../../../hooks/useGuardedNavigation';
import CustomButton from '../../../../functions/CustomElements/button';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';

// Send · Receive · Swap row for Home and the balance pages. `receiveOnlyLabel`
// swaps the row for one Receive pill (a balance of zero has nothing to send).
export default function BalanceActions({
  showSwap = true,
  receiveOnlyLabel,
  receiveRoute = 'ReceiveHomeRedesign',
  receiveParams,
  swapParams,
}) {
  const navigateGuarded = useGuardedNavigation();
  const { isConnectedToTheInternet } = useAppStatus();
  const { t } = useTranslation();

  const go = (route, params) => {
    if (!isConnectedToTheInternet) {
      navigateGuarded('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigateGuarded(route, params);
  };
  const handleSend = () =>
    go('CustomHalfModal', {
      wantedContent: 'sendOptions',
      sliderHight: 0.8,
    });
  const handleReceive = () => go(receiveRoute, receiveParams);
  const handleSwap = () =>
    go('CustomHalfModal', {
      wantedContent: 'swapFlow',
      sliderHight: 0.55,
      ...swapParams,
    });

  if (receiveOnlyLabel) {
    return (
      <CustomButton
        actionFunction={handleReceive}
        textContent={receiveOnlyLabel}
        size={'regular'}
      />
    );
  }

  return (
    <View style={styles.row}>
      <CustomButton
        actionFunction={handleSend}
        textContent={t('constants.send')}
        size={'fill'}
      />
      <CustomButton
        actionFunction={handleReceive}
        textContent={t('constants.receive')}
        size={'fill'}
        tone={'secondary'}
      />
      {showSwap && (
        <IconButton
          onPress={handleSwap}
          size={52}
          iconSize={20}
          icon={'ArrowRightLeft'}
          label={'constants.swap'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
});
