import { useCallback, useMemo, useState } from 'react';
import { CENTER, ICONS, SIZES } from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSTransactions } from '../../../../../../context-store/pos';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';

export default function ViewPOSTransactions() {
  const { groupedTxs } = usePOSTransactions();
  const [employeeName, setEmployeeName] = useState('');
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();

  const filteredList = useMemo(() => {
    return !groupedTxs.length
      ? []
      : groupedTxs.filter(tx => {
          const [name] = tx;
          return name.toLowerCase()?.startsWith(employeeName.toLowerCase());
        });
  }, [groupedTxs, employeeName]);

  const transactionItem = useCallback(
    ({ item }) => {
      const [name, { totalTipAmount }] = item;
      return (
        <TouchableOpacity
          style={[
            styles.transactionCard,
            { backgroundColor: backgroundOffset },
          ]}
          onPress={() =>
            keyboardNavigate(() =>
              navigate.navigate('TotalTipsScreen', { item }),
            )
          }
        >
          <View style={styles.transactionInfo}>
            <ThemeText
              styles={styles.nameText}
              content={name}
              CustomNumberOfLines={1}
            />
            <ThemeText
              styles={styles.tipText}
              content={t('settings.posPath.transactions.unpaidtips', {
                number: displayCorrectDenomination({
                  amount: totalTipAmount,
                  masterInfoObject,
                  fiatStats,
                }),
              })}
              CustomNumberOfLines={1}
            />
          </View>
          <ThemeIcon iconName={'ChevronRight'} />
        </TouchableOpacity>
      );
    },
    [backgroundOffset, masterInfoObject, fiatStats, t, navigate],
  );

  return (
    <CustomKeyboardAvoidingView
      styles={styles.globalContainer}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        showLeftImage={false}
        leftImageBlue={ICONS.receiptIcon}
        LeftImageDarkMode={ICONS.receiptWhite}
        containerStyles={{ marginBottom: 0 }}
        label={t('settings.posPath.transactions.title')}
      />
      <View style={{ flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER }}>
        <CustomSearchInput
          placeholderText={t(
            'settings.posPath.transactions.empNamePlaceholder',
          )}
          inputText={employeeName}
          setInputText={setEmployeeName}
          containerStyles={styles.searchContainer}
        />
        {filteredList.length ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            style={styles.flatList}
            contentContainerStyle={{ paddingBottom: bottomPadding + 16 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            data={filteredList}
            renderItem={transactionItem}
            keyExtractor={([name]) => name}
          />
        ) : (
          <ThemeText
            styles={styles.emptyText}
            content={
              groupedTxs.length
                ? t('settings.posPath.transactions.noTips')
                : t('settings.posPath.transactions.noEmployees')
            }
          />
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0 },
  searchContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  flatList: {
    width: '100%',
  },
  transactionCard: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameText: {
    includeFontPadding: false,
  },
  tipText: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
    marginTop: 2,
  },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
  },
});
