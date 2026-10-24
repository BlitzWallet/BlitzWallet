import { useCallback } from 'react';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ContributorAvatar from './contributorAvatar';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useTranslation } from 'react-i18next';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

export default function ViewContibutors(props) {
  const pool = props.route?.params?.pool;
  const contributions = props.route?.params?.contributions;
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const contributers = [pool, ...contributions];

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `https://blitzwalletapp.com/pools/${pool.poolId}`,
      });
    } catch (err) {
      console.log('Error sharing pool:', err);
    }
  }, [pool]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('wallet.pools.viewActivityTitle')}
          right={
            <IconButton
              icon={'Share2'}
              label="wallet.pools.share"
              onPress={handleShare}
            />
          }
        />

        <SectionHeader
          first={true}
          title={t('wallet.pools.activityInfoHeader', {
            numPeople: contributers.length,
            contributionAmount: displayCorrectDenomination({
              amount: pool.currentAmount,
              masterInfoObject,
              fiatStats,
            }),
            totalAmount: displayCorrectDenomination({
              amount: pool.goalAmount,
              masterInfoObject,
              fiatStats,
            }),
          })}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ListCard>
            {contributers.map((item, index) => {
              if (!item) return null;

              let name = item?.creatorName || item?.contributorName;

              if (typeof name !== 'string' || !name) {
                name = t('wallet.pools.unknown');
              }

              const isOrganizer = index === 0;

              const contributedDate = formatDate(item?.createdAt, t);

              return (
                <ListRow
                  lead={
                    <ContributorAvatar avatarSize={40} contributorName={name} />
                  }
                  title={name === 'Anonymous' ? t('constants.annonName') : name}
                  sub={
                    isOrganizer ? t('wallet.pools.organizer') : contributedDate
                  }
                  trailing={
                    <ThemeText
                      styles={styles.amountLabel}
                      content={displayCorrectDenomination({
                        amount: item.amount,
                        masterInfoObject,
                        fiatStats,
                      })}
                    />
                  }
                />
              );
            })}
          </ListCard>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const formatDate = (createdAt, t) => {
  try {
    if (!createdAt) return '';

    let date;

    if (typeof createdAt === 'number') {
      date = new Date(createdAt);
    } else if (typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt.seconds !== undefined) {
      date = new Date(createdAt.seconds * 1000);
    } else {
      return '';
    }

    const today = new Date();

    const isSameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (isSameDay) return t('constants.today');

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch (err) {
    return '';
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 10,
  },
  amountLabel: {
    includeFontPadding: false,
    flexShrink: 0,
  },
});
