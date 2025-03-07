import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BITCOIN_SATS_ICON,
  CENTER,
  COLORS,
  ICONS,
  SIZES,
} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../functions/CustomElements';

import {useEffect, useRef, useState} from 'react';
import Icon from '../../../../functions/CustomElements/Icon';

import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import {Slider} from '@miblanchard/react-native-slider';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../hooks/themeColors';
import handleDBStateChange from '../../../../functions/handleDBStateChange';
import {formatCurrency} from '../../../../functions/formatCurrency';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';

export default function DisplayOptions() {
  const {toggleMasterInfoObject, setMasterInfoObject, masterInfoObject} =
    useGlobalContextProvider();
  const {isConnectedToTheInternet} = useAppStatus();
  const {nodeInformation} = useNodeContext();
  const {theme, darkModeType, toggleDarkModeType} = useGlobalThemeContext();

  const {backgroundOffset} = GetThemeColors();

  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();

  const sliderValue = masterInfoObject.homepageTxPreferance;
  const currencyText = nodeInformation?.fiatStats?.coin || 'USD';
  const formattedCurrency = formatCurrency({
    amount: 0,
    code: currencyText,
  });
  const currencySymbol = formattedCurrency[2];
  console.log(currencySymbol);

  const steps = [15, 20, 25, 30, 35, 40];
  const windowDimensions = useWindowDimensions();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{alignItems: 'center'}}
      style={styles.innerContainer}>
      <ThemeText styles={{...styles.infoHeaders}} content={'Dark Mode Style'} />
      <TouchableOpacity
        onPress={() => {
          if (darkModeType) return;
          toggleDarkModeType(!darkModeType);
        }}
        style={[
          styles.contentContainer,
          {
            // backgroundColor: theme
            //   ? COLORS.darkModeBackgroundOffset
            //   : COLORS.darkModeText,
            minHeight: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingHorizontal: 0,
          },
        ]}>
        <ThemeText styles={styles.removeFontPadding} content={`Lights out`} />
        <View
          style={{
            height: 30,
            width: 30,
            backgroundColor: darkModeType
              ? theme
                ? backgroundOffset
                : COLORS.primary
              : 'transparent',
            borderWidth: darkModeType ? 0 : 2,
            borderColor: theme ? backgroundOffset : COLORS.white,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {darkModeType && (
            <Icon
              width={15}
              height={15}
              color={COLORS.darkModeText}
              name={'expandedTxCheck'}
            />
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          if (!darkModeType) return;
          toggleDarkModeType(!darkModeType);
        }}
        style={[
          styles.contentContainer,
          {
            // backgroundColor: theme
            //   ? COLORS.darkModeBackgroundOffset
            //   : COLORS.darkModeText,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            paddingHorizontal: 0,
            minHeight: 0,
          },
        ]}>
        <ThemeText styles={styles.removeFontPadding} content={`Dim`} />
        <View
          style={{
            height: 30,
            width: 30,
            backgroundColor: !darkModeType
              ? theme
                ? backgroundOffset
                : COLORS.primary
              : 'transparent',
            borderColor: theme ? backgroundOffset : COLORS.white,
            borderWidth: !darkModeType ? 0 : 2,
            borderRadius: 15,
            alignItems: 'center',

            justifyContent: 'center',
          }}>
          {!darkModeType && (
            <Icon
              width={15}
              height={15}
              color={COLORS.darkModeText}
              name={'expandedTxCheck'}
            />
          )}
        </View>
      </TouchableOpacity>
      <ThemeText
        styles={{...styles.infoHeaders}}
        content={'Balance Denomination'}
      />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            paddingVertical: 10,
          },
        ]}>
        <ThemeText
          styles={styles.removeFontPadding}
          content={'Current denomination'}
        />
        <TouchableOpacity
          onPress={() => {
            if (!isConnectedToTheInternet) {
              navigate.navigate('ErrorScreen', {
                errorMessage:
                  'Please reconnect to the internet to switch your denomination',
              });
              return;
            }
            if (masterInfoObject.userBalanceDenomination === 'sats')
              handleDBStateChange(
                {userBalanceDenomination: 'fiat'},
                setMasterInfoObject,
                toggleMasterInfoObject,
                saveTimeoutRef,
              );
            else if (masterInfoObject.userBalanceDenomination === 'fiat')
              handleDBStateChange(
                {userBalanceDenomination: 'hidden'},
                setMasterInfoObject,
                toggleMasterInfoObject,
                saveTimeoutRef,
              );
            else
              handleDBStateChange(
                {userBalanceDenomination: 'sats'},
                setMasterInfoObject,
                toggleMasterInfoObject,
                saveTimeoutRef,
              );
          }}
          style={{
            height: 40,
            width: 40,
            backgroundColor: theme
              ? COLORS.darkModeText
              : COLORS.lightModeBackground,
            borderRadius: 8,
            alignItems: 'center',

            justifyContent: 'center',
          }}>
          <ThemeText
            styles={{
              color:
                theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary,
              fontSize: SIZES.large,
              ...styles.removeFontPadding,
            }}
            content={
              masterInfoObject.userBalanceDenomination === 'sats'
                ? BITCOIN_SATS_ICON
                : masterInfoObject.userBalanceDenomination === 'fiat'
                ? formattedCurrency[2]
                : '*'
            }
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            paddingVertical: 10,
          },
        ]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{
            ...styles.removeFontPadding,
            flex: 1,
            marginRight: 10,
          }}
          content={`How to display ${
            masterInfoObject.userBalanceDenomination !== 'fiat'
              ? 'sats'
              : 'fiat'
          } `}
        />
        <TouchableOpacity
          onPress={() => {
            if (masterInfoObject.satDisplay === 'symbol') return;
            toggleMasterInfoObject({satDisplay: 'symbol'});
          }}
          style={{
            height: 40,
            width: 40,
            backgroundColor:
              masterInfoObject.satDisplay === 'symbol'
                ? theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary
                : theme
                ? COLORS.darkModeText
                : COLORS.lightModeBackground,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto',
            marginRight: 10,
          }}>
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              color:
                masterInfoObject.satDisplay === 'symbol'
                  ? COLORS.darkModeText
                  : theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary,
              ...styles.removeFontPadding,
            }}
            content={
              masterInfoObject.userBalanceDenomination !== 'fiat'
                ? BITCOIN_SATS_ICON
                : currencySymbol
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (masterInfoObject.satDisplay === 'word') return;
            toggleMasterInfoObject({satDisplay: 'word'});
          }}
          style={{
            height: 40,
            width: 'auto',
            minWidth: 60,
            backgroundColor:
              masterInfoObject.satDisplay === 'word'
                ? theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary
                : theme
                ? COLORS.darkModeText
                : COLORS.lightModeBackground,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ThemeText
            styles={{
              color:
                masterInfoObject.satDisplay === 'word'
                  ? COLORS.darkModeText
                  : theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary,
              includeFontPadding: false,
              fontSize: SIZES.medium,
              paddingHorizontal: 10,
            }}
            content={
              masterInfoObject.userBalanceDenomination !== 'fiat'
                ? 'Sats'
                : currencyText
            }
          />
        </TouchableOpacity>
      </View>
      <ThemeText content={'Example'} />
      <FormattedSatText neverHideBalance={true} balance={50} />

      <ThemeText styles={{...styles.infoHeaders}} content={'Home Screen'} />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            flexDirection: 'row',
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          },
        ]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            marginRight: 25,
          }}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{...styles.removeFontPadding, marginRight: 5}}
            content={`Swipe for camera`}
          />
          <TouchableOpacity
            onPress={() => {
              navigate.navigate('InformationPopup', {
                textContent: `Swipe right from the main screen—whether you're on Contacts, Wallet, or the Home page—to quickly open the camera for scanning.`,
                buttonText: 'I understand',
              });
            }}>
            <ThemeImage
              styles={{width: 20, height: 20}}
              lightModeIcon={ICONS.aboutIcon}
              darkModeIcon={ICONS.aboutIcon}
              lightsOutIcon={ICONS.aboutIconWhite}
            />
          </TouchableOpacity>
        </View>
        <CustomToggleSwitch page={'cameraSlider'} />
      </View>
      <ThemeText
        styles={{
          ...styles.infoHeaders,
          width: windowDimensions.width * 0.95 * 0.9 * 0.9,
        }}
        content={'Displayed Transactions'}
      />
      <View style={styles.container}>
        <View style={styles.labelsContainer}>
          {steps.map(value => (
            <ThemeText key={value} content={value} />
          ))}
        </View>
        <Slider
          trackStyle={{
            width: windowDimensions.width * 0.95 * 0.9 * 0.9,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            height: 10,
            borderRadius: 20,
          }}
          onSlidingComplete={e => {
            const [num] = e;
            toggleMasterInfoObject({homepageTxPreferance: num});
          }}
          value={sliderValue}
          minimumValue={15}
          maximumValue={40}
          step={5}
          thumbStyle={{
            backgroundColor: COLORS.darkModeText,
            width: 25,
            height: 25,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: theme
              ? COLORS.darkModeBackgroundOffset
              : COLORS.lightModeBackgroundOffset,
          }}
          maximumTrackTintColor={theme ? backgroundOffset : COLORS.darkModeText}
          minimumTrackTintColor={theme ? backgroundOffset : COLORS.darkModeText}
        />
      </View>
      <ThemeText styles={{...styles.infoHeaders}} content={'Contacts Page'} />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            flexDirection: 'row',
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          },
        ]}>
        <ThemeText
          styles={styles.removeFontPadding}
          content={`Hide Unknown Senders`}
        />
        <CustomToggleSwitch page={'hideUnknownContacts'} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    marginTop: 25,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  infoHeaders: {
    width: '100%',
    marginBottom: 10,
  },
  contentContainer: {
    minHeight: 60,
    width: '100%',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  homeScreenTxOptionContainer: {
    width: '100%',
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },

  container: {
    width: '90%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: SIZES.medium,
    color: '#000',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 20,
    transform: [{scaleY: 2}],
  },
  imgIcon: {
    width: 30,
    height: 30,
  },
  removeFontPadding: {
    includeFontPadding: false,
  },
});
