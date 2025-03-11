import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {CENTER, ICONS, SIZES} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getClipboardText, getQRImage} from '../../../../functions';
import {ThemeText} from '../../../../functions/CustomElements';

import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import {useTranslation} from 'react-i18next';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {ANDROIDSAFEAREA} from '../../../../constants/styles';
import {useNodeContext} from '../../../../../context-store/nodeContext';

export default function HalfModalSendOptions(props) {
  const navigate = useNavigation();
  const insets = useSafeAreaInsets();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {decodedAddedContacts} = useGlobalContacts();
  const {t} = useTranslation();

  const windowDimensions = useWindowDimensions();

  const sendOptionElements = ['img', 'clipboard', 'manual'].map((item, key) => {
    const lightIcon =
      item === 'img'
        ? ICONS.ImagesIcon
        : item === 'clipboard'
        ? ICONS.clipboardLight
        : ICONS.editIconLight;
    const darkIcon =
      item === 'img'
        ? ICONS.ImagesIconDark
        : item === 'clipboard'
        ? ICONS.clipboardDark
        : ICONS.editIcon;

    const itemText =
      item === 'img'
        ? t('wallet.halfModal.images')
        : item === 'clipboard'
        ? t('wallet.halfModal.clipboard')
        : t('wallet.halfModal.manual');
    return (
      <TouchableOpacity
        key={key}
        onPress={async () => {
          if (item === 'img') {
            const response = await getQRImage(navigate, 'modal');
            if (response.error) {
              navigate.navigate('ErrorScreen', {
                errorMessage: response.error,
              });
              return;
            }
            if (!response.didWork || !response.btcAdress) return;
            navigate.replace('ConfirmPaymentScreen', {
              btcAdress: response.btcAdress,
              fromPage: '',
            });
          } else if (item === 'clipboard') {
            getClipboardText(navigate, 'modal', nodeInformation);
          } else {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'manualEnterSendAddress',
              sliderHight: 0.5,
            });
          }
        }}>
        <View style={styles.optionRow}>
          <ThemeImage
            styles={styles.icon}
            lightModeIcon={darkIcon}
            darkModeIcon={lightIcon}
            lightsOutIcon={lightIcon}
          />
          <ThemeText styles={styles.optionText} content={itemText} />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View
      style={{
        ...styles.containerStyles,
        height: windowDimensions.height * props.slideHeight,
        backgroundColor: backgroundColor,
        paddingBottom: insets.bottom,
      }}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: backgroundOffset,
          },
        ]}
      />
      <View style={styles.optionsContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}>
          {sendOptionElements}
          {decodedAddedContacts.length != 0 && (
            <TouchableOpacity
              onPress={() => {
                navigate.replace('ChooseContactHalfModal');
              }}>
              <View style={styles.optionRow}>
                <ThemeImage
                  styles={styles.icon}
                  lightModeIcon={ICONS.contactsIcon}
                  darkModeIcon={ICONS.contactsIconLight}
                  lightsOutIcon={ICONS.contactsIconLight}
                />
                <ThemeText
                  styles={{...styles.optionText}}
                  content={t('wallet.halfModal.contacts')}
                />
              </View>
            </TouchableOpacity>
          )}
          <View
            style={{
              height: insets.bottom < 20 ? ANDROIDSAFEAREA : insets.bottom,
            }}
          />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  borderTop: {
    width: '100%',
    height: 60,
    position: 'absolute',
    top: -5,
    zIndex: -1,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  containerStyles: {
    minHeight: 'auto',
    width: '100%',

    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,

    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },

  optionsContainer: {
    width: '100%',
    height: '100%',
  },

  optionRow: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    ...CENTER,
  },
  optionText: {
    fontSize: SIZES.large,
  },

  icon: {
    width: 35,
    height: 35,
    marginRight: 15,
  },
});
