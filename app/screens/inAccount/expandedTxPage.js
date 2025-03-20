import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import {CENTER, COLORS, FONT, ICONS, SIZES} from '../../constants';
import {useNavigation} from '@react-navigation/native';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import {WINDOWWIDTH} from '../../constants/theme';
import Icon from '../../functions/CustomElements/Icon';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../functions/CustomElements/button';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {PaymentState} from '@breeztech/react-native-breez-sdk-liquid';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';

export default function ExpandedTx(props) {
  console.log('Transaction Detials Page');

  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  const transaction = props.route.params.transaction;
  const usesLightningNode = transaction?.usesLightningNode;
  const usesLiquidNode = transaction?.usesLiquidNode;
  const usesEcash = transaction?.usesEcash;

  const isFailedPayment =
    props.route.params.isFailedPayment && transaction?.type != 'ecash';

  const isPending =
    transaction.status === PaymentState.PENDING && !isFailedPayment;

  const selectedTX = transaction;

  const paymentDate = new Date(
    usesLiquidNode
      ? selectedTX.timestamp * 1000
      : usesEcash
      ? selectedTX.time
      : selectedTX.paymentTime * 1000,
  );
  const liquidDescription =
    selectedTX?.details?.lnurlInfo?.lnurlPayComment ||
    selectedTX?.details?.description;
  const lightningDescription =
    (transaction?.details?.data?.lnAddress &&
      transaction?.details?.data?.label) ||
    transaction?.description;
  const description = isFailedPayment
    ? transaction?.error
    : usesLiquidNode
    ? liquidDescription
    : usesLightningNode
    ? lightningDescription
    : usesEcash
    ? transaction?.description
    : null;

  console.log(selectedTX);
  const month = paymentDate.toLocaleString('default', {month: 'short'});
  const day = paymentDate.getDate();
  const year = paymentDate.getFullYear();
  useHandleBackPressNew();

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <View style={{flex: 1}}>
        <TouchableOpacity
          style={{marginRight: 'auto'}}
          onPress={() => {
            navigate.goBack();
          }}>
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={{
            // flex: 1,
            width: '95%',
            alignItems: 'center',
            justifyContent: 'center',
            // backgroundColor: 'red',
            ...CENTER,
          }}>
          <View
            style={{
              // flex: 1,
              width: '100%',
              height: 'auto',
              backgroundColor: theme ? backgroundOffset : COLORS.white,
              borderTopRightRadius: 20,
              borderTopLeftRadius: 20,
              // // overflow: 'visible',
              padding: 15,
              paddingTop: 40,
              ...CENTER,
              alignItems: 'center',
              marginTop: 80,
              marginBottom: 20,
            }}>
            <View
              style={{
                width: 100,
                height: 100,
                position: 'absolute',
                backgroundColor: backgroundColor,
                top: -70,
                borderRadius: 50,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: isPending
                    ? theme
                      ? COLORS.expandedTxDarkModePendingOuter
                      : COLORS.expandedTXLightModePendingOuter
                    : isFailedPayment
                    ? theme && darkModeType
                      ? COLORS.lightsOutBackgroundOffset
                      : COLORS.expandedTXLightModeFailed
                    : theme
                    ? COLORS.expandedTXDarkModeConfirmd
                    : COLORS.expandedTXLightModeConfirmd,
                  alignItems: 'center',
                  justifyContent: 'center',

                  borderRadius: 40,
                }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    backgroundColor: isPending
                      ? theme
                        ? COLORS.expandedTxDarkModePendingInner
                        : COLORS.expandedTXLightModePendingInner
                      : isFailedPayment
                      ? theme && darkModeType
                        ? COLORS.white
                        : COLORS.cancelRed
                      : theme
                      ? COLORS.darkModeText
                      : COLORS.primary,

                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon
                    width={isPending ? 40 : 25}
                    height={isPending ? 40 : 25}
                    color={
                      isPending
                        ? theme
                          ? COLORS.darkModeText
                          : backgroundColor
                        : backgroundColor
                    }
                    name={
                      isPending
                        ? 'pendingTxIcon'
                        : isFailedPayment
                        ? 'expandedTxClose'
                        : 'expandedTxCheck'
                    }
                  />
                </View>
              </View>
            </View>
            <ThemeText
              styles={{
                marginTop: 10,
                fontWeight: 'light',
                includeFontPadding: false,
              }}
              content={`${
                isFailedPayment
                  ? 'Sent'
                  : usesLiquidNode
                  ? transaction.details.paymentType === 'receive'
                    ? 'Received'
                    : 'Sent'
                  : selectedTX.paymentType === 'sent'
                  ? 'Sent'
                  : 'Received'
              } amount`}
            />
            <FormattedSatText
              containerStyles={{marginTop: -5}}
              neverHideBalance={true}
              styles={{
                fontSize: SIZES.xxLarge,
                includeFontPadding: false,
              }}
              balance={
                isFailedPayment
                  ? 1000 || transaction.invoice.amountMsat / 1000
                  : usesLiquidNode
                  ? selectedTX.amountSat
                  : usesEcash
                  ? selectedTX.amount
                  : transaction.amountMsat / 1000
              }
            />
            <View
              style={{
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexDirection: 'row',
                marginTop: 30,
                marginBottom: 10,
              }}>
              <ThemeText content={'Payment status'} />
              <View
                style={{
                  backgroundColor: isPending
                    ? theme
                      ? COLORS.expandedTxDarkModePendingInner
                      : COLORS.expandedTXLightModePendingOuter
                    : isFailedPayment
                    ? theme && darkModeType
                      ? COLORS.lightsOutBackground
                      : COLORS.expandedTXLightModeFailed
                    : theme
                    ? COLORS.expandedTXDarkModeConfirmd
                    : COLORS.expandedTXLightModeConfirmd,
                  paddingVertical: 2,
                  paddingHorizontal: 25,
                  borderRadius: 20,
                }}>
                <ThemeText
                  styles={{
                    color: isPending
                      ? theme
                        ? COLORS.darkModeText
                        : COLORS.expandedTXLightModePendingInner
                      : isFailedPayment
                      ? theme && darkModeType
                        ? COLORS.white
                        : COLORS.cancelRed
                      : theme
                      ? COLORS.darkModeText
                      : COLORS.primary,
                    includeFontPadding: false,
                  }}
                  content={
                    isPending
                      ? 'Pending'
                      : isFailedPayment
                      ? 'Failed'
                      : 'Successful'
                  }
                />
              </View>
            </View>
            <Border />
            <View style={styles.infoLine}>
              <ThemeText content={'Date'} />
              <ThemeText
                styles={{fontSize: SIZES.large}}
                content={`${month} ${day} ${year}`}
              />
            </View>
            <View style={styles.infoLine}>
              <ThemeText content={'Time'} />
              <ThemeText
                content={`${
                  paymentDate.getHours() <= 9
                    ? '0' + paymentDate.getHours()
                    : paymentDate.getHours()
                }:${
                  paymentDate.getMinutes() <= 9
                    ? '0' + paymentDate.getMinutes()
                    : paymentDate.getMinutes()
                }`}
                styles={{fontSize: SIZES.large}}
              />
            </View>
            <View style={styles.infoLine}>
              <ThemeText content={'Fee'} />
              <FormattedSatText
                neverHideBalance={true}
                styles={{fontSize: SIZES.large}}
                balance={
                  isFailedPayment
                    ? 0
                    : usesLiquidNode
                    ? selectedTX.feesSat
                    : usesEcash
                    ? selectedTX.fee
                    : !!transaction?.details?.data?.reverseSwapInfo
                        ?.onchainAmountSat
                    ? selectedTX.feeMsat / 1000 +
                      (transaction.amountMsat / 1000 -
                        transaction?.details?.data?.reverseSwapInfo
                          ?.onchainAmountSat)
                    : selectedTX.feeMsat / 1000
                }
              />
            </View>
            <View style={styles.infoLine}>
              <ThemeText content={'Type'} />
              <ThemeText
                content={
                  selectedTX?.paymentType === 'closed_channel'
                    ? 'On-chain'
                    : usesLiquidNode
                    ? selectedTX.details.type.slice(0, 1).toUpperCase() +
                      selectedTX.details.type.slice(1)
                    : selectedTX.type === 'ecash'
                    ? 'eCash'
                    : !!transaction?.details?.data?.reverseSwapInfo
                    ? 'Bitcon'
                    : `Lightning`
                }
                styles={{fontSize: SIZES.large}}
              />
            </View>

            {description && (
              <View style={styles.descriptionContainer}>
                <ThemeText
                  content={'Memo'}
                  styles={{...styles.descriptionHeader}}
                />

                <View
                  style={[
                    styles.descriptionContentContainer,
                    {
                      backgroundColor: backgroundColor,
                    },
                  ]}>
                  <ScrollView
                    horizontal={false}
                    showsVerticalScrollIndicator={false}>
                    <ThemeText
                      content={String(description)}
                      styles={{...styles.buttonText}}
                    />
                  </ScrollView>
                </View>
              </View>
            )}

            <CustomButton
              buttonStyles={{
                width: 'auto',
                ...CENTER,
                backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
                marginVertical: 20,
              }}
              textStyles={{
                color: theme ? COLORS.lightModeText : COLORS.darkModeText,
              }}
              textContent={'Technical details'}
              actionFunction={() => {
                navigate.navigate('TechnicalTransactionDetails', {
                  selectedTX: selectedTX,
                  isLiquidPayment: usesLiquidNode,
                  isFailedPayment: isFailedPayment,
                  isEcashPayment: usesEcash,
                });
              }}
            />

            <ReceiptDots />
          </View>
        </ScrollView>
      </View>
    </GlobalThemeView>
  );
}

