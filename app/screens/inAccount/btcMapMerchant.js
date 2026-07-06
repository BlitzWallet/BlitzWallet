import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, COLORS, ICONS, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import ThemeImage from '../../functions/CustomElements/themeImage';
import useAdaptiveButtonLayout from '../../hooks/useAdaptiveButtonLayout';
import CustomButton from '../../functions/CustomElements/button';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { useKeysContext } from '../../../context-store/keys';
import { getBtcMapIcon } from '../../functions/btcMap/iconMaping';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useTranslation } from 'react-i18next';

export default function BTCMapMerchantContent({
  placeId,
  source,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { getPlaceDetail } = useBTCMap();
  const { contactsPrivateKey: privateKey, publicKey } = useKeysContext();
  const { t } = useTranslation();

  const [place, setPlace] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const name = place?.name || t('screens.btcMap.merchant.noName');
  const address = place?.address || '';
  const lat = place?.lat;
  const lon = place?.lon;
  const phone = place?.phone;
  const website = place?.website;
  const email = place?.email;
  const hasContact = phone || website || email;

  useEffect(() => {
    const contactRows = [phone, website, email].filter(Boolean).length;
    setContentHeight(500 + contactRows * 48);
  }, [setContentHeight, phone, website, email]);

  useEffect(() => {
    if (!placeId) return;
    setDetailLoading(true);
    getPlaceDetail(placeId, source, privateKey, publicKey)
      .then(detail => setPlace(detail))
      .finally(() => setDetailLoading(false));
  }, [placeId, source, getPlaceDetail, privateKey, publicKey]);

  const handleDirections = useCallback(() => {
    if (!lat || !lon) return;
    const label = encodeURIComponent(name);
    const url =
      Platform.OS === 'ios'
        ? `maps://maps.apple.com/?q=${label}&ll=${lat},${lon}`
        : `geo:${lat},${lon}?q=${label}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lon}`),
    );
  }, [lat, lon, name]);

  const handlePay = useCallback(() => {
    handleBackPressFunction(() => {
      navigate.goBack();
      navigate.navigate('SendBTC');
    });
  }, [navigate, handleBackPressFunction]);

  const directionsBTN = t('screens.btcMap.merchant.directions');
  const payBTN = t('screens.btcMap.merchant.pay');

  const { shouldStack, containerProps, getLabelProps } =
    useAdaptiveButtonLayout([directionsBTN, payBTN]);

  if (detailLoading) {
    return <FullLoadingScreen showText={false} />;
  }

  return (
    <View style={styles.content}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}
        >
          <ThemeIcon size={25} iconName={getBtcMapIcon(place?.icon)} />
        </View>
        <ThemeText content={name} styles={styles.name} />
        {!!address && (
          <View style={styles.addressBlock}>
            <ThemeText content={address} styles={styles.addressLine} />
          </View>
        )}

        {hasContact && (
          <View
            style={[
              styles.contactSection,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            {[
              {
                value: phone,
                icon: 'Phone',
                onPress: () => Linking.openURL(`tel:${phone}`),
              },
              {
                value: website,
                icon: 'Globe',
                onPress: () =>
                  Linking.openURL(
                    website.startsWith('http') ? website : `https://${website}`,
                  ),
              },
              {
                value: email,
                icon: 'Mail',
                onPress: () => Linking.openURL(`mailto:${email}`),
              },
            ]
              .filter(item => item.value)
              .map((item, index, arr) => (
                <TouchableOpacity
                  key={item.icon}
                  style={[
                    styles.contactRow,
                    index < arr.length - 1 && styles.contactSeparator,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.6}
                >
                  <ThemeIcon
                    iconName={item.icon}
                    size={18}
                    // styles={{opacity: 0.6}}
                  />
                  <ThemeText
                    content={item.value}
                    styles={styles.contactText}
                    numberOfLines={1}
                  />
                  <ThemeIcon
                    iconName="ChevronRight"
                    size={16}
                    styles={{ opacity: 0.35 }}
                  />
                </TouchableOpacity>
              ))}
          </View>
        )}

        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <ThemeImage
              styles={[
                styles.lightningIcon,
                {
                  tintColor:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                },
              ]}
              lightModeIcon={ICONS.lightningReceiveIcon}
              darkModeIcon={ICONS.lightningReceiveIcon}
              lightsOutIcon={ICONS.lightningReceiveIcon}
            />
            <View style={styles.paymentInfo}>
              <ThemeText
                content={t('screens.btcMap.merchant.lightning')}
                styles={styles.paymentLabel}
              />
              <ThemeText
                content={t('screens.btcMap.merchant.lightningMessage')}
                styles={styles.paymentDesc}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <View
        {...containerProps}
        style={[
          styles.actionRow,
          shouldStack
            ? styles.buttonContainerStacked
            : styles.buttonContainerColumns,
        ]}
      >
        <CustomButton
          buttonStyles={[
            styles.actionBtn,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
            shouldStack ? styles.buttonStacked : styles.buttonColumn,
          ]}
          textStyles={{
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
          enableElipsis={false}
          {...getLabelProps(0)}
          textContent={directionsBTN}
          actionFunction={handleDirections}
        />
        <CustomButton
          buttonStyles={[
            styles.actionBtn,
            {
              backgroundColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            },
            shouldStack ? styles.buttonStacked : styles.buttonColumn,
          ]}
          textStyles={{
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          enableElipsis={false}
          {...getLabelProps(1)}
          textContent={payBTN}
          actionFunction={handlePay}
        />
      </View>

      <ThemeText
        content={t('screens.btcMap.merchant.dataMessage', { source })}
        styles={styles.attribution}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  iconContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    marginBottom: 10,
  },
  name: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
    includeFontPadding: false,
  },
  addressBlock: { marginBottom: 20, includeFontPadding: false },
  addressLine: { fontSize: SIZES.smedium, opacity: 0.5, lineHeight: 22 },
  contactSection: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  contactSeparator: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  contactText: {
    flex: 1,
    marginLeft: 12,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  paymentSection: { marginBottom: 28, gap: 16, marginTop: 'auto' },
  paymentRow: { flexDirection: 'row', alignItems: 'flex-start' },
  paymentInfo: { flex: 1, marginLeft: 12 },
  lightningIcon: { width: 15, height: 20 },
  paymentLabel: { fontWeight: 500, includeFontPadding: false, marginBottom: 2 },
  paymentDesc: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    lineHeight: 18,
  },
  actionRow: { width: '100%', gap: 10, alignItems: 'center', marginBottom: 15 },
  buttonContainerColumns: { flexDirection: 'row', justifyContent: 'center' },
  buttonContainerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonColumn: { flex: 1 },
  buttonStacked: { width: '100%' },
  attribution: {
    fontSize: SIZES.xSmall,
    textAlign: 'center',
    opacity: 0.35,
    includeFontPadding: false,
  },
});
