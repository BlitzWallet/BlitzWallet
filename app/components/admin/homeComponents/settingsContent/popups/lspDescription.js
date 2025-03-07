import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';
import {BTN, COLORS, FONT, ICONS, SIZES} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {CENTER, backArrow} from '../../../../../constants/styles';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {WINDOWWIDTH} from '../../../../../constants/theme';
import handleBackPress from '../../../../../hooks/handleBackPress';
import {useEffect} from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';

export default function LspDescriptionPopup() {
  const navigate = useNavigation();
  function handleBackPressFunction() {
    navigate.goBack();
    return true;
  }
  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, []);
  return (
    <GlobalThemeView useStandardWidth={true}>
      <TouchableOpacity onPress={() => navigate.goBack()}>
        <ThemeImage
          lightsOutIcon={ICONS.arrow_small_left_white}
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
        />
      </TouchableOpacity>
      <View style={{flex: 1, width: '90%', alignItems: 'center', ...CENTER}}>
        <ThemeText
          content={`A Lightning Service Provider (Lsp) is a business that enables a more seamless experience on the Lightning Network. Such services include providing liquidity management and payment routing.`}
          styles={{...styles.text, marginTop: 'auto'}}
        />
        <ThemeText
          content={`Since the Lightning Network operates based on a series of channels, the size of a Lightning channel is naturally constrained. Using an Lsp decreases that constraint, making larger payments more feasible.`}
          styles={{...styles.text}}
        />
        <ThemeText
          content={`It’s important to note that an Lsp DOES NOT HAVE ACCESS TO YOUR FUNDS. They are merely a helper to reduce the impact of the Lightning Network's liquidity constraint.`}
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
          textContent={'Learn more'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  text: {
    width: '100%',
    marginBottom: 10,
    textAlign: 'center',
  },
});
