import {
  ScrollView,
  StyleSheet,
  Text,
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

import {useRef, useState} from 'react';

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
import {FONT, INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useTranslation} from 'react-i18next';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';

export default function DisplayOptions() {
  const {toggleMasterInfoObject, setMasterInfoObject, masterInfoObject} =
    useGlobalContextProvider();
  const {isConnectedToTheInternet} = useAppStatus();
  const {nodeInformation} = useNodeContext();
  const {theme, darkModeType, toggleDarkModeType} = useGlobalThemeContext();
  const [labelSize, setLabelSize] = useState(0);
  const {t} = useTranslation();
  const {backgroundOffset, textColor} = GetThemeColors();

  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();

  const sliderValue = masterInfoObject.homepageTxPreferance;
  const currencyText = nodeInformation?.fiatStats?.coin || 'USD';
  const formattedCurrency = formatCurrency({
    amount: 0,
    code: currencyText,
  });
  const currencySymbol = formattedCurrency[2];

  const steps = [15, 20, 25, 30, 35, 40];
  const windowDimensions = useWindowDimensions();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{alignItems: 'center'}}
      style={styles.innerContainer}>
      <ThemeText
        styles={styles.infoHeaders}
        content={t('settings.displayoptions.text1')}
      />
      <TouchableOpacity
        onPress={() => {
          if (darkModeType) return;
          toggleDarkModeType(!darkModeType);
        }}
        style={styles.darkModeStyleContainer}>
        <ThemeText
          styles={styles.removeFontPadding}
          content={t('settings.displayoptions.text2')}
        />
        <CheckMarkCircle isActive={darkModeType} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          if (!darkModeType) return;
          toggleDarkModeType(!darkModeType);
        }}
        style={styles.darkModeStyleContainer}>
        <ThemeText
          styles={styles.removeFontPadding}
          content={t('settings.displayoptions.text3')}
        />
        <CheckMarkCircle isActive={!darkModeType} />
      </TouchableOpacity>
      <ThemeText
        styles={styles.infoHeaders}
        content={t('settings.displayoptions.text4')}
      />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.removeFontPadding}
          content={t('settings.displayoptions.text5')}
        />
        <TouchableOpacity
          onPress={() => {
            if (!isConnectedToTheInternet) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t('settings.displayoptions.text6'),
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
            ...styles.denominationContainer,
            backgroundColor: theme
              ? COLORS.darkModeText
              : COLORS.lightModeBackground,
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
          },
        ]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{
            ...styles.removeFontPadding,
            flex: 1,
            marginRight: 10,
          }}
          content={`${t('settings.displayoptions.text7')} ${
            masterInfoObject.userBalanceDenomination !== 'fiat'
              ? 'sats'
              : `${t('settings.displayoptions.text8')}`
          } `}
        />
        <TouchableOpacity
          onPress={() => {
            if (masterInfoObject.satDisplay === 'symbol') return;
            toggleMasterInfoObject({satDisplay: 'symbol'});
          }}
          style={{
            ...styles.denominationContainer,
            backgroundColor:
              masterInfoObject.satDisplay === 'symbol'
                ? theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary
                : theme
                ? COLORS.darkModeText
                : COLORS.lightModeBackground,
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
            ...styles.denominationContainerWord,
            backgroundColor:
              masterInfoObject.satDisplay === 'word'
                ? theme && darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.primary
                : theme
                ? COLORS.darkModeText
                : COLORS.lightModeBackground,
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
      <ThemeText content={t('settings.displayoptions.text9')} />
      <FormattedSatText neverHideBalance={true} balance={50} />

      <ThemeText
        styles={styles.infoHeaders}
        content={t('settings.displayoptions.text10')}
      />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <View style={styles.swipeForCameraContainer}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{...styles.removeFontPadding, marginRight: 5}}
            content={`Swipe for camera`}
          />
          <TouchableOpacity
            onPress={() => {
              navigate.navigate('InformationPopup', {
                textContent: t('settings.displayoptions.text12'),
                buttonText: t('constants.iunderstand'),
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
        content={t('settings.displayoptions.text13')}
      />
      <View style={styles.container}>
        <View style={styles.labelsContainer}>
          {steps.map((value, index) => (
            <Text
              onLayout={e => {
                setLabelSize(Math.round(e.nativeEvent.layout.width));
              }}
              style={{
                fontSize: SIZES.medium,
                fontFamily: FONT.Title_Regular,
                color: textColor,
                position: 'absolute',
                top: -20,
                left:
                  (index / (steps.length - 1)) *
                    (windowDimensions.width * 0.95 * 0.9 * 0.9 - 25) +
                  25 / 2 -
                  labelSize / 2,
              }}
              key={value}>
              {value}
            </Text>
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
      <ThemeText
        styles={styles.infoHeaders}
        content={t('settings.displayoptions.text14')}
      />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.removeFontPadding}
          content={t('settings.displayoptions.text15')}
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
  darkModeStyleContainer: {
    width: '100%',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 0,
  },

  contentContainer: {
    minHeight: 60,
    width: '100%',
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 10,
  },
  denominationContainer: {
    height: 40,
    width: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denominationContainerWord: {
    height: 40,
    width: 'auto',
    minWidth: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeForCameraContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 25,
  },
  container: {
    width: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  labelsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  removeFontPadding: {
    includeFontPadding: false,
  },
});
