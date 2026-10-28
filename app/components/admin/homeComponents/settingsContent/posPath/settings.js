import { useState, useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  VALID_USERNAME_REGEX,
} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { canUsePOSName } from '../../../../../../db';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import {
  useGlobalThemeContext,
  useTheme,
} from '../../../../../../context-store/theme';
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
import UserInput from '../../../../../functions/CustomElements/redesign/UserInput';
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
  const { mode } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { isConnectedToTheInternet } = useAppStatus();
  const [storeNameInput, setStoreNameInput] = useState(
    masterInfoObject?.posSettings?.storeName,
  );
  // Name problems show under the field; the saved name stays as it was.
  const [nameError, setNameError] = useState('');
  const [unpaidPeople, setUnpaidPeople] = useState(0);
  const logoKey = masterInfoObject?.posSettings?.brandLogo;
  const cachedImageData = logoKey ? cache?.[logoKey] : null;

  const brandLogoUri = cachedImageData?.localUri || null;
  const brandLogoUpdated = cachedImageData?.updated || null;

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();

  const currentCurrency = masterInfoObject?.posSettings?.storeCurrency;
  const posItemsList = masterInfoObject?.posSettings?.items || [];

  const showErrorIcon = posItemsList.filter(
    item => item.initialCurrency !== currentCurrency,
  ).length;

  const nameChanged =
    masterInfoObject.posSettings.storeName.toLowerCase() !==
    storeNameInput.toLowerCase();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSavedPOSTransactions().then(txs => {
        if (!active || !txs) return;
        const people = new Set(
          txs
            .filter(tx => !tx.didPay)
            .map(tx => tx.serverName?.toLowerCase()?.trim()),
        );
        setUnpaidPeople(people.size);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const savePOSSettings = async (newData, type) => {
    if (type === 'storeName') {
      if (
        newData.storeNameLower === masterInfoObject.posSettings.storeNameLower
      ) {
        setNameError(t('settings.posPath.settings.nameTakenError'));
        return;
      }
      if (!VALID_USERNAME_REGEX.test(newData.storeNameLower)) {
        setNameError(t('settings.posPath.settings.nameRegexError'));
        return;
      }

      const isValidPosName = await canUsePOSName(
        'blitzWalletUsers',
        newData.storeNameLower,
      );
      if (!isValidPosName) {
        setNameError(t('settings.posPath.settings.nameTakenError'));
        return;
      }
    }
    toggleMasterInfoObject({
      posSettings: {
        ...masterInfoObject.posSettings,
        ...newData,
      },
    });
  };

  const handleLogoChange = useCallback(() => {
    savePOSSettings({ brandLogo: masterInfoObject.uuid + '_POS' }, 'brandLogo');
  }, [savePOSSettings, masterInfoObject.uuid]);

  const handleLogoRemove = useCallback(() => {
    savePOSSettings({ brandLogo: null }, 'brandLogo');
  }, [savePOSSettings]);

  const handleCurrencyChange = useCallback(
    async currencyId => {
      await KeyboardController.dismiss();
      savePOSSettings({ storeCurrency: currencyId }, 'currency');
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

  const handleNameChange = useCallback(text => {
    setNameError('');
    setStoreNameInput(text);
  }, []);

  const handleSaveOrOpen = useCallback(() => {
    if (nameChanged) {
      savePOSSettings(
        {
          storeName: storeNameInput.trim(),
          storeNameLower: storeNameInput.trim().toLowerCase(),
        },
        'storeName',
      );
      return;
    } else {
      openWebBrowser({
        navigate,
        link: `https://pay.blitzwalletapp.com/${masterInfoObject.posSettings.storeName}`,
      });
    }
  }, [
    nameChanged,
    masterInfoObject.posSettings.storeName,
    storeNameInput,
    navigate,
    savePOSSettings,
  ]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.settings.title')}
          shouldDismissKeyboard={true}
        />
        <CustomScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: isKeyboardActive
              ? CONTENT_KEYBOARD_OFFSET
              : bottomPadding,
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
          <UserInput
            value={storeNameInput}
            onChangeText={handleNameChange}
            placeholder={t(
              'settings.posPath.settings.storeNameInputPlaceholder',
            )}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            focusRing={true}
          />
          {nameError ? (
            <ThemeText
              styles={[
                styles.fieldNote,
                { color: mode === 'dim' ? tokens.ink : tokens.danger },
              ]}
              content={nameError}
            />
          ) : (
            <ThemeText
              styles={[styles.fieldNote, { color: tokens.muted }]}
              content={[
                t('settings.posPath.settings.yourCheckout'),
                <ThemeText
                  key="link"
                  styles={styles.fieldNote}
                  content={`pay.blitzwalletapp.com/${storeNameInput}`}
                />,
              ]}
            />
          )}

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
                        colorOverride={
                          mode === 'dim' ? tokens.ink : tokens.danger
                        }
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

        {!isKeyboardActive && (
          <CustomButton
            buttonStyles={{ marginBottom: bottomPadding }}
            actionFunction={handleSaveOrOpen}
            textContent={
              nameChanged
                ? t('constants.save')
                : t('settings.posPath.settings.openPos')
            }
            size={'regular'}
          />
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollView: {
    flex: 1,
  },
  fieldNote: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginHorizontal: 4,
    includeFontPadding: false,
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
