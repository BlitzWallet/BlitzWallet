import {
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {CENTER, COLORS, ICONS} from '../../../../../constants';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {useNavigation} from '@react-navigation/native';
import CustomButton from '../../../../../functions/CustomElements/button';
import {openComposer} from 'react-native-email-link';
import {copyToClipboard} from '../../../../../functions';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useKeysContext} from '../../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';

export default function HistoricalGiftCardPurchases() {
  const {decodedGiftCards, toggleGlobalAppDataInformation} = useGlobalAppData();
  const {contactsPrivateKey, publicKey} = useKeysContext();

  const navigate = useNavigation();
  const {bottomPadding} = useGlobalInsets();

  useHandleBackPressNew();

  const renderItem = ({item}) => (
    <TouchableOpacity
      onLongPress={() => {
        navigate.navigate('ConfirmActionPage', {
          confirmMessage:
            'Are you sure you want to remove this purchased card.',
          confirmFunction: () => removeGiftCardFromList(item.uuid),
        });
      }}
      onPress={() => {
        navigate.navigate('GiftCardOrderDetails', {
          item: item,
        });
      }}
      style={styles.rowContainer}>
      <Image style={styles.companyLogo} source={{uri: item.logo}} />
      <View>
        <ThemeText
          styles={{fontWeight: '500', marginBottom: 5}}
          content={item.name}
        />
        <ThemeText
          styles={{
            marginLeft: 'auto',
          }}
          content={`Purchased: ${new Date(item.date).toDateString()}`}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <GlobalThemeView
      styles={{paddingBottom: 0, alignItems: 'center'}}
      useStandardWidth={true}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={navigate.goBack}
          style={{marginRight: 'auto'}}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
      </View>

      {!decodedGiftCards.purchasedCards ||
      decodedGiftCards?.purchasedCards?.length === 0 ? (
        <View style={{alignItems: 'center', justifyContent: 'center', flex: 1}}>
          <ThemeText content={'You have not purchased any cards'} />
        </View>
      ) : (
        <>
          <FlatList
            data={decodedGiftCards.purchasedCards}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()} // Assuming each gift card has a unique 'id'
            style={{width: '90%'}}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <View
                style={{
                  height: bottomPadding + 60,
                }}
              />
            }
          />
          <CustomButton
            buttonStyles={{
              ...styles.supportBTN,
              bottom: bottomPadding,
            }}
            actionFunction={async () => {
              try {
                await openComposer({
                  to: 'support@thebitcoincompany.com',
                  subject: 'Gift cards payment error',
                });
              } catch (err) {
                copyToClipboard(
                  'support@thebitcoincompany.com',
                  navigate,
                  null,
                  'Support email copied',
                );
              }
            }}
            textContent={'Support'}
          />
        </>
      )}
    </GlobalThemeView>
  );

  function removeGiftCardFromList(selectedCardId) {
    const newCardsList = decodedGiftCards?.purchasedCards.filter(
      card => card.uuid !== selectedCardId,
    );

    const em = encriptMessage(
      contactsPrivateKey,
      publicKey,
      JSON.stringify({
        ...decodedGiftCards,
        purchasedCards: newCardsList,
      }),
    );
    toggleGlobalAppDataInformation({giftCards: em}, true);
  }
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },
  rowContainer: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: COLORS.gray2,
    alignItems: 'center',
  },

  companyLogo: {width: 55, height: 55, marginRight: 10, borderRadius: 10},
  supportBTN: {width: 'auto', ...CENTER, position: 'absolute'},
});
