import React, { useRef } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { GlobalThemeView } from '../../functions/CustomElements';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { TAB_ITEM_HEIGHT } from '../../../navigation/tabs';
import { useTabScrollToTop } from '../../../navigation/tabs/useTabScrollToTop';
import BTCMapPreviewCard from '../../components/admin/homeComponents/store/BTCMapPreviewCard';
import { useGlobalAppData } from '../../../context-store/appData';
import PageTitle from '../../functions/CustomElements/redesign/PageTitle';
import { useTranslation } from 'react-i18next';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import Disc from '../../functions/CustomElements/redesign/Disc';
import TopHeader from '../../functions/CustomElements/redesign/TopHeader';
import {
  FADE_TOP,
  FADE_TOP_BUFFER,
} from '../../functions/CustomElements/redesign/TopFade';

export default function AppStore() {
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { decodedChatGPT, decodedMessages } = useGlobalAppData();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();
  const scrollViewRef = useRef(null);

  const hasLegacyChatGPT =
    (decodedChatGPT?.credits ?? 0) > 0 ||
    Platform.OS === 'android' ||
    Platform.OS === 'web';

  const hasLegacySMS =
    (decodedMessages?.sent?.length ?? 0) > 0 ||
    (decodedMessages?.received?.length ?? 0) > 0 ||
    Platform.OS === 'android' ||
    Platform.OS === 'web';

  const showLegacySection =
    hasLegacyChatGPT ||
    hasLegacySMS ||
    Platform.OS === 'android' ||
    Platform.OS === 'web';

  useTabScrollToTop(scrollViewRef);

  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopHeader>
          <View style={styles.header}>
            <PageTitle text={t('apps.appList.title')} />
          </View>
        </TopHeader>
        <CustomScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 40 },
          ]}
        >
          <BTCMapPreviewCard />

          <ListCard dividerInset={52}>
            <ListRow
              key={'Bitrefill'}
              title={t('apps.appList.shop')}
              sub={t('apps.appList.shopDescription')}
              onPress={() => navigate.navigate('BitrefillShopModal')}
              titleStyle={styles.rowTitle}
              accessibilityLabel={'Bitrefill'}
              minHeight={68}
              paddingVertical={12}
              showChevron={true}
              lead={<Disc icon={'WalletCards'} size={40} />}
            />
            <ListRow
              key={'Globe'}
              title={t('apps.appList.onlineListings')}
              sub={t('apps.appList.onlineListingsDescription')}
              onPress={() =>
                navigate.navigate('AppStorePageIndex', {
                  page: 'onlinelistings',
                })
              }
              titleStyle={styles.rowTitle}
              accessibilityLabel={'Merchants'}
              minHeight={68}
              paddingVertical={12}
              showChevron={true}
              lead={<Disc icon={'Globe'} size={40} />}
            />
          </ListCard>

          {showLegacySection && (
            <ListCard dividerInset={52} style={styles.card}>
              {hasLegacyChatGPT && (
                <ListRow
                  key={'Bot'}
                  title={t('apps.appList.AI')}
                  sub={t('apps.appList.AIDescription')}
                  onPress={() =>
                    navigate.navigate('AppStorePageIndex', { page: 'ai' })
                  }
                  titleStyle={styles.rowTitle}
                  accessibilityLabel={t('apps.appList.AI')}
                  minHeight={68}
                  paddingVertical={12}
                  showChevron={true}
                  lead={<Disc icon={'Bot'} size={40} />}
                />
              )}
              {hasLegacySMS && (
                <ListRow
                  key={'MessageSquareText'}
                  title={t('apps.appList.SMS')}
                  sub={t('apps.appList.SMSDescription')}
                  onPress={() =>
                    navigate.navigate('AppStorePageIndex', {
                      page: 'sms4sats',
                    })
                  }
                  titleStyle={styles.rowTitle}
                  accessibilityLabel={'Merchants'}
                  minHeight={68}
                  paddingVertical={12}
                  showChevron={true}
                  lead={<Disc icon={'MessageSquareText'} size={40} />}
                />
              )}
            </ListCard>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    width: '100%',
    flex: 1,
  },
  header: {
    marginTop: 10,
    minHeight: 45,
    justifyContent: 'center',
  },
  card: { marginTop: 12 },
  container: { paddingBottom: 0 },

  scrollContent: {
    flexGrow: 1,
    width: '100%',
    paddingTop: FADE_TOP + FADE_TOP_BUFFER,
  },
});
