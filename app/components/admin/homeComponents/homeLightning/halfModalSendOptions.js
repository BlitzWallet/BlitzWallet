import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import {
  navigateToSendUsingClipboard,
  getQRImage,
} from '../../../../functions';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useRef } from 'react';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';

export default function HalfModalSendOptions(props) {
  const navigate = useNavigation();
  const { theme } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts } = useGlobalContacts();
  const { t } = useTranslation();
  const didCallImagePicker = useRef(null);
  const { textColor } = GetThemeColors();

  const sendOptionElements = ['img', 'clipboard', 'manual'].map((item, key) => {
    const iconName =
      item === 'manual'
        ? 'SquarePen'
        : item === 'img'
        ? 'ImageIcon'
        : 'Clipboard';

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
            if (didCallImagePicker.current) return;
            didCallImagePicker.current = true;
            const response = await getQRImage();
            if (response.error) {
              navigate.replace('ErrorScreen', {
                errorMessage: t(response.error),
              });
              didCallImagePicker.current = false;
              return;
            }
            if (!response.didWork || !response.btcAdress) {
              didCallImagePicker.current = false;
              return;
            }
            navigate.replace('ConfirmPaymentScreen', {
              btcAdress: response.btcAdress,
              fromPage: '',
            });
            didCallImagePicker.current = false;
          } else if (item === 'clipboard') {
            navigateToSendUsingClipboard(navigate, 'modal', undefined, t);
          } else {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'manualEnterSendAddress',
              sliderHight: 0.5,
            });
          }
        }}
      >
        <View style={styles.optionRow}>
          <View style={styles.icon}>
            <ThemeIcon
              colorOverride={textColor}
              size={35}
              iconName={iconName}
            />
          </View>

          <ThemeText styles={styles.optionText} content={itemText} />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.containerStyles}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {sendOptionElements}
        {decodedAddedContacts.length != 0 && (
          <TouchableOpacity
            onPress={() => {
              navigate.replace('ChooseContactHalfModal');
            }}
          >
            <View style={styles.optionRow}>
              <View style={styles.icon}>
                <ThemeIcon
                  colorOverride={textColor}
                  size={35}
                  iconName={'UsersRound'}
                />
              </View>
              <ThemeText
                styles={{ ...styles.optionText }}
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
    paddingVertical: 10,
    ...CENTER,
  },
  optionText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },

  icon: {
    width: 35,
    height: 35,
    marginRight: 15,
  },
});
