import { useCallback } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ContributorAvatar from './contributorAvatar';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useTranslation } from 'react-i18next';
import SectionCard from '../../../../screens/inAccount/settingsHub/components/SectionCard';
import GetThemeColors from '../../../../hooks/themeColors';

export default function ViewContibutors(props) {
  const pool = props.route?.params?.pool;
  const contributions = props.route?.params?.contributions;

  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
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
      <CustomSettingsTopBar
        label={t('wallet.pools.contributorCount', {
          count: contributions?.length || 0,
        })}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SectionCard>
          {contributers.map((item, index) => {
            if (!item) return null;

            const name =
              item?.creatorName || item?.contributorName || 'Unknown';
            const isOrganizer = index === 0;
            const isLast = index === contributers.length - 1;

            return (
              <View key={index}>
                <View style={styles.row}>
                  <ContributorAvatar avatarSize={40} contributorName={name} />
                  <ThemeText
                    styles={styles.name}
                    CustomNumberOfLines={1}
                    CustomEllipsizeMode={'tail'}
                    content={name}
                  />
                  {isOrganizer ? (
                    <ThemeText
                      styles={styles.roleLabel}
                      content={t('wallet.pools.organizer')}
                    />
                  ) : (
                    <ThemeText
                      styles={styles.amountLabel}
                      content={displayCorrectDenomination({
                        amount: item.amount,
                        masterInfoObject,
                        fiatStats,
                      })}
                    />
                  )}
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.separator,
                      { borderBottomColor: backgroundColor },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </SectionCard>
      </ScrollView>

      <CustomButton
        actionFunction={handleShare}
        buttonStyles={styles.button}
        textContent={t('wallet.pools.share')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: WINDOWWIDTH,
    ...CENTER,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  name: {
    flex: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  roleLabel: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    flexShrink: 0,
  },
  amountLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    flexShrink: 0,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: 16 + 40 + 12, // paddingHorizontal + avatarSize + gap
  },
  button: {
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
