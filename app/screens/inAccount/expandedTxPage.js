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
import Icon from '../../functions/CustomElements/Icon';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../functions/CustomElements/button';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';

export default function ExpandedTx(props) {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  const transaction = props.route.params.transaction;
  console.log(transaction, 'transaction');
  const transactionPaymentType = transaction.paymentType;

  const isFailedPayment = transaction.paymentStatus === 'failed';

  const isPending = transaction.paymentStatus === 'pending';

  const paymentDate = new Date(transaction.details.time);

  const description = transaction.details.description;

  const month = paymentDate.toLocaleString('default', {month: 'short'});
  const day = paymentDate.getDate();
  const year = paymentDate.getFullYear();
  useHandleBackPressNew();

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <View style={{flex: 1}}>
        <TouchableOpacity
          style={{marginRight: 'auto'}}
          onPress={navigate.goBack}>
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollViewContentContainer}>
          <View
            style={{
              ...styles.receiptContainer,
              backgroundColor: theme ? backgroundOffset : COLORS.white,
            }}>
            <View
              style={{
                ...styles.paymentStatusOuterContainer,
                backgroundColor: backgroundColor,
              }}>
              <View
                style={{
                  ...styles.paymentStatusFirstCircle,
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
                }}>
                <View
                  style={{
                    ...styles.paymentStatusSecondCircle,
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
                transaction.details.direction === 'OUTGOING' || isFailedPayment
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
              balance={transaction.details.amount}
            />
            <View style={styles.paymentStatusTextContainer}>
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
                balance={isFailedPayment ? 0 : transaction.details.fee}
              />
            </View>
            <View style={styles.infoLine}>
              <ThemeText content={'Type'} />
              <ThemeText
                content={transactionPaymentType}
                styles={{fontSize: SIZES.large, textTransform: 'capitalize'}}
              />
            </View>

            {description && (
              <View style={styles.descriptionContainer}>
                <ThemeText content={'Memo'} styles={styles.descriptionHeader} />

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
                      content={description}
                      styles={styles.buttonText}
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
                  transaction: transaction,
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

  return <View style={styles.borderContainer}>{dotElements}</View>;
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

  return <View style={styles.receiptDotsContainer}>{dotElements}</View>;
}

const styles = StyleSheet.create({
  borderContainer: {
    width: '100%',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginBottom: 20,
  },
  receiptDotsContainer: {
    position: 'absolute',
    bottom: Platform.OS == 'ios' ? -12 : -10,
    width: '100%',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  scrollViewContentContainer: {
    width: '95%',
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  receiptContainer: {
    width: '100%',
    height: 'auto',
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    padding: 15,
    paddingTop: 40,
    ...CENTER,
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 20,
  },
  paymentStatusOuterContainer: {
    width: 100,
    height: 100,
    position: 'absolute',
    top: -70,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentStatusFirstCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
  },
  paymentStatusSecondCircle: {
    width: 60,
    height: 60,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentStatusTextContainer: {
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 30,
    marginBottom: 10,
  },
  infoLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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

  buttonText: {
    fontFamily: FONT.Descriptoin_Regular,
    fontSize: SIZES.medium,
  },
});
