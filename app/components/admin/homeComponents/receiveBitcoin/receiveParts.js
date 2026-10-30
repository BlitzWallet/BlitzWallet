import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT, ICONS } from '../../../../constants';
import { MODES } from '../../../../constants/themes';
import { useTheme } from '../../../../../context-store/theme';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import CustomButton from '../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import QrCard from '../../../../functions/CustomElements/redesign/QrCard';

// Shared pieces of the Receive QR pages (Receive.dc.html, ReceiveMore.dc.html):
// the white QR card with its info rows, the round centre badges, and the
// Copy / Share pair.

const LIGHT = MODES.light;

// White QR card. While the address is loading (or failed) the QR area keeps
// its size so the page doesn't jump. `caption` is the truncated address.
export function ReceiveQrCard({
  value,
  size,
  loading,
  errorText,
  badge,
  caption,
  rows,
  onPress,
  removeCard,
}) {
  const { t } = useTranslation();
  const ready = !!value && !loading && !errorText;
  return (
    <QrCard
      value={ready ? value : ' '}
      size={size}
      badgeSize={44}
      onPress={ready ? onPress : undefined}
      accessibilityLabel={t('constants.copy')}
      style={[!removeCard && styles.card]}
    >
      {!ready && (
        <View style={[styles.qrCover, { width: size, height: size }]}>
          {errorText ? (
            <ThemeText styles={styles.errorText} content={errorText} />
          ) : (
            <FullLoadingScreen showText={false} loadingColor={LIGHT.ink} />
          )}
        </View>
      )}
      {!!caption && ready && (
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.caption}
          content={caption}
        />
      )}
      {!!rows?.length && (
        <View style={styles.rows}>
          {rows.map(row => (
            <TouchableOpacity
              key={row.label}
              onPress={row.onPress}
              disabled={!row.onPress}
              style={styles.row}
              accessibilityRole="button"
            >
              <ThemeText styles={styles.rowLabel} content={row.label} />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.rowValue}
                content={row.value}
              />
              {!!row.onPress && (
                <ThemeIcon
                  redesign
                  iconName="Info"
                  size={16}
                  colorOverride={LIGHT.muted}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </QrCard>
  );
}

// Round QR centre badge: a coloured disc with a white glyph, or a logo image
// with an optional small chain logo on its corner.
export function QrBadge({ kind, image, chainImage, size = 44 }) {
  const { tokens } = useTheme();
  const disc = { width: size, height: size, borderRadius: size / 2 };
  const glyph = size * 0.55;
  let inner;
  if (kind === 'lightning' || kind === 'bitcoin' || kind === 'dollar') {
    const icon =
      kind === 'lightning'
        ? ICONS.lightningReceiveIcon
        : kind === 'bitcoin'
        ? ICONS.bitcoinIcon
        : ICONS.dollarIcon;
    inner = (
      <View
        style={[
          styles.badge,
          disc,
          {
            backgroundColor:
              kind === 'lightning'
                ? COLORS.bitcoinOrange
                : kind === 'bitcoin'
                ? COLORS.bitcoinOrange
                : COLORS.dollarGreen,
          },
        ]}
      >
        <ThemeImage
          styles={
            kind === 'lightning'
              ? [styles.bolt, { width: glyph * 0.6, height: glyph }]
              : { width: glyph, height: glyph }
          }
          lightModeIcon={icon}
          darkModeIcon={icon}
          lightsOutIcon={icon}
        />
      </View>
    );
  } else if (kind === 'tokens') {
    inner = (
      <View style={[styles.badge, disc, { backgroundColor: LIGHT.disc }]}>
        <ThemeIcon
          redesign
          iconName="Layers"
          size={glyph * 0.8}
          colorOverride={LIGHT.ink}
        />
      </View>
    );
  } else {
    inner = <Image source={image} style={disc} contentFit="contain" />;
  }
  if (!chainImage) return inner;
  return (
    <View>
      {inner}
      <Image
        source={chainImage}
        style={styles.chainBadge}
        contentFit="contain"
      />
    </View>
  );
}

// Copy (turns into a check for 1.5 s) · Share.
export function ReceiveActions({ value, onShare, style, useLoading }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = () => {
    if (!value) return;
    copyToClipboard(value, showToast);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.actions, style]}>
      <CustomButton
        size="regular"
        tone="secondary"
        icon={copied ? 'Check' : 'Copy'}
        buttonStyles={styles.action}
        disabled={!value}
        actionFunction={handleCopy}
        textContent={t('constants.copy')}
      />
      <CustomButton
        size="regular"
        tone="secondary"
        icon="Share2"
        buttonStyles={styles.action}
        disabled={!value}
        actionFunction={onShare}
        textContent={t('receive.share')}
        useLoading={useLoading}
      />
    </View>
  );
}

// "TXy7k2…mQ49a2" under the QR.
export function shortAddress(address) {
  if (!address || address.length < 16) return address || '';
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

// Chain logo for the network lists and the QR corner badge.
export function chainIcon(chain) {
  return ICONS[`chain_${chain.label.toLowerCase()}`];
}

export function ChainLogo({ chain, size = 36 }) {
  return (
    <Image
      source={chainIcon(chain)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="contain"
    />
  );
}

export function AssetLogo({ asset, size = 36 }) {
  return (
    <Image
      source={asset === 'USDC' ? ICONS.usdcLogo : ICONS.usdtLogo}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderWidth: 0, paddingBottom: 8 },
  qrCover: {
    position: 'absolute',
    top: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkModeText,
  },
  errorText: {
    color: LIGHT.ink,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  caption: {
    marginTop: 14,
    marginBottom: 6,
    color: LIGHT.muted,
    fontFamily: FONT.mono,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  rows: { alignSelf: 'stretch', marginTop: 10 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LIGHT.divider,
  },
  rowLabel: {
    flex: 1,
    color: LIGHT.muted,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  rowValue: {
    color: LIGHT.ink,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  badge: { alignItems: 'center', justifyContent: 'center' },
  bolt: { tintColor: COLORS.darkModeText },
  chainBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.darkModeText,
  },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});
