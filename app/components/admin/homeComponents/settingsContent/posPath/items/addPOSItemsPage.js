import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useMemo, useState } from 'react';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../../constants';
import { formatCurrency } from '../../../../../../functions/formatCurrency';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import { INSET_WINDOW_WIDTH } from '../../../../../../constants/theme';

export default function AddPOSItemsPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [posItemSearch, setPosItemSearch] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const posItems = masterInfoObject.posSettings.items || [];
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const currentCurrency = masterInfoObject.posSettings?.storeCurrency;

  const removePOSItem = itemUUID => {
    let posObject = JSON.parse(JSON.stringify(masterInfoObject?.posSettings));

    const newItemArray = posObject.items.filter(
      savedItem => savedItem.uuid !== itemUUID,
    );
    posObject.items = newItemArray;

    toggleMasterInfoObject({ posSettings: posObject });
  };

  const formattedElements = useMemo(() => {
    return posItems
      .map(item => {
        if (!item.name?.toLowerCase()?.startsWith(posItemSearch.toLowerCase()))
          return false;
        return (
          <View
            style={[
              styles.posItemContainer,
              { backgroundColor: backgroundOffset },
            ]}
            key={item.uuid}
          >
            <View style={styles.posItemInfo}>
              <ThemeText styles={styles.posItemName} content={item.name} />
              <ThemeText
                styles={styles.posItemPrice}
                content={
                  formatCurrency({
                    amount: item.price.toFixed(2),
                    code: masterInfoObject.posSettings?.storeCurrency,
                  })[0]
                }
              />
              {currentCurrency !== item.initialCurrency && (
                <ThemeText
                  styles={[
                    styles.posItemError,
                    {
                      color:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.cancelRed,
                    },
                  ]}
                  content={t(
                    'settings.posPath.items.addPOSItemsPage.denominationError',
                    {
                      currency1: item.initialCurrency,
                      currency2: currentCurrency,
                    },
                  )}
                />
              )}
            </View>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                onPress={() =>
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'addPOSItemsHalfModal',
                    initialSettings: item,
                  })
                }
              >
                <ThemeIcon iconName={'SquarePen'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  navigate.navigate('ConfirmActionPage', {
                    confirmFunction: () => removePOSItem(item.uuid),
                    confirmMessage: t(
                      'settings.posPath.items.addPOSItemsPage.deleteItemMessage',
                    ),
                  });
                }}
              >
                <ThemeIcon iconName={'Trash2'} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })
      .filter(Boolean);
  }, [posItemSearch, posItems, currentCurrency, backgroundOffset]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('settings.posPath.items.addPOSItemsPage.title')}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.scrollContent}
      >
        <CustomSearchInput
          inputText={posItemSearch}
          setInputText={setPosItemSearch}
          containerStyles={[styles.searchInput, { backgroundColor }]}
          placeholderText={t(
            'settings.posPath.items.addPOSItemsPage.itemSearchPlaceholder',
          )}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
        />
        {formattedElements.length ? (
          formattedElements
        ) : (
          <View style={styles.emptyState}>
            <ThemeText
              styles={styles.emptyStateText}
              content={
                posItems?.length
                  ? t('settings.posPath.items.addPOSItemsPage.noItemsSearch')
                  : t('settings.posPath.items.addPOSItemsPage.noItemsAdded')
              }
            />
          </View>
        )}
      </ScrollView>

      <CustomButton
        buttonStyles={styles.addItemButton}
        actionFunction={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'addPOSItemsHalfModal',
          })
        }
        textContent={t('settings.posPath.items.addPOSItemsPage.ctaBTN')}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    paddingTop: 8,
    gap: 16,
    ...CENTER,
  },
  posItemContainer: {
    width: '100%',
    borderRadius: 8,
    ...CENTER,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  posItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  posItemName: {
    textTransform: 'capitalize',
    includeFontPadding: false,
  },
  posItemPrice: {
    includeFontPadding: false,
  },
  posItemError: {
    includeFontPadding: false,
    fontSize: SIZES.small,
  },
  buttonsContainer: {
    width: 64,
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addItemButton: {
    width: INSET_WINDOW_WIDTH,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  searchInput: {
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
  emptyState: {
    marginTop: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    width: '90%',
    textAlign: 'center',
  },
});
