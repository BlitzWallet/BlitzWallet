import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../functions';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useToast } from '../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../constants/theme';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useImageCache } from '../../../context-store/imageCache';
import GetThemeColors from '../../hooks/themeColors';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useGlobalThemeContext } from '../../../context-store/theme';

export default function TechnicalTransactionDetails(props) {
  console.log('Transaction Detials Page');
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { sparkInformation } = useSparkWallet();
  const { decodedAddedContacts } = useGlobalContacts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { cache } = useImageCache();
  const { backgroundColor, backgroundOffset } = GetThemeColors();

  const { transaction } = props.route.params;

  const { details, sparkID } = transaction;

  const isBulkPayment = !!details?.isBulkPayment;
  const bulkPaymentGroup = details?.bulkPaymentGroup ?? [];

  // Show per-person breakdown only when the split is unequal
  const successfulGroup = bulkPaymentGroup.filter(e => e.status !== 'failed');

  const isLRC20Payment = details?.isLRC20Payment;
  const selectedToken = isLRC20Payment
    ? sparkInformation.tokens?.[details?.LRC20Token]
    : '';
  const isPending = transaction.paymentStatus === 'pending';

  const paymentDetails =
    transaction.paymentType === 'spark'
      ? details.isLRC20Payment
        ? [t('screens.inAccount.technicalTransactionDetails.txHash')]
        : [t('screens.inAccount.technicalTransactionDetails.paymentId')]
      : transaction.paymentType === 'lightning'
      ? [
          t('screens.inAccount.technicalTransactionDetails.paymentId'),
          t('screens.inAccount.technicalTransactionDetails.preimage'),
          t('screens.inAccount.technicalTransactionDetails.address'),
        ]
      : [
          t('screens.inAccount.technicalTransactionDetails.paymentId'),
          t('screens.inAccount.technicalTransactionDetails.bitcoinTxId'),
          t('screens.inAccount.technicalTransactionDetails.address'),
          t('screens.inAccount.technicalTransactionDetails.paymentExp'),
        ].slice(0, details.direction === 'OUTGOING' && isPending ? 4 : 3);

  const infoElements = paymentDetails.map((item, id) => {
    const txItem =
      transaction.paymentType === 'spark'
        ? sparkID
        : transaction.paymentType === 'lightning'
        ? id === 0
          ? sparkID
          : id === 1
          ? details.preimage
          : details.address
        : id === 0
        ? sparkID
        : id === 1
        ? details.onChainTxid
        : id === 2
        ? details.address
        : details.expiresAt || 'N/A';

    return (
      <View key={id}>
        <View style={styles.headerContainer}>
          <ThemeText content={item} styles={{ ...styles.headerText }} />
          {!isPending && !txItem && (
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('InformationPopup', {
                  textContent: t(
                    'screens.inAccount.technicalTransactionDetails.noInformationLabel',
                    { item },
                  ),
                  buttonText: t('constants.understandText'),
                });
              }}
            >
              <ThemeIcon size={20} iconName={'Info'} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (
              transaction.paymentType === 'bitcoin' &&
              item ===
                t('screens.inAccount.technicalTransactionDetails.bitcoinTxId')
            ) {
              navigate.navigate('CustomWebView', {
                webViewURL: `https://mempool.space/tx/${txItem}`,
              });
              return;
            }
            copyToClipboard(txItem, showToast);
          }}
        >
          <ThemeText
            CustomNumberOfLines={2}
            content={txItem || 'N/A'}
            styles={{ ...styles.descriptionText }}
          />
        </TouchableOpacity>
      </View>
    );
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.innerContainer}
      >
        {infoElements}
        <ThemeText
          content={t(
            'screens.inAccount.technicalTransactionDetails.amountBreakdown',
            { defaultValue: 'Amount Breakdown' },
          )}
          styles={styles.headerText}
        />

        {isBulkPayment && (
          <View
            style={[
              styles.amountsBreakdown,
              { backgroundColor: backgroundOffset },
            ]}
          >
            {successfulGroup.map((entry, index) => {
              const contact = decodedAddedContacts?.find(
                c => c.uuid === entry.contactUUID,
              );
              const displayName =
                contact?.name || contact?.uniqueName || entry.contactUUID;
              const transferId = entry?.transferId || '';

              // BTC: raw sats passed directly.
              // USD: amountCents * 10_000 = micros (matches DB amount unit and
              //      what FormattedSatText + formatTokensNumber expect for LRC20).
              const rawAmount = isLRC20Payment
                ? (entry.amountCents ?? 0) * 10_000
                : entry.amountSats ?? 0;
              const displayBalance = isLRC20Payment
                ? formatTokensNumber(
                    rawAmount,
                    selectedToken?.tokenMetadata?.decimals,
                  )
                : rawAmount;

              const isLast = index === successfulGroup.length - 1;

              return (
                <TouchableOpacity
                  onPress={() => copyToClipboard(transferId, showToast)}
                  key={entry.contactUUID}
                >
                  <View style={styles.infoRow}>
                    <View
                      style={[
                        styles.profileImage,
                        { backgroundColor: backgroundColor },
                      ]}
                    >
                      <ContactProfileImage
                        updated={cache[entry.contactUUID]?.updated}
                        uri={cache[entry.contactUUID]?.localUri}
                        darkModeType={darkModeType}
                        theme={theme}
                      />
                    </View>
                    <View style={styles.transactionRow}>
                      <ThemeText
                        content={displayName}
                        styles={styles.infoName}
                        CustomNumberOfLines={1}
                      />
                      {!isLRC20Payment && (
                        <ThemeText
                          content={
                            transferId.slice(0, 6) +
                            '...' +
                            transferId.slice(transferId.length - 6)
                          }
                          styles={styles.infoNameSmall}
                          CustomNumberOfLines={1}
                        />
                      )}
                    </View>
                    <FormattedSatText
                      neverHideBalance={true}
                      styles={styles.infoValue}
                      balance={displayBalance}
                      useCustomLabel={isLRC20Payment}
                      customLabel={selectedToken?.tokenMetadata?.tokenTicker}
                      useMillionDenomination={true}
                    />
                  </View>
                  {!isLast && (
                    <View style={[styles.rowDivider, { backgroundColor }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {/* {transaction.paymentType === 'spark' && (
          <ThemeText
            content={t(
              'screens.inAccount.technicalTransactionDetails.privacyMessage',
              {
                type: t(
                  `screens.inAccount.technicalTransactionDetails.${
                    details?.direction === 'OUTGOING' ? 'receivers' : 'senders'
                  }`,
                ),
              },
            )}
          />
        )} */}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  headerText: { includeFontPadding: false, marginRight: 5 },
  descriptionText: {
    marginBottom: 30,
  },
  amountsBreakdown: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoName: {
    // flex: 1,
    includeFontPadding: false,
  },
  infoNameSmall: {
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
  },
  infoValue: {
    marginLeft: 8,
  },
  rowDivider: {
    height: 1,
  },
  transactionRow: {
    flex: 1,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
});
