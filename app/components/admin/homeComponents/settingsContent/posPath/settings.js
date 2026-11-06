import { useState, useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import { useTheme } from '../../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useImageCache } from '../../../../../../context-store/imageCache';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import BrandLogoUploader from './internalComponents/brandLogoUploader';
import { KeyboardController } from 'react-native-keyboard-controller';
import { getSavedPOSTransactions } from '../../../../../functions/pos';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

const RowValue = ({ text, icon }) => {
  const { tokens } = useTheme();
  return (
    <View style={styles.rowValue}>
      {icon}
      <ThemeText
        CustomNumberOfLines={1}
        styles={[styles.rowValueText, { color: tokens.muted }]}
        content={text}
      />
    </View>
  );
};

export default function PosSettingsPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { cache } = useImageCache();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { isConnectedToTheInternet } = useAppStatus();
  const storeName = masterInfoObject?.posSettings?.storeName;
  const [unpaidPeople, setUnpaidPeople] = useState(0);
  const logoKey = masterInfoObject?.posSettings?.brandLogo;
  const cachedImageData = logoKey ? cache?.[logoKey] : null;

  const brandLogoUri = cachedImageData?.localUri || null;
  const brandLogoUpdated = cachedImageData?.updated || null;

  const { bottomPadding } = useGlobalInsets();

  const currentCurrency = masterInfoObject?.posSettings?.storeCurrency;
  const posItemsList = masterInfoObject?.posSettings?.items || [];

  const showErrorIcon = posItemsList.filter(
    item => item.initialCurrency !== currentCurrency,
  ).length;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSavedPOSTransactions().then(txs => {
        if (!active || !txs) return;
        const people = new Set(
          txs
            .filter(tx => !tx.didPay && !!tx.serverName?.length)
            .map(tx => tx.serverName?.toLowerCase()?.trim()),
        );
        setUnpaidPeople(people.size);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const savePOSSettings = async newData => {
    toggleMasterInfoObject({
      posSettings: {
        ...masterInfoObject.posSettings,
        ...newData,
      },
    });
  };

  const handleLogoChange = useCallback(() => {
    savePOSSettings({ brandLogo: masterInfoObject.uuid + '_POS' });
  }, [savePOSSettings, masterInfoObject.uuid]);

  const handleLogoRemove = useCallback(() => {
    savePOSSettings({ brandLogo: null });
  }, [savePOSSettings]);

  const handleCurrencyChange = useCallback(
    async currencyId => {
      await KeyboardController.dismiss();
      savePOSSettings({ storeCurrency: currencyId });
    },
    [savePOSSettings],
  );

  const openCurrencySelect = useCallback(async () => {
    await KeyboardController.dismiss();
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'posCurrencySelect',
      currentCurrency,
      onSelectCurrency: handleCurrencyChange,
    });
  }, [navigate, currentCurrency, handleCurrencyChange]);

  const handleOpenPOS = useCallback(() => {
    openWebBrowser({
      navigate,
      link: `https://pay.blitzwalletapp.com/${storeName}`,
    });
  }, [storeName, navigate]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.settings.title')}
          shouldDismissKeyboard={true}
        />
        <CustomScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BrandLogoUploader
            onLogoChange={handleLogoChange}
            onLogoRemove={handleLogoRemove}
            masterInfoObject={masterInfoObject}
            cachedImageData={cachedImageData}
            brandLogoUri={brandLogoUri}
            brandLogoUpdated={brandLogoUpdated}
          />

          <SectionHeader
            title={t('settings.posPath.settings.storeNameInputDesc')}
          />
          <ListCard>
            <ListRow
              onPress={() => navigate.navigate('EditStoreNamePage')}
              lead={<Disc icon={'Pencil'} />}
              title={t('settings.posPath.settings.storeNameInputDesc')}
              titleStyle={styles.rowTitle}
              minHeight={52}
              trailing={<RowValue text={storeName} />}
              showChevron={true}
              chevronSize={18}
            />
          </ListCard>

          <SectionHeader title={t('settings.posPath.settings.prices')} />
          <ListCard dividerInset={64}>
            <ListRow
              onPress={openCurrencySelect}
              lead={<Disc icon={'Banknote'} />}
              title={t('settings.posPath.settings.currency')}
              titleStyle={styles.rowTitle}
              minHeight={52}
              trailing={<RowValue text={currentCurrency} />}
              showChevron={true}
              chevronSize={18}
            />
            <ListRow
              onPress={() => navigate.navigate('AddPOSItemsPage')}
              lead={<Disc icon={'Tag'} />}
              title={t('settings.posPath.settings.items')}
              titleStyle={styles.rowTitle}
              minHeight={52}
              accessibilityLabel={
                showErrorIcon
                  ? `${t('settings.posPath.settings.items')}, ${t(
                      'settings.posPath.settings.itemsCurrencyWarning',
                    )}`
                  : undefined
              }
              trailing={
                <RowValue
                  text={t('settings.posPath.settings.itemsCount', {
                    count: posItemsList.length,
                  })}
                  icon={
                    !!showErrorIcon && (
                      <ThemeIcon
                        redesign
                        size={16}
                        colorOverride={tokens.danger}
                        iconName={'TriangleAlert'}
                      />
                    )
                  }
                />
              }
              showChevron={true}
              chevronSize={18}
            />
          </ListCard>

          <SectionHeader
            title={t('settings.posPath.settings.runningTheStore')}
          />
          <ListCard dividerInset={64}>
            <ListRow
              onPress={() =>
                keyboardNavigate(() => {
                  if (!isConnectedToTheInternet) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('errormessages.nointernet'),
                    });
                    return;
                  }
                  navigate.navigate('POSStack');
                })
              }
              lead={<Disc icon={'Receipt'} />}
              title={t('settings.posPath.settings.tipsToPay')}
              titleStyle={styles.rowTitle}
              minHeight={52}
              trailing={
                !!unpaidPeople && (
                  <RowValue
                    text={t('settings.posPath.settings.peopleCount', {
                      count: unpaidPeople,
                    })}
                  />
                )
              }
              showChevron={true}
              chevronSize={18}
            />
            <ListRow
              onPress={() => navigate.navigate('POSInstructionsPath')}
              lead={<Disc icon={'Printer'} />}
              title={t('settings.posPath.settings.staffSign')}
              titleStyle={styles.rowTitle}
              minHeight={52}
              showChevron={true}
              chevronSize={18}
            />
          </ListCard>
        </CustomScrollView>

        <CustomButton
          actionFunction={handleOpenPOS}
          textContent={t('settings.posPath.settings.openPos')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollView: {
    flex: 1,
  },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  rowValueText: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
});
