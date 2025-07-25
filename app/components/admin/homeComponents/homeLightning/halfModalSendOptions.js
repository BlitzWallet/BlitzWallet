import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {navigateToSendUsingClipboard, getQRImage} from '../../../../functions';
import {ThemeText} from '../../../../functions/CustomElements';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import {useTranslation} from 'react-i18next';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import Icon from '../../../../functions/CustomElements/Icon';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useGlobalInsets} from '../../../../../context-store/insetsProvider';

export default function HalfModalSendOptions(props) {
  const navigate = useNavigation();
  const {theme} = useGlobalThemeContext();
  const {bottomPadding} = useGlobalInsets();
  const {decodedAddedContacts} = useGlobalContacts();
  const {t} = useTranslation();

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
          crashlyticsLogReport(
            `Running in half modal sent options navigation function`,
          );
          if (item === 'img') {
            const response = await getQRImage(navigate, 'modal');
            if (response.error) {
              navigate.replace('ErrorScreen', {
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
            navigateToSendUsingClipboard(navigate, 'modal');
          } else {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'manualEnterSendAddress',
              sliderHight: 0.5,
            });
          }
        }}>
        <View style={styles.optionRow}>
          {item === 'manual' ? (
            <View
              style={{
                ...styles.icon,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon
                color={theme ? COLORS.darkModeText : COLORS.lightModeText}
                height={30}
                width={30}
                name={'editIcon'}
              />
            </View>
          ) : (
            <ThemeImage
              styles={styles.icon}
              lightModeIcon={darkIcon}
              darkModeIcon={lightIcon}
              lightsOutIcon={lightIcon}
            />
          )}
          <ThemeText styles={styles.optionText} content={itemText} />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.containerStyles}>
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
            height: bottomPadding,
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  containerStyles: {
    flex: 1,
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
