import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CurrencyIcon from '../../../../../functions/CustomElements/redesign/CurrencyIcon';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';

export default function SelectContactRequestCurrency({
  selectedRecieveOption,
  handleBackPressFunction,
  setContentHeight,
  fromPage,
  onSelectMethod,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();

  const selectSendingBalance = term => {
    const selected = term || selectedRecieveOption;
    if (onSelectMethod) {
      onSelectMethod(selected);
      handleBackPressFunction();
      return;
    }
    handleBackPressFunction(() =>
      navigate.popTo(
        fromPage || 'SendAndRequestPage',
        {
          selectedRequestMethod: selected,
        },
        { merge: true },
      ),
    );
  };

  return (
    <View style={styles.innerContainer}>
      <SheetHeader first title={t('contacts.selectCurrencyToRequest.header')} />
      <ListCard>
        <PickRow
          lead={<CurrencyIcon size={48} isBitcoin />}
          onPress={() => selectSendingBalance('BTC')}
          title={t('constants.bitcoin_upper')}
          selected={selectedRecieveOption === 'BTC'}
          minHeight={76}
        />
        <PickRow
          lead={<CurrencyIcon size={48} />}
          onPress={() => selectSendingBalance('USD')}
          title={t('constants.dollars_upper')}
          selected={selectedRecieveOption === 'USD'}
          minHeight={76}
        />
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
  },
});
