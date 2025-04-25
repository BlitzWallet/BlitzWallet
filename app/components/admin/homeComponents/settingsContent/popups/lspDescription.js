import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ICONS} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {CENTER} from '../../../../../constants/styles';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {useTranslation} from 'react-i18next';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';

export default function LspDescriptionPopup() {
  const navigate = useNavigation();
  const {t} = useTranslation();
  useHandleBackPressNew();
  return (
    <GlobalThemeView useStandardWidth={true}>
      <TouchableOpacity onPress={navigate.goBack}>
        <ThemeImage
          lightsOutIcon={ICONS.arrow_small_left_white}
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
        />
      </TouchableOpacity>
      <View style={styles.textContainer}>
        <ThemeText
          content={t('settings.lspdescription.text1')}
          styles={{...styles.text, marginTop: 'auto'}}
        />
        <ThemeText
          content={t('settings.lspdescription.text2')}
          styles={{...styles.text}}
        />
        <ThemeText
          content={t('settings.lspdescription.text3')}
          styles={{...styles.text, marginBottom: 'auto'}}
        />

        <CustomButton
          buttonStyles={{width: 'auto', marginTop: 50}}
          actionFunction={() => {
            navigate.navigate('CustomWebView', {
              webViewURL:
                'https://thebitcoinmanual.com/articles/explained-lsp/#:~:text=LSPs%20are%20counterparties%20on%20users%E2%80%99%20payment%20channels%20that,network%20management%20such%20as%3A%20Opening%20and%20closing%20channels',
            });
          }}
          textContent={t('settings.lspdescription.text4')}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    ...CENTER,
  },
  text: {
    width: '100%',
    marginBottom: 10,
    textAlign: 'center',
  },
});
