import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import openWebBrowser from '../../../../functions/openWebBrowser';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../context-store/webViewContext';
import { useState } from 'react';
import GetThemeColors from '../../../../hooks/themeColors';

export default function AboutPage() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { fileHash } = useWebView();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { backgroundOffset } = GetThemeColors();
  const device_info = DeviceInfo.getVersion();

  const isVerified = fileHash === process.env.WEBVIEW_BUNDLE_HASH;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
    >
      <ThemeText
        content={t('settings.about.header1')}
        styles={{ ...styles.sectionHeader, marginTop: 30 }}
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
      <ThemeText
        content={'Blitz Wallet'}
        styles={{ ...styles.sectionHeader }}
      />
      <ThemeText
        content={t('settings.about.text5')}
        styles={{
          ...styles.contentText,
        }}
      />
      <Text style={{ textAlign: 'center' }}>
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
        content={t('settings.about.header2')}
        styles={{ ...styles.sectionHeader }}
      />
      <Text
        style={{
          ...styles.contentText,
        }}
      >
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
        style={{ ...CENTER, marginBottom: 20 }}
        onPress={() =>
          navigate.navigate('CustomWebView', {
            headerText: 'Spark',
            webViewURL: 'https://docs.spark.money/spark/spark-tldr',
          })
        }
      >
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={t('settings.about.learnMore')}
        />
      </TouchableOpacity>
      <View style={{ ...CENTER, alignItems: 'center' }}>
        <ThemeText
          styles={{ fontSize: SIZES.large }}
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
        <ThemeText styles={{ fontSize: SIZES.large }} content={'UX/UI'} />
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
        styles={{ ...CENTER, marginTop: 20 }}
        content={`${t('settings.about.text17')} ${device_info}`}
      />

      {/* Security Verification Badge */}
      <View style={styles.verificationContainer}>
        <View
          style={[
            styles.verificationBadge,
            { backgroundColor: backgroundOffset },
          ]}
        >
          <ThemeText
            styles={[styles.verificationTitle]}
            content={
              isVerified
                ? t('settings.about.webpackVerified')
                : t('settings.about.webpackUnvarified')
            }
          />
        </View>

        <TouchableOpacity
          style={styles.detailsToggle}
          onPress={() => setShowDetails(!showDetails)}
        >
          <ThemeText
            styles={{
              color:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              fontSize: SIZES.small,
            }}
            content={
              showDetails
                ? t('settings.about.hideTechnicals')
                : t('settings.about.showTechnicals')
            }
          />
        </TouchableOpacity>

        {showDetails && (
          <View
            style={[
              styles.technicalDetails,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <ThemeText
              styles={styles.detailLabel}
              content={t('settings.about.backendHash')}
            />
            <ThemeText styles={styles.detailHash} content={fileHash} />
            <ThemeText
              styles={styles.detailLabel}
              content={t('settings.about.expectedHash')}
            />
            <ThemeText
              styles={styles.detailHash}
              content={process.env.WEBVIEW_BUNDLE_HASH}
            />
          </View>
        )}
      </View>
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
  customButtonContainer: {
    width: 'auto',
    backgroundColor: COLORS.primary,
  },
  buttonTextStyles: {
    color: COLORS.darkModeText,
  },
  verificationContainer: {
    marginTop: 30,
    marginBottom: 30,
    alignItems: 'center',
  },
  verificationBadge: {
    borderRadius: 12,
    padding: 24,
    width: '90%',
    alignItems: 'center',
    marginBottom: 0,
  },

  detailsToggle: {
    padding: 10,
  },
  technicalDetails: {
    width: '90%',
    marginTop: 10,
    padding: 15,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: SIZES.small,
    marginTop: 10,
    marginBottom: 5,
  },
  detailHash: {
    fontSize: SIZES.xSmall,
    opacity: 0.7,
  },
});
