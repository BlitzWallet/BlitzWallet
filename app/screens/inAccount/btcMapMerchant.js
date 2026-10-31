import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, FONT, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import CustomButton from '../../functions/CustomElements/button';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { getBtcMapIcon } from '../../functions/btcMap/iconMaping';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useTranslation } from 'react-i18next';
import { getNormalizedWebsiteUrl } from '../../functions/getNormalizedWebsiteUrl';

export default function BTCMapMerchantContent({
  placeId,
  source,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { tokens } = GetThemeColors();
  const { getPlaceDetail } = useBTCMap();
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
    setContentHeight(444 + contactRows * 52);
  }, [setContentHeight, phone, website, email]);

  useEffect(() => {
    if (!placeId) return;
    setDetailLoading(true);
    getPlaceDetail(placeId, source)
      .then(detail => setPlace(detail))
      .finally(() => setDetailLoading(false));
  }, [placeId, source, getPlaceDetail]);

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

  if (detailLoading) {
    return <FullLoadingScreen showText={false} />;
  }

  return (
    <View style={styles.content}>
      <CustomScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.hero}>
          <View style={[styles.iconContainer, { backgroundColor: tokens.disc }]}>
            <ThemeIcon
              redesign
              size={24}
              iconName={getBtcMapIcon(place?.icon)}
            />
          </View>
          <ThemeText content={name} styles={styles.name} />
          {!!address && (
            <ThemeText
              content={address}
              styles={[styles.addressLine, { color: tokens.muted }]}
            />
          )}
        </View>

        {hasContact && (
          <View
            style={[
              styles.contactSection,
              { backgroundColor: tokens.ground },
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
                onPress: () => {
                  // Directory data is attacker-submittable: https-only.
                  const safeUrl = getNormalizedWebsiteUrl(website);
                  if (safeUrl) Linking.openURL(safeUrl);
                },
              },
              {
                value: email,
                icon: 'Mail',
                onPress: () => Linking.openURL(`mailto:${email}`),
              },
            ]
              .filter(item => item.value)
              .map((item, index, arr) => (
                <React.Fragment key={item.icon}>
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={item.onPress}
                    activeOpacity={0.6}
                  >
                    <ThemeIcon
                      redesign
                      iconName={item.icon}
                      size={18}
                      colorOverride={tokens.muted}
                    />
                    <ThemeText
                      content={item.value}
                      styles={[styles.contactText, { color: tokens.ink }]}
                      CustomNumberOfLines={1}
                    />
                    <ThemeIcon
                      redesign
                      iconName="ArrowUpRight"
                      size={16}
                      colorOverride={tokens.muted}
                    />
                  </TouchableOpacity>
                  {index < arr.length - 1 && (
                    <View
                      style={[
                        styles.contactSeparator,
                        { backgroundColor: tokens.divider },
                      ]}
                    />
                  )}
                </React.Fragment>
              ))}
          </View>
        )}
      </CustomScrollView>
      <View style={styles.actionRow}>
        <CustomButton
          buttonStyles={[
            styles.actionBtn,
            { backgroundColor: tokens.ground },
          ]}
          textStyles={{ color: tokens.ink }}
          enableElipsis={false}
          textContent={directionsBTN}
          actionFunction={handleDirections}
          size="regular"
          tone="secondary"
        />
        <CustomButton
          buttonStyles={[
            styles.actionBtn,
            { backgroundColor: tokens.accent },
          ]}
          textStyles={{ color: tokens.onAccent }}
          enableElipsis={false}
          textContent={payBTN}
          actionFunction={handlePay}
          size="regular"
          tone="primary"
        />
      </View>

      <ThemeText
        content={t('screens.btcMap.merchant.dataMessage', { source })}
        styles={[styles.attribution, { color: tokens.muted }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  scrollView: { flex: 1 },
  hero: {
    alignItems: 'center',
    marginTop: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    marginBottom: 12,
  },
  name: {
    fontFamily: FONT.Title_Regular,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 2,
    includeFontPadding: false,
  },
  addressLine: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  contactSection: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    marginTop: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: 12,
  },
  contactSeparator: {
    height: 1,
    marginLeft: 30,
  },
  contactText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
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
  actionRow: {
    width: '100%',
    marginTop: 'auto',
    gap: 12,
  },
  actionBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.small,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
