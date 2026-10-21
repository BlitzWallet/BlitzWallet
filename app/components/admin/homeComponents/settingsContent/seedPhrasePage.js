import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { KeyContainer } from '../../../login';
import { useEffect, useState } from 'react';
import { FONT } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useKeysContext } from '../../../../../context-store/keys';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import calculateSeedQR from './seedQR';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import Segmented from '../../../../functions/CustomElements/redesign/Segmented';

export default function SeedPhrasePage({ extraData, route }) {
  const { accountMnemoinc: contextMnemonic } = useKeysContext();

  const paramMnemonic =
    extraData?.mnemonic || route?.params?.extraData?.mnemonic;
  const mnemonicString = paramMnemonic || contextMnemonic;

  const mnemonic = mnemonicString?.split(' ') || [];
  const navigate = useNavigation();
  const { tokens, mode } = useGlobalThemeContext();
  const { t } = useTranslation();
  const [seedContainerHeight, setSeedContainerHeight] = useState();
  const [selectedDisplayOption, setSelectedDisplayOption] = useState('words');
  const canViewQrCode =
    extraData?.canViewQrCode ||
    route?.params?.extraData?.canViewQrCode ||
    false;
  const qrValue = mnemonicString ? calculateSeedQR(mnemonicString) : '';

  useEffect(() => {
    if (canViewQrCode) setSelectedDisplayOption('qrcode');
  }, [canViewQrCode]);

  if (!mnemonicString) {
    return (
      <FullLoadingScreen
        textStyles={{ textAlign: 'center' }}
        text={t('settings.seedPhrase.header')}
      />
    );
  }

  const handleDisplayChange = value => {
    if (value === 'qrcode' && !canViewQrCode) {
      navigate.navigate('InformationPopup', {
        textContent: t('settings.seedPhrase.qrWarning'),
        buttonText: t('constants.understandText'),
        customNavigation: () =>
          navigate.popTo('SettingsContentHome', {
            for: 'show seed phrase',
            extraData: { ...extraData, canViewQrCode: true },
          }),
      });
      return;
    }
    setSelectedDisplayOption(value);
  };

  return (
    <View style={styles.container}>
      <CustomScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemeText
          styles={[styles.title, { color: tokens.ink }]}
          content={t('settings.seedPhrase.header')}
        />
        <ThemeText
          variant="body"
          styles={[styles.sub, { color: tokens.muted }]}
          content={t('settings.seedPhrase.headerDesc')}
        />

        <View style={styles.toggle}>
          <Segmented
            accessibilityLabel={t('settings.seedPhrase.wordsText')}
            value={selectedDisplayOption}
            onChange={handleDisplayChange}
            minHeight={40}
            capitalizeLabels={false}
            options={[
              {
                label: t('settings.seedPhrase.wordsText'),
                value: 'words',
              },
              {
                label: t('settings.seedPhrase.qrText'),
                value: 'qrcode',
              },
            ]}
          />
        </View>

        {selectedDisplayOption === 'qrcode' && canViewQrCode ? (
          <View
            style={[
              styles.qrCard,
              {
                height: seedContainerHeight,
              },
            ]}
          >
            <QrCodeWrapper
              qrSize={230}
              outerContainerStyle={{
                backgroundColor: 'transparent',
                width: '100%',
                height: '100%',
                borderRadius: 20,
              }}
              innerContainerStyle={{
                width: 230,
                height: 230,
              }}
              QRData={qrValue}
            />
          </View>
        ) : (
          <View
            style={styles.words}
            onLayout={event => {
              setSeedContainerHeight(event.nativeEvent.layout.height);
            }}
          >
            <KeyContainer keys={mnemonic} variant="card" />
          </View>
        )}
      </CustomScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 24 },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
  },
  sub: {
    marginTop: 4,
  },
  toggle: { marginTop: 32 },
  words: { marginTop: 12 },
  qrCard: {
    marginTop: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
