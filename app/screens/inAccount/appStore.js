import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { CENTER, SIZES } from '../../constants';
import {
  HIDDEN_OPACITY,
  MAX_CONTENT_WIDTH,
  WINDOWWIDTH,
} from '../../constants/theme';
import { TAB_ITEM_HEIGHT } from '../../../navigation/tabs';
import BTCMapPreviewCard from '../../components/admin/homeComponents/store/BTCMapPreviewCard';
import ProfileImageSettingsNavigator from '../../functions/CustomElements/profileSettingsNavigator';
import { useGlobalAppData } from '../../../context-store/appData';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';

export default function AppStore() {
  const navigate = useNavigation();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const { decodedChatGPT, decodedMessages } = useGlobalAppData();
  const { t } = useTranslation();

  const hasLegacyChatGPT =
    (decodedChatGPT?.credits ?? 0) > 0 || Platform.OS === 'android';

  const hasLegacySMS =
    (decodedMessages?.sent?.length ?? 0) > 0 ||
    (decodedMessages?.received?.length ?? 0) > 0 ||
    Platform.OS === 'android';
  const showLegacySection =
    hasLegacyChatGPT || hasLegacySMS || Platform.OS === 'android';

  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={false}>
      <View style={styles.navbar}>
        <ThemeText
          CustomNumberOfLines={1}
          content={'Explore'}
          styles={styles.headerText}
        />
        <ProfileImageSettingsNavigator />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 24 },
        ]}
      >
        <View style={styles.content}>
          <BTCMapPreviewCard />

          <PreviewCard
            backgroundOffset={backgroundOffset}
            backgroundColor={backgroundColor}
            textColor={textColor}
            icon="WalletCards"
            label="Bitrefill"
            title={t('apps.appList.shop')}
            subtitle={t('apps.appList.shopDescription')}
            onPress={() => navigate.navigate('BitrefillShopModal')}
          />

          <PreviewCard
            backgroundOffset={backgroundOffset}
            backgroundColor={backgroundColor}
            textColor={textColor}
            icon="Globe"
            label="Merchants"
            title={t('apps.appList.onlineListings')}
            subtitle={t('apps.appList.onlineListingsDescription')}
            onPress={() =>
              navigate.navigate('AppStorePageIndex', { page: 'onlinelistings' })
            }
          />

          {showLegacySection && (
            <View style={styles.legacySection}>
              {hasLegacyChatGPT && (
                <PreviewCard
                  backgroundOffset={backgroundOffset}
                  backgroundColor={backgroundColor}
                  textColor={textColor}
                  icon="Bot"
                  title={t('apps.appList.AI')}
                  subtitle={t('apps.appList.AIDescription')}
                  onPress={() =>
                    navigate.navigate('AppStorePageIndex', { page: 'ai' })
                  }
                />
              )}
              {hasLegacySMS && (
                <PreviewCard
                  backgroundOffset={backgroundOffset}
                  backgroundColor={backgroundColor}
                  textColor={textColor}
                  icon="MessageSquareText"
                  title={t('apps.appList.SMS')}
                  subtitle={t('apps.appList.SMSDescription')}
                  onPress={() =>
                    navigate.navigate('AppStorePageIndex', { page: 'sms4sats' })
                  }
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

function PreviewCard({
  backgroundOffset,
  backgroundColor,
  textColor,
  icon,
  title,
  subtitle,
  onPress,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.previewCard, { backgroundColor: backgroundOffset }]}
    >
      <View style={[styles.previewCardIcon, { backgroundColor }]}>
        <ThemeIcon size={22} colorOverride={textColor} iconName={icon} />
      </View>
      <View style={styles.previewCardBody}>
        <ThemeText content={title} styles={styles.previewCardTitle} />
        <ThemeText content={subtitle} styles={styles.previewCardSubtitle} />
      </View>
      <ThemeIcon iconName={'ChevronRight'} size={15} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 0 },
  navbar: {
    width: WINDOWWIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...CENTER,
    marginBottom: 10,
  },
  headerText: {
    flexShrink: 1,
    width: '100%',
    textAlign: 'center',
    fontSize: SIZES.large,
    paddingHorizontal: 90,
    position: 'absolute',
  },
  scrollContent: { flexGrow: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  previewCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardBody: { flex: 1 },
  previewCardLabel: {
    fontSize: SIZES.small,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewCardTitle: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    marginBottom: 2,
  },
  previewCardSubtitle: { fontSize: SIZES.small, opacity: HIDDEN_OPACITY },
  previewCardChevron: { fontSize: 20, opacity: 0.4, marginLeft: 8 },
});
