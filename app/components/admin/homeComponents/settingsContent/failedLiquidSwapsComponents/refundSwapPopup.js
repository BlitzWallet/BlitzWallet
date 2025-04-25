import {
  KeyboardAvoidingView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useEffect, useState} from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {
  recommendedFees,
  refund,
} from '@breeztech/react-native-breez-sdk-liquid';
import CustomButton from '../../../../../functions/CustomElements/button';
import {copyToClipboard} from '../../../../../functions';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {keyboardGoBack} from '../../../../../functions/customNavigation';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';

export default function RefundLiquidSwapPopup(props) {
  const {theme} = useGlobalThemeContext();
  const [bitcoinAddress, setBitcoinAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigation();
  const {backgroundOffset, textInputBackground, textInputColor} =
    GetThemeColors();
  const [refundTxId, setRefundTxId] = useState('');
  const {swapAddress} = props.route.params;

  const [refundFeeRates, setRefundFeeRates] = useState([]);

  useEffect(() => {
    async function getRefundFeeRaes() {
      try {
        const fees = await recommendedFees();
        console.log(fees);
        let newFeeObject = [];
        for (let index = 0; index < Object.keys(fees).length; index++) {
          const element = Object.keys(fees)[index];
          const newObject = {
            isSelescted: element === 'hourFee',
            name: element,
            feeRate: fees[element],
          };
          newFeeObject.push(newObject);
        }
        setRefundFeeRates(newFeeObject.sort((a, b) => a.feeRate - b.feeRate));
      } catch (err) {
        console.error(err);
      }
    }

    getRefundFeeRaes();
  }, []);

  const feeElements =
    !!refundFeeRates.length &&
    refundFeeRates.map((key, index) => {
      console.log(key);
      return (
        <TouchableOpacity
          key={key.name}
          onPress={() => {
            setRefundFeeRates(prev => {
              return prev.map(item => {
                if (item.name === key.name) {
                  return {...item, isSelescted: true};
                } else return {...item, isSelescted: false};
              });
            });
          }}
          style={styles.contentContainer}>
          <ThemeText content={key.name} />
          <CheckMarkCircle isActive={key.isSelescted} containerSize={30} />
        </TouchableOpacity>
      );
    });
  return (
    <KeyboardAvoidingView style={{flex: 1}}>
      <TouchableWithoutFeedback
        onPress={() => {
          keyboardGoBack(navigate);
        }}>
        <View style={styles.background}>
          <TouchableWithoutFeedback>
            <View
              style={{
                ...styles.selectionContainer,
                backgroundColor: backgroundOffset,
              }}>
              {!Object.keys(refundFeeRates).length ? (
                <FullLoadingScreen text={'Getting fee rates'} />
              ) : refundTxId ? (
                <View style={{flex: 1}}>
                  <ThemeText
                    styles={{marginBottom: 20}}
                    content={'Refund transaction id'}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      copyToClipboard(refundTxId, navigate);
                    }}>
                    <ThemeText content={refundTxId.slice(0, 50)} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={[styles.btcAdressContainer]}>
                    <ThemeText
                      styles={styles.btcAdressHeader}
                      content={'Enter BTC address'}
                    />
                    <View style={[styles.inputContainer]}>
                      <CustomSearchInput
                        containerStyles={{
                          marginRight: 10,
                          marginLeft: 0,
                          flex: 1,
                        }}
                        textInputStyles={{
                          backgroundColor: theme
                            ? COLORS.darkModeText
                            : textInputBackground,
                          color: theme ? COLORS.lightModeText : textInputColor,
                        }}
                        placeholderText={'Bitcon address...'}
                        placeholderTextColor={
                          theme ? COLORS.opaicityGray : textInputColor
                        }
                        inputText={bitcoinAddress}
                        setInputText={setBitcoinAddress}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          if (errorMessage) return;
                          navigate.navigate('CameraModal', {
                            updateBitcoinAdressFunc: setBitcoinAddress,
                          });
                        }}>
                        <ThemeImage
                          styles={styles.scanIcon}
                          lightModeIcon={ICONS.faceIDIcon}
                          darkModeIcon={ICONS.faceIDIcon}
                          lightsOutIcon={ICONS.faceIDIconWhite}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <ThemeText
                    styles={{...styles.btcAdressHeader, marginTop: 20}}
                    content={'Select a fee rate'}
                  />
                  {feeElements}

                  <CustomButton
                    buttonStyles={{
                      ...CENTER,
                      opacity: !bitcoinAddress ? 0.2 : 1,
                      marginTop: 20,
                    }}
                    actionFunction={refundTransaction}
                    textContent={'Refund'}
                  />
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );

  async function refundTransaction() {
    try {
      if (!bitcoinAddress) return;
      const destinationAddress = bitcoinAddress;
      const [feeRateSatPerVbyte] = refundFeeRates.filter(
        item => item.isSelescted,
      );

      const refundResponse = await refund({
        swapAddress: swapAddress,
        refundAddress: destinationAddress,
        feeRateSatPerVbyte:
          feeRateSatPerVbyte.feeRate < 4 ? 4 : feeRateSatPerVbyte.feeRate,
      });
      setRefundTxId(refundResponse);
    } catch (err) {
      console.log(err);
    }
  }
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: COLORS.halfModalBackgroundColor,
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionContainer: {
    width: '90%',
    minHeight: 150,
    padding: 20,
    borderRadius: 8,
  },
  btcAdressContainer: {
    width: '100%',
    borderRadius: 8,
  },
  btcAdressHeader: {
    fontSize: SIZES.medium,
    marginBottom: 10,
  },

  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },

  scanIcon: {
    width: 35,
    height: 35,
  },

  contentContainer: {
    width: '100%',
    borderRadius: 8,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 0,
  },
});
