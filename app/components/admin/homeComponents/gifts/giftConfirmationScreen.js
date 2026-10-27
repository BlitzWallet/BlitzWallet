import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import { handleGiftCardShare } from '../../../../functions/gift/standardizeLinkShare';
import { shareMessage } from '../../../../functions/handleShare';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';
import { useGifts } from '../../../../../context-store/giftContext';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { formatGiftAmount } from './giftDisplay';

const K = 'screens.inAccount.giftPages.giftConfirmation.';

function GiftRow({ title, sub, copied, onCopy, onPress }) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={styles.row}
    >
      <Disc icon="Gift" size={40} />
      <View style={styles.rowText}>
        <ThemeText styles={styles.rowTitle} content={title} />
        <ThemeText
          CustomNumberOfLines={1}
          CustomEllipsizeMode="middle"
          styles={[styles.rowSub, { color: tokens.muted }]}
          content={sub?.replace(/^https?:\/\//, '')}
        />
      </View>
      <IconButton
        icon={copied ? 'Check' : 'Copy'}
        label="constants.copy"
        size={36}
        iconSize={18}
        tone="disc"
        onPress={onCopy}
      />
    </TouchableOpacity>
  );
}

export default function GiftConfirmation(props) {
  const {
    isBulk = false,
    // Single gift params
    giftId = '',
    // Bulk gift params
    giftsUUIDs = [],
  } = props.route?.params || {};

  const { giftsArray } = useGifts();
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [copiedKey, setCopiedKey] = useState(null);
  const copiedTimer = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const gifts = isBulk
    ? giftsArray.filter(gift => {
        return giftsUUIDs.includes(gift?.uuid);
      })
    : giftsArray.find(gift => gift?.uuid === giftId);

  const amountOf = gift =>
    formatGiftAmount({ gift, masterInfoObject, fiatStats });

  const handleCopy = (data, key) => {
    copyToClipboard(data, showToast);
    setCopiedKey(key);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleCopyAllLinks = () => {
    const allLinks = gifts.map(g => g.claimURL).join('\n');
    copyToClipboard(allLinks, showToast);
  };

  const handleShare = async () => {
    try {
      if (isBulk) {
        await shareMessage({ message: gifts.map(g => g.claimURL).join('\n') });
        return;
      }
      await handleGiftCardShare({
        amount: amountOf(gifts),
        giftLink: gifts?.claimURL,
      });
    } catch (error) {
      console.log('Share cancelled or error:', error);
    }
  };

  const openQr = gift =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'giftQrCode',
      claimURL: gift?.claimURL,
      title: gift?.description
        ? `${gift.description} · ${amountOf(gift)}`
        : amountOf(gift),
    });

  const handleGoHome = useCallback(() => {
    navigate.popTo('GiftsPageHome');
    return true;
  }, [navigate]);

  useHandleBackPressNew(handleGoHome);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          onBack={handleGoHome}
          right={
            <IconButton
              icon="Share2"
              label="screens.inAccount.giftPages.giftConfirmation.shareGift"
              onPress={handleShare}
            />
          }
        />
        <CustomScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Animated.View entering={ZoomIn.duration(300)}>
              <Disc icon="Check" tone="primary" size={72} iconSize={32} />
            </Animated.View>
            <ThemeText
              styles={styles.title}
              content={
                isBulk
                  ? t(K + 'bulkHeader', { count: gifts.length })
                  : t(K + 'header')
              }
            />
            <ThemeText
              styles={[styles.subtitle, { color: tokens.muted }]}
              content={t(isBulk ? K + 'bulkDesc' : K + 'whatToDo')}
            />
          </View>

          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            {isBulk ? (
              gifts.map((gift, index) => (
                <View key={gift?.uuid || index}>
                  {index > 0 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: tokens.divider },
                      ]}
                    />
                  )}
                  <GiftRow
                    title={t(K + 'bulkRowTitle', {
                      number: index + 1,
                      amount: amountOf(gift),
                    })}
                    sub={gift.claimURL}
                    copied={copiedKey === index}
                    onCopy={() => handleCopy(gift.claimURL, index)}
                    onPress={() => openQr(gift)}
                  />
                </View>
              ))
            ) : (
              <GiftRow
                title={
                  gifts?.description
                    ? `${gifts.description} · ${amountOf(gifts)}`
                    : amountOf(gifts)
                }
                sub={gifts?.claimURL}
                copied={copiedKey === 'single'}
                onCopy={() => handleCopy(gifts?.claimURL, 'single')}
              />
            )}
          </View>

          {!isBulk && (
            <TextButton
              text={t(K + 'showQr')}
              align="center"
              onPress={() => openQr(gifts)}
            />
          )}
        </CustomScrollView>

        <View style={styles.bottomButtons}>
          <CustomButton
            size="regular"
            actionFunction={handleGoHome}
            textContent={t('constants.done')}
          />
          <CustomButton
            size="regular"
            tone="secondary"
            icon={isBulk ? 'Copy' : undefined}
            actionFunction={
              isBulk ? handleCopyAllLinks : () => navigate.popTo('CreateGift')
            }
            textContent={t(isBulk ? K + 'copyAllLinks' : K + 'createAnother')}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollView: { flex: 1 },
  header: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  title: {
    marginTop: 16,
    fontFamily: FONT.Title_Medium,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  card: { borderRadius: 20, paddingHorizontal: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  rowSub: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  divider: { height: StyleSheet.hairlineWidth },
  bottomButtons: {
    gap: 10,
    paddingTop: CONTENT_KEYBOARD_OFFSET,
  },
});
