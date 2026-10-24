import { StyleSheet, View } from 'react-native';
import GetThemeColors from '../../../../hooks/themeColors';
import { FONT, ICONS } from '../../../../constants';
import { COLORS } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useTranslation } from 'react-i18next';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomButton from '../../../../functions/CustomElements/button';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import Note from '../../../../functions/CustomElements/redesign/Note';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';

// Sheet chrome around the content: grab area (10 + 5) + 34 bottom padding.
const SHEET_CHROME = 49;

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
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, tokens } = GetThemeColors();
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

  const isLightsOut = theme && darkModeType;
  const options = [
    {
      value: 'btc',
      title: t('constants.bitcoin_upper'),
      sub: t('contacts.remotePaymentCurrencySelect.arriveAsSats'),
      icon: ICONS.bitcoinIcon,
      color: COLORS.bitcoinOrange,
    },
    {
      value: 'usd',
      title: t('constants.dollars_upper'),
      sub: t('contacts.remotePaymentCurrencySelect.arriveAsDollars'),
      icon: ICONS.dollarIcon,
      color: COLORS.dollarGreen,
    },
  ];

  return (
    <View
      style={styles.innerContainer}
      onLayout={e =>
        setContentHeight(Math.round(e.nativeEvent.layout.height) + SHEET_CHROME)
      }
    >
      <PageHeader
        title={t('contacts.remotePaymentCurrencySelect.title')}
        sub={t('contacts.remotePaymentCurrencySelect.description')}
      />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('contacts.remotePaymentCurrencySelect.title')}
      >
        <ListCard dividerInset={72}>
          {options.map(option => (
            <PickRow
              key={option.value}
              minHeight={76}
              titleStyle={styles.optionTitle}
              lead={
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isLightsOut
                        ? backgroundOffset
                        : option.color,
                    },
                  ]}
                >
                  <ThemeImage
                    styles={styles.icon}
                    lightModeIcon={option.icon}
                    darkModeIcon={option.icon}
                    lightsOutIcon={option.icon}
                  />
                </View>
              }
              title={option.title}
              sub={option.sub}
              selected={selectedCurrency === option.value}
              onPress={() => setSelectedCurrency(option.value)}
            />
          ))}
        </ListCard>
      </View>

      {selectedCurrency === 'usd' && (
        <View style={styles.note}>
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
      )}
      <CustomButton
        buttonStyles={{ marginTop: selectedCurrency === 'usd' ? 16 : 20 }}
        textContent={t('constants.done')}
        actionFunction={onDone}
        size="regular"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { width: 24, height: 24 },
  optionTitle: { fontSize: 15, lineHeight: 21 },
  note: { marginTop: 20, paddingHorizontal: 4 },
});
