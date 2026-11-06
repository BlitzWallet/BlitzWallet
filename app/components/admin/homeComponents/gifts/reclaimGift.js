import React, { useCallback, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { AssetDisc } from '../savings/savingsSheetParts';
import {
  formatGiftAmount,
  giftAsset,
  giftNumberLabel,
  giftShortDate,
} from './giftDisplay';

export default function ReclaimGift() {
  const { expiredGiftsArray, updateGiftList, checkForRefunds } = useGifts();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const giftList = await updateGiftList();
        await checkForRefunds(giftList);
      })();
    }, [updateGiftList, checkForRefunds]),
  );

  const [enteredLink, setEnteredLink] = useState('');
  const { t } = useTranslation();

  const handleClaimGift = () => {
    if (!enteredLink) return;
    setEnteredLink('');
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'ClaimGiftScreen',
      url: enteredLink,
      claimType: 'reclaim',
    });
  };

  const hasExpiredGift = !!expiredGiftsArray?.length;

  const handleAdvancedMode = () => {
    navigate.navigate('AdvancedGiftClaim');
  };

  if (!hasExpiredGift) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('screens.inAccount.giftPages.reclaimPage.title')} />
          <View style={styles.empty}>
            <EmptyState
              icon={'RotateCcw'}
              title={t('screens.inAccount.giftPages.reclaimPage.header')}
              sub={t(
                'screens.inAccount.giftPages.reclaimPage.noReclaimsMessage',
              )}
            />
          </View>

          <CustomButton
            textContent={t(
              'screens.inAccount.giftPages.reclaimPage.advancedModeBTN',
            )}
            actionFunction={handleAdvancedMode}
            size={'regular'}
            tone={'secondary'}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.giftPages.reclaimPage.title')} />
        <PageHeader
          title={t('screens.inAccount.giftPages.reclaimPage.header')}
          sub={t('screens.inAccount.giftPages.reclaimPage.desc')}
        />
        <CustomScrollView>
          <ListCard>
            {expiredGiftsArray.map(item => (
              <PickRow
                key={item.uuid}
                onPress={() => setEnteredLink(item.uuid)}
                selected={enteredLink === item.uuid}
                lead={<AssetDisc asset={giftAsset(item)} />}
                title={
                  item.description ||
                  `${t('constants.gift')} ${giftNumberLabel(item.giftNum)}`
                }
                sub={t('screens.inAccount.giftPages.reclaimPage.expiredOn', {
                  amount: formatGiftAmount({
                    gift: item,
                    masterInfoObject,
                    fiatStats,
                  }),
                  date: giftShortDate(item.expireTime),
                })}
              />
            ))}
          </ListCard>
        </CustomScrollView>

        <View style={styles.buttonContainer}>
          <CustomButton
            disabled={!enteredLink}
            actionFunction={handleClaimGift}
            textContent={t('screens.inAccount.giftPages.reclaimPage.button')}
            size={'regular'}
          />
          <TextButton
            text={t('screens.inAccount.giftPages.reclaimPage.advancedModeBTN')}
            align="center"
            onPress={handleAdvancedMode}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: { gap: 10 },
});
