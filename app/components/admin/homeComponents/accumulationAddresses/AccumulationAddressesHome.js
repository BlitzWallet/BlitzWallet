import { useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AccumulationAddressCard from './AccumulationAddressCard';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { FONT } from '../../../../constants/theme';
import { CENTER, MAX_WEB_CONTENT_WIDTH, SIZES } from '../../../../constants';
import { getPairKey } from '../../../../constants/accumulationAddresses';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import InfoDropdown from '../../../../functions/CustomElements/redesign/InfoDropdown';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';

export default function AccumulationAddressesHome() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { addresses } = useAccumulationAddresses();
  const { isConnectedToTheInternet } = useAppStatus();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const handleCreate = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'createAccumulationAddress',
      sliderHight: 0.6,
    });
  }, [isConnectedToTheInternet, navigate, t]);

  const groups = useMemo(() => {
    const byKey = new Map();
    for (const address of addresses) {
      const key = getPairKey(address);
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, {
          sourceChain: address.sourceChain,
          sourceAsset: address.sourceAsset,
          destinationAsset: address.destinationAsset,
          representative: address,
          count: 1,
        });
      }
    }
    return Array.from(byKey.values());
  }, [addresses]);

  if (!groups.length) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('screens.accumulationAddresses.title')} />
          <View style={styles.empty}>
            <EmptyState
              icon={'ArrowDownToLine'}
              title={t('screens.accumulationAddresses.empty.title')}
              sub={t('screens.accumulationAddresses.empty.subtitle')}
            />
          </View>
          <CustomButton
            textContent={t('screens.accumulationAddresses.createButton')}
            actionFunction={handleCreate}
            size={'regular'}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('screens.accumulationAddresses.title')} />
        <InfoDropdown
          icon="Info"
          title={t('screens.accumulationAddresses.info.title')}
          infoComponenet={
            <>
              <ThemeText
                styles={styles.bodyText}
                content={t('screens.accumulationAddresses.info.whatAreBody')}
              />
              <ThemeText
                styles={styles.sectionTitle}
                content={t('screens.accumulationAddresses.info.howItWorks')}
              />
              <ThemeText
                styles={styles.bulletText}
                content={t('screens.accumulationAddresses.info.step1')}
              />
              <ThemeText
                styles={styles.bulletText}
                content={t('screens.accumulationAddresses.info.step2')}
              />
              <ThemeText
                styles={styles.bulletText}
                content={t('screens.accumulationAddresses.info.step3')}
              />
            </>
          }
        />
        <SectionHeader
          title={t('screens.accumulationAddresses.sectionTitle')}
          style={styles.sectionHeader}
        />
        <CustomScrollView>
          <ListCard>
            {groups.map(item => (
              <AccumulationAddressCard
                key={getPairKey(item.representative)}
                group={item}
              />
            ))}
          </ListCard>
        </CustomScrollView>

        <CustomButton
          textContent={t('screens.accumulationAddresses.createButton')}
          actionFunction={handleCreate}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // InfoDropdown already leaves 16 below; design gap is 20.
  sectionHeader: { marginTop: 4 },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },

  sectionTitle: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Medium,
    marginTop: 12,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    lineHeight: 18,
    paddingLeft: 8,
    marginBottom: 2,
  },
});