function Border() {
  const {theme, darkModeType} = useGlobalThemeContext();
  const dotsWidth = useWindowDimensions().width * 0.95 - 30;
  const numDots = Math.floor(dotsWidth / 25);

  let dotElements = [];

  for (let index = 0; index < numDots; index++) {
    dotElements.push(
      <View
        key={index}
        style={{
          width: 20,
          height: 2,
          backgroundColor: theme
            ? COLORS.darkModeText
            : COLORS.lightModeBackground,
        }}></View>,
    );
  }

  return (
    <View
      style={{
        width: '100%',
        justifyContent: 'space-between',
        flexDirection: 'row',
        marginBottom: 20,
      }}>
      {dotElements}
    </View>
  );
}

function ReceiptDots() {
  const {backgroundColor} = GetThemeColors();
  const dotsWidth = useWindowDimensions().width * 0.95 - 30;
  const numDots = Math.floor(dotsWidth / 25);

  let dotElements = [];

  for (let index = 0; index < numDots; index++) {
    dotElements.push(
      <View
        key={index}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: backgroundColor,
        }}></View>,
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Platform.OS == 'ios' ? -12 : -10,
        width: '100%',
        justifyContent: 'space-between',
        flexDirection: 'row',
      }}>
      {dotElements}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    width: WINDOWWIDTH,
    ...CENTER,
  },
  headerText: {
    fontSize: SIZES.xxLarge,
  },
  didCompleteText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Regular,
    marginBottom: 30,
  },

  fiatHeaderAmount: {
    fontSize: SIZES.huge,
  },
  satHeaderAmount: {
    marginBottom: 20,
  },

  infoLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  infoContainer: {
    width: '100%',
    maxWidth: 300,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contentBlock: {
    width: '45%',
    alignContent: 'center',
    justifyContent: 'center',
  },
  infoHeaders: {
    textAlign: 'center',
    fontSize: SIZES.large,
    marginBottom: 5,
  },
  infoDescriptions: {
    textAlign: 'center',
    fontSize: SIZES.small,
  },
  failedTransactionText: {
    fontFamily: FONT.Title_Bold,
    fontSize: SIZES.large,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  descriptionContainer: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    marginTop: 10,
  },
  descriptionHeader: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    marginBottom: 10,
  },
  descriptionContentContainer: {
    width: '100%',
    height: 100,
    padding: 10,
    borderRadius: 8,
  },
  buttonContainer: {
    marginTop: 'auto',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  buttonText: {
    fontFamily: FONT.Descriptoin_Regular,
    fontSize: SIZES.medium,
  },
});
