import { StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import CurrencyIcon, {
  ASSET_ICON_ROW,
  ASSET_ROW_HEIGHT,
  assetDividerInset,
} from '../../../../functions/CustomElements/redesign/CurrencyIcon';
import { useTranslation } from 'react-i18next';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomButton from '../../../../functions/CustomElements/button';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import Note from '../../../../functions/CustomElements/redesign/Note';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';

// Sheet chrome around the content: grab area (10 + 5 + 5) + 34 bottom padding.
const SHEET_CHROME = 54;

// D163/D164: two radio rows; Dollars adds the minimum note above Done and the
// sheet grows to fit. Done always closes and only writes on a change (Q12-17).
export default function LnurlReceiveCurrencySelect({
  handleBackPressFunction,
  setContentHeight,
  accountsLnurlId,
}) {
  const { masterInfoObject, toggleMasterInfoObject, updateAccountsLnurlEntry } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { t } = useTranslation();

  // When opened from a sub-account's LNURL page, currency lives on that
  // account's accountsLnurl registry entry instead of the global setting.
  const subAccountEntry = accountsLnurlId
    ? masterInfoObject.accountsLnurl?.[accountsLnurlId]
    : null;

  const currentCurrency =
    (subAccountEntry?.receiveCurrency ??
      masterInfoObject.lnurlReceiveCurrency) === 'usd'
      ? 'usd'
      : 'btc';
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);

  const hasChanged = selectedCurrency !== currentCurrency;

  // Measured sizes, so a pick resizes the sheet in the same render as the
  // note appears or goes (no frame at the old size under reduced motion).
  const sheetHeightRef = useRef(0);
  const noteHeightRef = useRef(0);
  const pickCurrency = value => {
    if (value !== selectedCurrency && sheetHeightRef.current) {
      // Note height + its 20 top margin, minus Done's margin drop (20 → 16).
      const noteSpace = noteHeightRef.current + 16;
      setContentHeight(
        sheetHeightRef.current + (value === 'usd' ? noteSpace : -noteSpace),
      );
    }
    setSelectedCurrency(value);
  };

  const onDone = () => {
    if (!hasChanged) {
      handleBackPressFunction();
      return;
    }
    handleBackPressFunction(() => {
      if (subAccountEntry) {
        // Narrow single-entry write: never ships a stale whole-registry
        // snapshot that could clobber concurrent updates from other devices.
        updateAccountsLnurlEntry(accountsLnurlId, {
          receiveCurrency: selectedCurrency,
        });
      } else {
        toggleMasterInfoObject({ lnurlReceiveCurrency: selectedCurrency });
      }
      navigate.goBack();
    });
  };

  const options = [
    {
      value: 'btc',
      title: t('constants.bitcoin_upper'),
      isBitcoin: true,
    },
    {
      value: 'usd',
      title: t('constants.dollars_upper'),
    },
  ];

  return (
    <View
      onLayout={e => {
        sheetHeightRef.current =
          Math.round(e.nativeEvent.layout.height) + SHEET_CHROME;
        setContentHeight(sheetHeightRef.current);
      }}
    >
      <SheetHeader
        first
        title={t('contacts.remotePaymentCurrencySelect.title')}
        sub={t(
          accountsLnurlId
            ? 'contacts.remotePaymentCurrencySelect.subAccountDescription'
            : 'contacts.remotePaymentCurrencySelect.description',
        )}
      />
      <View
        style={{ marginBottom: 20 }}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('contacts.remotePaymentCurrencySelect.title')}
      >
        <ListCard dividerInset={assetDividerInset(ASSET_ICON_ROW)}>
          {options.map(option => (
            <PickRow
              key={option.value}
              minHeight={ASSET_ROW_HEIGHT}
              lead={
                <CurrencyIcon
                  size={ASSET_ICON_ROW}
                  isBitcoin={option.isBitcoin}
                />
              }
              title={option.title}
              selected={selectedCurrency === option.value}
              onPress={() => pickCurrency(option.value)}
            />
          ))}
        </ListCard>
      </View>

      {/* Always mounted (out of flow when hidden) so its height is known
          before the pick. */}
      <View
        style={[styles.note, selectedCurrency !== 'usd' && styles.hidden]}
        accessibilityElementsHidden={selectedCurrency !== 'usd'}
        importantForAccessibility={
          selectedCurrency === 'usd' ? 'auto' : 'no-hide-descendants'
        }
        onLayout={e => {
          noteHeightRef.current = Math.round(e.nativeEvent.layout.height);
        }}
      >
        <Note
          tone="warn"
          text={t('contacts.remotePaymentCurrencySelect.warningMessage', {
            amount: displayCorrectDenomination({
              amount: 2000,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'sats',
              },
              fiatStats,
            }),
          })}
        />
      </View>
      <CustomButton
        buttonStyles={{ marginTop: 'auto' }}
        textContent={t('constants.done')}
        actionFunction={onDone}
        size="regular"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 0, marginBottom: 16 },
  // Out of flow but still laid out, so it keeps its real height.
  hidden: { position: 'absolute', left: 0, right: 0, opacity: 0 },
});
