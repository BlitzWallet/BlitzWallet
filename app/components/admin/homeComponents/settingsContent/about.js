import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../../../constants';

import {ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';

import {useGlobalThemeContext} from '../../../../../context-store/theme';

import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import openWebBrowser from '../../../../functions/openWebBrowser';
import {useTranslation} from 'react-i18next';

export default function AboutPage() {
  const {theme, darkModeType} = useGlobalThemeContext();

  const {t} = useTranslation();

  const navigate = useNavigation();
  const device_info = DeviceInfo.getVersion();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}>
      <ThemeText
        content={t('settings.about.text1')}
        styles={{...styles.sectionHeader, marginTop: 30}}
      />
      <Text style={styles.contentText}>
        <ThemeText content={t('settings.about.text2')} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={t('settings.about.text3')}
        />
        <ThemeText content={`,`} />
        <ThemeText content={t('settings.about.text4')} />
      </Text>

      <ThemeText content={'Blitz Wallet'} styles={{...styles.sectionHeader}} />

      <ThemeText
        content={t('settings.about.text5')}
        styles={{
          ...styles.contentText,
        }}
      />
      <Text style={{textAlign: 'center'}}>
        <ThemeText content={t('settings.about.text6')} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={t('settings.about.text7')}
        />
      </Text>
      <Text style={styles.contentText}>
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={t('settings.about.text8')}
        />
        <ThemeText content={t('settings.about.text9')} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={t('settings.about.text10')}
        />
      </Text>

      <ThemeText
        content={t('settings.about.text11')}
        styles={{...styles.sectionHeader}}
      />

      <Text
        style={{
          ...styles.contentText,
        }}>
        <ThemeText content={t('settings.about.text12')} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={t('settings.about.text13')}
        />
        <ThemeText content={t('settings.about.text14')} />
        <ThemeText content={t('settings.about.text15')} />
      </Text>

      <TouchableOpacity
        style={{...CENTER, marginBottom: 20}}
        onPress={() =>
          navigate.navigate('CustomWebView', {
            headerText: 'Spark',
            webViewURL: 'https://docs.spark.money/spark/spark-tldr',
          })
        }>
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={'Learn more'}
        />
      </TouchableOpacity>

      <View style={{...CENTER, alignItems: 'center'}}>
        <ThemeText
          styles={{fontSize: SIZES.large}}
          content={t('settings.about.text16')}
        />
        <CustomButton
          buttonStyles={{
            ...styles.customButtonContainer,
            marginBottom: 10,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          textStyles={{
            ...styles.buttonTextStyles,
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          textContent={'Blake Kaufman'}
          actionFunction={() => openBrower('blake')}
        />
        <ThemeText styles={{fontSize: SIZES.large}} content={'UX/UI'} />
        <CustomButton
          buttonStyles={{
            ...styles.customButtonContainer,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          textStyles={{
            ...styles.buttonTextStyles,
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          textContent={'Oliver Koblizek'}
          actionFunction={() => openBrower('oliver')}
        />
      </View>
      <ThemeText
        styles={{...CENTER, marginTop: 20}}
        content={`${t('settings.about.text17')} ${device_info}`}
      />
    </ScrollView>
  );

  async function openBrower(person) {
    await openWebBrowser({
      navigate: navigate,
      link: `https://x.com/${
        person === 'blake' ? 'blakekaufman17' : 'Stromens'
      }`,
    });
  }
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  sectionHeader: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
  },

  contentText: {
    textAlign: 'center',
    marginBottom: 20,
    textAlignVertical: 'center',
  },

  customButtonContainer: {width: 'auto', backgroundColor: COLORS.primary},
  buttonTextStyles: {
    color: COLORS.darkModeText,
  },
});
