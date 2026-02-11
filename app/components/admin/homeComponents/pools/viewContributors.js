import { useCallback } from 'react';
import { FlatList, Share, StyleSheet, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { usePools } from '../../../../../context-store/poolContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ContributorAvatar from './contributorAvatar';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useTranslation } from 'react-i18next';

export default function ViewContibutors(props) {
  const poolId = props.route?.params?.poolId;
  const contributions = props.route?.params?.contributions;

  const { masterInfoObject } = useGlobalContextProvider();
  const { pools } = usePools();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const pool = pools[poolId];
  const contributers = [pool, ...contributions];

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `https://blitzwalletapp.com/pools/${poolId}`,
      });
    } catch (err) {
      console.log('Error sharing pool:', err);
    }
  }, [poolId]);

  const Contributor = useCallback(({ item, index }) => {
    if (!item) return;

    if (index === 0) {
      return (
        <View style={styles.contributionRow}>
          <ContributorAvatar
            avatarSize={50}
            contributorName={
              item?.creatorName || item?.contributorName || 'Unknwon'
            }
          />
          <View>
            <ThemeText
              styles={styles.name}
              content={item?.creatorName || item?.contributorName || 'Unknwon'}
            />
            <ThemeText
              styles={styles.amount}
              content={t('wallet.pools.organizer')}
            />
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.contributionRow}>
          <ContributorAvatar
            avatarSize={50}
            contributorName={
              item?.creatorName || item?.contributorName || 'Unknwon'
            }
          />
          <View>
            <ThemeText
              styles={styles.name}
              content={item?.creatorName || item?.contributorName || 'Unknwon'}
            />
            <ThemeText
              styles={styles.amount}
              content={displayCorrectDenomination({
                amount: item.amount,
                masterInfoObject,
                fiatStats,
              })}
            />
          </View>
        </View>
      );
    }
  }, []);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('wallet.pools.contributorCount', {
          count: contributions?.length || 0,
        })}
      />

      <FlatList
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contributionContainer}
        data={contributers}
        renderItem={Contributor}
      />
      <CustomButton
        actionFunction={handleShare}
        buttonStyles={styles.button}
        textContent={t('wallet.pools.share')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contributionContainer: { width: WINDOWWIDTH, ...CENTER },
  contributionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  name: { includeFontPadding: false },
  amount: {
    opacity: HIDDEN_OPACITY,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  button: {
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
