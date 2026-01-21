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
import { CENTER, COLORS } from '../../../../../constants';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../../../../../functions/CustomElements/button';
import { openComposer } from 'react-native-email-link';
import { copyToClipboard } from '../../../../../functions';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { useKeysContext } from '../../../../../../context-store/keys';

import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function HistoricalGiftCardPurchases() {
  const { decodedGiftCards, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        navigate.navigate('GiftCardOrderDetails', {
          item: item,
        });
      }}
      style={styles.rowContainer}
    >
      <Image style={styles.companyLogo} source={{ uri: item.logo }} />
      <View style={{ flex: 1 }}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{ fontWeight: '500', marginBottom: 5 }}
          content={item.name}
        />
        <ThemeText
          CustomNumberOfLines={1}
          content={`${t(
            'apps.giftCards.historicalPurchasesPage.purchased',
          )} ${new Date(item.date).toDateString()}`}
        />
      </View>
      <TouchableOpacity
        onPress={() =>
          navigate.navigate('ConfirmActionPage', {
            confirmMessage: t(
              'apps.giftCards.historicalPurchasesPage.confirmRemoval',
            ),
            confirmFunction: () => removeGiftCardFromList(item.uuid),
          })
        }
      >
        <ThemeIcon iconName={'X'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <GlobalThemeView styles={styles.globalContainer} useStandardWidth={true}>
      <CustomSettingsTopBar containerStyles={styles.topBar} />

      {!decodedGiftCards.purchasedCards ||
      decodedGiftCards?.purchasedCards?.length === 0 ? (
        <View style={styles.noPurchaseContainer}>
          <ThemeText
            styles={styles.noPurchaseText}
            content={t('apps.giftCards.historicalPurchasesPage.noPurchases')}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={decodedGiftCards.purchasedCards}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()} // Assuming each gift card has a unique 'id'
            style={{ width: '90%' }}
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
                  showToast,
                  null,
                  t('apps.giftCards.historicalPurchasesPage.customCopyMessage'),
                );
              }
            }}
            textContent={t('constants.support')}
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
    toggleGlobalAppDataInformation({ giftCards: em }, true);
  }
}

const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0, alignItems: 'center' },
  topBar: {
    marginBottom: 0,
  },
  rowContainer: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: COLORS.gray2,
    alignItems: 'center',
  },
  noPurchaseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  noPurchaseText: {
    textAlign: 'center',
    width: INSET_WINDOW_WIDTH,
  },
  companyLogo: { width: 55, height: 55, marginRight: 10, borderRadius: 10 },
  supportBTN: { width: 'auto', ...CENTER, position: 'absolute' },
});
