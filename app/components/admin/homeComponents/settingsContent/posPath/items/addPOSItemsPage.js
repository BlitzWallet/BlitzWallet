import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useMemo, useState } from 'react';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { formatCurrency } from '../../../../../../functions/formatCurrency';
import {
  useGlobalThemeContext,
  useTheme,
} from '../../../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../../../functions/CustomElements/redesign/SearchField';
import EmptyState from '../../../../../../functions/CustomElements/redesign/EmptyState';
import ListCard from '../../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../../functions/CustomElements/redesign/ListRow';
import IconButton from '../../../../../../functions/CustomElements/redesign/IconButton';

export default function AddPOSItemsPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { mode } = useGlobalThemeContext();
  const { tokens } = useTheme();
  const [posItemSearch, setPosItemSearch] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const posItems = masterInfoObject.posSettings.items || [];
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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

        const otherCurrency = currentCurrency !== item.initialCurrency;
        const price = formatCurrency({
          amount: item.price.toFixed(2),
          code: otherCurrency ? item.initialCurrency : currentCurrency,
        })[0];

        return (
          <ListRow
            key={item.uuid}
            title={otherCurrency ? `${item.name} · ${price}` : item.name}
            sub={
              otherCurrency
                ? t(
                    'settings.posPath.items.addPOSItemsPage.denominationError',
                    {
                      currency1: item.initialCurrency,
                      currency2: currentCurrency,
                    },
                  )
                : price
            }
            minHeight={64}
            titleStyle={styles.title}
            subStyle={[
              styles.sub,
              otherCurrency && {
                color: mode === 'dim' ? tokens.ink : tokens.danger,
              },
            ]}
            trailing={
              <View style={styles.buttons}>
                <IconButton
                  icon={'Pencil'}
                  iconSize={18}
                  iconColor={tokens.muted}
                  label={t('settings.posPath.items.addPOSItemsPage.editItem', {
                    name: item.name,
                  })}
                  onPress={() =>
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'addPOSItemsHalfModal',
                      initialSettings: item,
                    })
                  }
                />
                <IconButton
                  icon={'Trash2'}
                  iconSize={18}
                  iconColor={tokens.muted}
                  label={t(
                    'settings.posPath.items.addPOSItemsPage.deleteItem',
                    { name: item.name },
                  )}
                  onPress={() => {
                    navigate.navigate('ConfirmDialog', {
                      title: t(
                        'settings.posPath.items.addPOSItemsPage.deleteItemTitle',
                        { name: item.name },
                      ),
                      message: t(
                        'settings.posPath.items.addPOSItemsPage.deleteItemMessage',
                      ),
                      cancelLabel: t('constants.cancel'),
                      confirmLabel: t('constants.delete'),
                      onConfirm: () => removePOSItem(item.uuid),
                    });
                  }}
                />
              </View>
            }
          />
        );
      })
      .filter(Boolean);
  }, [posItemSearch, posItems, currentCurrency, tokens, t]);

  if (!posItems.length) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar
            title={t('settings.posPath.items.addPOSItemsPage.title')}
            shouldDismissKeyboard={true}
          />
          <View style={styles.empty}>
            <EmptyState
              icon={'Tag'}
              iconTone="ink"
              title={t('settings.posPath.items.addPOSItemsPage.noPosTitle')}
              sub={t('settings.posPath.items.addPOSItemsPage.noPosSub')}
            />
          </View>
          <CustomButton
            actionFunction={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'addPOSItemsHalfModal',
              })
            }
            textContent={t('settings.posPath.items.addPOSItemsPage.ctaBTN')}
            size={'regular'}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.items.addPOSItemsPage.title')}
          shouldDismissKeyboard={true}
        />
        <View style={styles.search}>
          <SearchField
            value={posItemSearch}
            onChangeText={setPosItemSearch}
            placeholder={t(
              'settings.posPath.items.addPOSItemsPage.itemSearchPlaceholder',
            )}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            pill
          />
        </View>
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {formattedElements.length ? (
            <ListCard>{formattedElements}</ListCard>
          ) : (
            <View>
              <ThemeText
                styles={styles.emptyStateText}
                content={t(
                  'settings.posPath.items.addPOSItemsPage.noItemsSearch',
                )}
              />
            </View>
          )}
        </CustomScrollView>

        <CustomButton
          actionFunction={() =>
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'addPOSItemsHalfModal',
            })
          }
          textContent={t('settings.posPath.items.addPOSItemsPage.ctaBTN')}
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  search: { marginTop: 16 },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: { fontSize: 15, lineHeight: 21 },
  sub: { fontSize: 13, lineHeight: 19 },
  buttons: { flexDirection: 'row' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    width: '100%',
    textAlign: 'center',
  },
});
