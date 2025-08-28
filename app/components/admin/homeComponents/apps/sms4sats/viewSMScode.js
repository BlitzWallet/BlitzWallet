import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {COLORS, ICONS} from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import {SIZES} from '../../../../../constants/theme';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useNavigation} from '@react-navigation/native';
import {parsePhoneNumberWithError} from 'libphonenumber-js';
import {countrymap} from './receiveCountryCodes';
import {useCallback, useMemo} from 'react';
import {copyToClipboard} from '../../../../../functions';
import {useToast} from '../../../../../../context-store/toastManager';
import {useTranslation} from 'react-i18next';

export default function ViewSmsReceiveCode(props) {
  const {showToast} = useToast();
  const {backgroundOffset} = GetThemeColors();
  const navigate = useNavigation();
  const {t} = useTranslation();

  const country = props.route?.params?.country || 'N/A';
  const code = props.route?.params?.code || 'N/A';
  const phone = props.route?.params?.phone | 'N/A';

  const countryCode = countrymap.find(item => {
    return item?.label?.toLowerCase() === country.toLowerCase();
  });

  const phoneNumber = useMemo(() => {
    try {
      return parsePhoneNumberWithError('+' + phone).formatInternational();
    } catch (err) {
      console.log('parse number errro', err);
      return '';
    }
  }, [countryCode]);

  const handleCopy = useCallback(() => {
    copyToClipboard(code, showToast);
  }, [code]);
  return (
    <View style={styles.container}>
      <View
        style={[styles.contentContainer, {backgroundColor: backgroundOffset}]}>
        <View style={styles.topBar}>
          <ThemeText
            styles={styles.codeHeaderText}
            content={t('apps.sms4sats.viewSMSReceiveCode.header')}
          />
          <TouchableOpacity onPress={navigate.goBack} style={styles.closeIcon}>
            <ThemeImage
              lightModeIcon={ICONS.xSmallIcon}
              darkModeIcon={ICONS.xSmallIcon}
              lightsOutIcon={ICONS.xSmallIconWhite}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleCopy}>
          <ThemeText styles={styles.codeText} content={code} />
        </TouchableOpacity>
        <ThemeText styles={styles.numberText} content={phoneNumber} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  contentContainer: {
    padding: 10,
    borderRadius: 8,
    width: '80%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeHeaderText: {
    flexGrow: 1,
    marginHorizontal: 30,
    textAlign: 'center',
    fontSize: SIZES.large,
  },
  closeIcon: {
    position: 'absolute',
    right: 0,
  },
  codeText: {
    fontSize: SIZES.xxLarge,
    textAlign: 'center',
    marginTop: 20,
  },
  numberText: {
    textAlign: 'center',
    marginBottom: 30,
  },
});
