import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import {
  APPROXIMATE_SYMBOL,
  COLORS,
  FONT,
  ICONS,
  TOKEN_TICKER_MAX_LENGTH,
  USDB_TOKEN_ID,
} from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../functions/CustomElements';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../functions/CustomElements/button';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import UserInput from '../../functions/CustomElements/redesign/UserInput';
import AdaptiveButtonRow from '../../functions/CustomElements/adaptiveButtonRow';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useSparkWallet } from '../../../context-store/sparkContext';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context-store/toastManager';
import { formatLocalTimeShort } from '../../functions/timeFormatter';
import {
  bulkUpdateSparkTransactions,
  getSingleSparkTransaction,
  getSwapResultTransaction,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../../functions/spark/transactions';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../context-store/context';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { useImageCache } from '../../../context-store/imageCache';
import { currentPriceAinBToPriceDollars } from '../../functions/spark/flashnet';
import { formatBalanceAmount, copyToClipboard } from '../../functions';
import {
  claimSparkHodlLightningPayment,
  querySparkHodlLightningPayments,
} from '../../functions/spark';
import { useKeysContext } from '../../../context-store/keys';
import { decryptMessage } from '../../functions/messaging/encodingAndDecodingMessages';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { useNavigateToContact } from '../../components/admin/homeComponents/contacts/utils/navigateToExpandedContact';
import { isOrchestraSwapFailed } from '../../functions/spark/orchestraLightning';
import { getRootstockSwapStatusLabel } from '../../functions/boltz/rootstock/swapProgress';
import { uses24HourClock } from 'react-native-localize';
import openWebBrowser from '../../functions/openWebBrowser';
import { getNormalizedWebsiteUrl } from '../../functions/getNormalizedWebsiteUrl';

// Sheet chrome around the content: grab area (10 + 5) + 34 bottom padding.
const SHEET_CHROME = 49;

// Was the separate Technical details page; now the "More details" rows.
function getTechnicalRows(transaction, t) {
  const { details, sparkID } = transaction;
  const isPending = transaction.paymentStatus === 'pending';
  const isConfirmed = transaction.paymentStatus === 'completed';
  const label = key =>
    t(`screens.inAccount.technicalTransactionDetails.${key}`);

  if (transaction.paymentType === 'spark') {
    if (details.isFlashnetStablecoin) {
      return [
        [label('paymentId'), sparkID],
        [label('quoteId'), details.quoteId],
        [label('destinationAddress'), details.destinationAddress],
        [label('destinationAsset'), details.destinationAsset],
        [label('destinationChain'), details.destinationChain],
      ];
    }
    if (details.isLRC20Payment) return [[label('txHash'), sparkID]];
    return [[label('paymentId'), sparkID]];
  }

  if (transaction.paymentType === 'lightning') {
    const rows = [
      [label('paymentId'), sparkID],
      [label('preimage'), details.preimage],
      [label('address'), details.address],
    ];
    if (details.isRootstockSwap) {
      rows.push([label('rootstockSwapId'), details.rootstockSwapId]);
      if (!isConfirmed) {
        rows.push(
          [label('rootstockSwapStatus'), details.rootstockSwapStatus],
          [
            label('rootstockPaymentTxId'),
            details.rootstockPaymentTxId || details.lockTxHash,
          ],
        );
      }
    }
    if (details.bitrefillInvoiceId) {
      rows.push([label('bitrefillInvoiceId'), details.bitrefillInvoiceId]);
    }
    return rows;
  }

  // bitcoin
  const rows = [
    [label('paymentId'), sparkID],
    [label('bitcoinTxId'), details.onChainTxid],
    [label('address'), details.address],
    [label('paymentExp'), details.expiresAt || 'N/A'],
  ];
  return rows.slice(0, details.direction === 'OUTGOING' && isPending ? 4 : 3);
}

function DetailRow({
  label,
  value,
  valueColor,
  mono,
  onPress,
  icon,
  onIconPress,
  lines = 1,
}) {
  const { tokens } = useGlobalThemeContext();
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container onPress={onPress} style={styles.row}>
      <ThemeText
        CustomNumberOfLines={1}
        content={label}
        styles={[styles.rowLabel, { color: tokens.muted }]}
      />
      <ThemeText
        CustomNumberOfLines={lines}
        CustomEllipsizeMode={mono ? 'middle' : 'tail'}
        content={value}
        styles={[
          styles.rowValue,
          mono && styles.rowValueMono,
          { color: valueColor || tokens.ink },
        ]}
      />
      {!!icon && (
        <TouchableOpacity
          onPress={onIconPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={styles.rowButton}
        >
          <ThemeIcon
            redesign
            iconName={icon}
            size={16}
            colorOverride={tokens.muted}
          />
        </TouchableOpacity>
      )}
    </Container>
  );
}

export default function ExpandedTx({
  transaction: initialTransaction,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { decodedAddedContacts } = useGlobalContactsInfo();
  const { cache } = useImageCache();
  const { sparkInformation, tokensImageCache } = useSparkWallet();
  const navigate = useNavigation();
  const { theme, darkModeType, tokens } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey, publicKey: contactsPublicKey } = useKeysContext();
  const [isClaimingHtlc, setIsClaimingHtlc] = useState(false);
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { showToast } = useToast();
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState('');
  const didCancelMemoRef = useRef(false);
  const didRunMemoSaveRef = useRef(false);
  const scrollRef = useRef(null);

  const claimHTLCLabel = t('screens.inAccount.expandedTxPage.claimPayment');
  const contactSupportLabel = t(
    'screens.inAccount.expandedTxPage.contactSupport',
  );
  const viewProgressLabel = t('screens.inAccount.expandedTxPage.viewProgress');
  const moreDetailsLabel = t(
    showMoreDetails
      ? 'screens.inAccount.expandedTxPage.showLess'
      : 'screens.inAccount.expandedTxPage.moreDetails',
  );

  const [transaction, setTransaction] = useState(initialTransaction);

  const isBulkPayment = !!transaction.details?.isBulkPayment;
  const bulkPaymentGroup = transaction.details?.bulkPaymentGroup ?? [];
  const successfulGroup = bulkPaymentGroup.filter(e => e.status !== 'failed');

  const showLNOrchestraAsFailed = isOrchestraSwapFailed(transaction);

  const isFailedPayment =
    transaction.paymentStatus === 'failed' || showLNOrchestraAsFailed;
  const isPending = transaction.paymentStatus === 'pending';
  const isOutgoing = transaction.details.direction === 'OUTGOING';

  const showViewProgress =
    isPending &&
    transaction.paymentType === 'bitcoin' &&
    !!transaction.details?.onChainTxid;

  const secondaryLabel = isFailedPayment
    ? contactSupportLabel
    : showViewProgress
    ? viewProgressLabel
    : null;

  const showSuccessActionLabel = transaction.details?.successAction;

  useEffect(() => {
    const selectedTx = initialTransaction;
    const isSwap = !!selectedTx.details?.performSwaptoUSD;

    async function handleUpdate() {
      try {
        const txFromDB = isSwap
          ? await getSwapResultTransaction(selectedTx.sparkID)
          : await getSingleSparkTransaction(selectedTx.id);
        if (!txFromDB) return;

        setTransaction(prev => {
          if (prev.paymentStatus !== txFromDB.paymentStatus) {
            return txFromDB; // details already parsed
          }
          return prev;
        });
      } catch (err) {
        console.log('Error updating tx in expanded view', err.message);
      }
    }

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    return () => {
      sparkTransactionsEventEmitter.removeListener(
        SPARK_TX_UPDATE_ENVENT_NAME,
        handleUpdate,
      );
    };
  }, []);

  // A tall sheet can't fit above the keyboard, so keep the memo field and
  // its Cancel / Save buttons in view.
  useEffect(() => {
    if (!isEditingMemo) return;
    const subscription = Keyboard.addListener('keyboardDidShow', () =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => subscription.remove();
  }, [isEditingMemo]);

  const localContact = useMemo(() => {
    if (!decodedAddedContacts) return undefined;
    return decodedAddedContacts?.find(
      contact => contact.uuid === transaction.details?.sendingUUID,
    );
  }, [decodedAddedContacts, transaction.details?.sendingUUID]);

  const remoteContact = transaction?.details?.remoteContactPayment;

  const selectedContact = localContact || remoteContact;
  const sendingContactUUID = selectedContact?.uuid;

  const showConversionLine =
    transaction?.details?.showSwapLabel &&
    !!transaction?.details?.currentPriceAInB;

  const isSuccessful = !isFailedPayment && !isPending;
  const paymentDate = new Date(transaction.details.time);
  const amount = transaction?.details?.amount;
  const description = transaction.details.description || '';

  const navigateToExpandedContact = useNavigateToContact();

  const handleSave = async newMemo => {
    try {
      if (newMemo === transaction.details.description) return;
      // deep copy
      let newTx = JSON.parse(JSON.stringify(transaction));
      newTx.details.description = newMemo;
      newTx.useTempId = true;
      newTx.id = transaction.sparkID;
      newTx.tempID = transaction.sparkID;

      await bulkUpdateSparkTransactions(
        [newTx],
        undefined,
        undefined,
        undefined,
        true,
      );

      setTransaction(newTx);
    } catch (err) {
      console.log(err);
    }
  };

  const claimHTLC = async () => {
    try {
      setIsClaimingHtlc(true);
      const decodedPreimage = decryptMessage(
        contactsPrivateKey,
        contactsPublicKey,
        transaction.details.encryptedPreimage,
      );

      const response = await claimSparkHodlLightningPayment({
        preimage: decodedPreimage,
        mnemonic: currentWalletMnemoinc,
      });
      const responseStatus = await querySparkHodlLightningPayments({
        paymentHashes: [transaction.details.paymentHash],
        mnemonic: currentWalletMnemoinc,
      });

      if (!response.didWork) throw new Error('Failed to claim preimage');
      if (response.didWork) {
        const htlcTrueStatus = responseStatus.paidPreimages;
        let newTx = JSON.parse(JSON.stringify(transaction));
        newTx.details.didClaimHTLC = true;
        newTx.details.preimage = decodedPreimage;
        newTx.id = transaction.sparkID;
        newTx.paymentStatus =
          htlcTrueStatus[0].status === 1 ? 'completed' : 'failed';
        await bulkUpdateSparkTransactions(
          [newTx],
          undefined,
          undefined,
          undefined,
          true,
        );
        setTransaction(newTx);
      }
    } catch (err) {
      console.log('Error claiming htlc in tx detials', err);

      const htlcStatus = await querySparkHodlLightningPayments({
        paymentHashes: [transaction.details.paymentHash],
        mnemonic: currentWalletMnemoinc,
      });

      if (htlcStatus.paidPreimages?.length) {
        const htlc = htlcStatus.paidPreimages[0];

        if (htlc.status === 2 || htlc.status === 1) {
          let newTx = JSON.parse(JSON.stringify(transaction));
          newTx.details.didClaimHTLC = true;
          newTx.id = transaction.sparkID;
          newTx.paymentStatus = htlc.status === 1 ? 'completed' : 'failed';

          await bulkUpdateSparkTransactions(
            [newTx],
            undefined,
            undefined,
            undefined,
            true,
          );
          setTransaction(newTx);
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Error when claiming payment.',
          });
        }
      }
    } finally {
      setIsClaimingHtlc(false);
    }
  };

  const handleContactSupport = () => {
    const fields = [
      ['Payment ID', transaction.sparkID],
      ['Quote ID', transaction.details?.quoteId],
      ['Destination Address', transaction.details?.destinationAddress],
      ['Destination Asset', transaction.details?.destinationAsset],
      ['Destination Chain', transaction.details?.destinationChain],
      ['Preimage', transaction.details?.preimage],
      ['Address', transaction.details?.address],
      ['Bitcoin TX ID', transaction.details?.onChainTxid],
    ];
    const body = fields
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    navigate.push('CustomHalfModal', {
      wantedContent: 'contactUs',
      emailSubject: 'Failed Payment Support',
      emailBody: body,
    });
  };

  const handleViewProgress = () =>
    navigate.navigate('CustomWebView', {
      webViewURL: `https://mempool.space/tx/${transaction.details.onChainTxid}`,
      headerText: viewProgressLabel,
    });

  // Memo editing: the pencil swaps the row for a field and the buttons for
  // Cancel / Save. Blur still saves, like the old memo box.
  const runMemoSave = async () => {
    if (didRunMemoSaveRef.current) return;
    didRunMemoSaveRef.current = true;
    if (!didCancelMemoRef.current) {
      await handleSave(memoText);
    }
    setIsEditingMemo(false);
    Keyboard.dismiss();
  };

  const handleEditMemo = () => {
    if (isEditingMemo) return;
    didCancelMemoRef.current = false;
    didRunMemoSaveRef.current = false;
    setMemoText(description);
    setIsEditingMemo(true);
  };

  const handleCancelMemo = () => {
    didCancelMemoRef.current = true;
    setMemoText(description);
    setIsEditingMemo(false);
    Keyboard.dismiss();
  };

  const isLRC20Payment = transaction.details.isLRC20Payment;
  const isUSDBPayment =
    isLRC20Payment && transaction.details.LRC20Token === USDB_TOKEN_ID;
  const selectedToken = isLRC20Payment
    ? sparkInformation.tokens?.[transaction.details.LRC20Token]
    : '';
  const formattedTokensBalance = formatTokensNumber(
    transaction?.details?.amount,
    selectedToken?.tokenMetadata?.decimals,
  );
  const showFeeInfoRow =
    transaction?.paymentType?.toLowerCase() !== 'bitcoin' ||
    (transaction?.paymentType?.toLowerCase() === 'bitcoin' &&
      transaction?.details?.direction === 'OUTGOING') ||
    (transaction?.paymentType?.toLowerCase() === 'bitcoin' &&
      transaction?.details?.direction === 'INCOMING' &&
      isSuccessful);

  const brantaMerchantName = transaction.details?.brantaMerchantName;
  const counterpartyName = brantaMerchantName
    ? brantaMerchantName
    : isBulkPayment
    ? successfulGroup
        .map(entry => {
          const contact = decodedAddedContacts?.find(
            c => c.uuid === entry.contactUUID,
          );
          return contact?.name || contact?.uniqueName;
        })
        .filter(Boolean)
        .join(', ')
    : selectedContact?.name || selectedContact?.uniqueName;

  const formatTime = date => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (uses24HourClock()) {
      return `${hours}:${minutes}`;
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  // External image first (merchant logo, contact photo, token logo), then
  // the asset's standard logo.
  const renderHeroIcon = () => {
    if (isBulkPayment) {
      // ponytail: first 5 avatars + a count disc; scroll if splits get huge.
      const shown = successfulGroup.slice(0, 5);
      const extra = successfulGroup.length - shown.length;
      return (
        <View style={styles.splitAvatars}>
          {shown.map((entry, index) => (
            <View
              key={entry.contactUUID}
              style={[
                styles.heroIcon,
                styles.splitAvatar,
                {
                  backgroundColor: tokens.disc,
                  borderColor: tokens.surface,
                  marginLeft: index === 0 ? 0 : -14,
                  zIndex: shown.length - index,
                },
              ]}
            >
              <ContactProfileImage
                updated={cache[entry.contactUUID]?.updated}
                uri={cache[entry.contactUUID]?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
          ))}
          {extra > 0 && (
            <View
              style={[
                styles.heroIcon,
                styles.splitAvatar,
                {
                  backgroundColor: tokens.disc,
                  borderColor: tokens.surface,
                  marginLeft: -14,
                },
              ]}
            >
              <ThemeText content={`+${extra}`} />
            </View>
          )}
        </View>
      );
    }

    const contactImage =
      sendingContactUUID && cache[sendingContactUUID]?.localUri;
    if (contactImage) {
      return (
        <View style={[styles.heroIcon, { backgroundColor: tokens.disc }]}>
          <ContactProfileImage
            updated={cache[sendingContactUUID]?.updated}
            uri={contactImage}
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>
      );
    }

    const externalImage =
      transaction.details?.brantaMerchantLogo ||
      (isLRC20Payment &&
        !isUSDBPayment &&
        tokensImageCache?.[transaction.details.LRC20Token]);
    if (externalImage) {
      return (
        <View style={[styles.heroIcon, { backgroundColor: tokens.disc }]}>
          <ExpoImage
            source={{ uri: externalImage }}
            style={styles.heroImage}
            contentFit="cover"
            transition={0}
          />
        </View>
      );
    }

    if (isLRC20Payment && !isUSDBPayment) {
      return (
        <View style={[styles.heroIcon, { backgroundColor: tokens.accent }]}>
          <ThemeIcon
            redesign
            iconName="Coins"
            size={28}
            colorOverride={tokens.onAccent}
          />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.heroIcon,
          {
            backgroundColor: isUSDBPayment
              ? COLORS.dollarGreen
              : COLORS.bitcoinOrange,
          },
        ]}
      >
        <ExpoImage
          source={isUSDBPayment ? ICONS.dollarIcon : ICONS.bitcoinIcon}
          style={styles.heroAssetLogo}
          contentFit="contain"
          transition={0}
        />
      </View>
    );
  };

  const renderSuccessAction = () => {
    if (!showSuccessActionLabel) return null;
    const { tag, description: linkText, url } = showSuccessActionLabel;
    if (tag !== 'url') return null;

    // Payee-controlled (LUD-09). Allow-list to https before it can be
    // opened so a javascript:/data: scheme can never reach the browser;
    // '' hides the row entirely (mirrors confirmTxPage).
    const safeUrl = getNormalizedWebsiteUrl(url);
    if (!safeUrl) return null;
    const openLink = () => openWebBrowser({ navigate, link: safeUrl });
    return (
      <TouchableOpacity onPress={openLink} style={styles.row}>
        <ThemeText
          CustomNumberOfLines={2}
          content={linkText}
          styles={[styles.rowValue, styles.successActionText]}
        />
        <View style={styles.rowButton}>
          <ThemeIcon
            redesign
            iconName="ExternalLink"
            size={16}
            colorOverride={tokens.muted}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderTechnicalRows = () => {
    const rows = getTechnicalRows(transaction, t).map(([label, value]) => {
      const missing = !isPending && !value;
      return (
        <DetailRow
          key={label}
          label={label}
          value={value || 'N/A'}
          mono={!!value}
          icon={value ? 'Copy' : missing ? 'Info' : null}
          onIconPress={() => {
            if (value) {
              copyToClipboard(value, showToast);
              return;
            }
            navigate.navigate('InformationPopup', {
              textContent: t(
                'screens.inAccount.technicalTransactionDetails.noInformationLabel',
                { item: label },
              ),
              buttonText: t('constants.understandText'),
            });
          }}
        />
      );
    });

    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <View style={[styles.solidDivider, { borderColor: tokens.divider }]} />
        {rows}
        {isBulkPayment && !!successfulGroup.length && (
          <>
            <ThemeText
              content={t(
                'screens.inAccount.technicalTransactionDetails.transferIds',
              )}
              styles={[styles.sectionLabel, { color: tokens.muted }]}
            />
            {successfulGroup.map(entry => {
              const contact = decodedAddedContacts?.find(
                c => c.uuid === entry.contactUUID,
              );
              const transferId = entry?.transferId || '';
              return (
                <DetailRow
                  key={entry.contactUUID}
                  label={
                    contact?.name || contact?.uniqueName || entry.contactUUID
                  }
                  value={isLRC20Payment ? '' : transferId}
                  mono={true}
                  icon={transferId ? 'Copy' : null}
                  onIconPress={() => copyToClipboard(transferId, showToast)}
                />
              );
            })}
          </>
        )}
      </Animated.View>
    );
  };

  // One status row: a Rootstock swap shows its step, a pending on-chain
  // payment shows the confirmations it waits for.
  const statusLabel =
    transaction.details?.isRootstockSwap &&
    transaction.paymentStatus !== 'completed' &&
    transaction.details.rootstockSwapStatus
      ? getRootstockSwapStatusLabel(transaction.details.rootstockSwapStatus)
      : isPending && transaction.paymentType === 'bitcoin'
      ? t('screens.inAccount.expandedTxPage.waitingForConfirmations', {
          count: 3,
        })
      : isPending
      ? t('transactionLabelText.pending')
      : isFailedPayment
      ? t('transactionLabelText.failed')
      : t('transactionLabelText.successful');
  const statusColor = isPending
    ? tokens.warn
    : isFailedPayment
    ? tokens.danger
    : tokens.ink;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={styles.content}
        onLayout={e =>
          setContentHeight?.(
            Math.round(e.nativeEvent.layout.height) + SHEET_CHROME,
          )
        }
      >
        <ThemeText
          styles={styles.title}
          content={
            isFailedPayment
              ? t('screens.inAccount.expandedTxPage.paymentFailed')
              : isOutgoing
              ? t('transactionLabelText.sent')
              : t('transactionLabelText.received')
          }
        />

        <View style={styles.heroIconContainer}>{renderHeroIcon()}</View>

        <FormattedSatText
          containerStyles={styles.amountContainer}
          neverHideBalance={true}
          styles={styles.primaryAmount}
          balance={isLRC20Payment ? formattedTokensBalance : amount}
          useCustomLabel={isLRC20Payment}
          customLabel={selectedToken?.tokenMetadata?.tokenTicker}
          useMillionDenomination={true}
        />

        {!isLRC20Payment && (
          <FormattedSatText
            containerStyles={styles.secondaryAmountContainer}
            neverHideBalance={true}
            globalBalanceDenomination={
              masterInfoObject.userBalanceDenomination === 'fiat'
                ? 'sats'
                : 'fiat'
            }
            styles={{ ...styles.secondaryAmount, color: tokens.muted }}
            balance={amount}
          />
        )}

        <View style={[styles.dashedDivider, { borderColor: tokens.divider }]} />

        {!!counterpartyName && (
          <DetailRow
            label={t(isOutgoing ? 'constants.to' : 'constants.from')}
            lines={2}
            value={counterpartyName}
            onPress={
              localContact && !isBulkPayment && !brantaMerchantName
                ? () =>
                    handleBackPressFunction(() =>
                      navigateToExpandedContact(localContact, 'expandedTx'),
                    )
                : undefined
            }
          />
        )}

        <DetailRow
          label={t('screens.inAccount.expandedTxPage.status')}
          value={statusLabel}
          valueColor={statusColor}
          lines={2}
        />

        <DetailRow
          label={t('transactionLabelText.date')}
          value={`${formatLocalTimeShort(paymentDate)} · ${formatTime(
            paymentDate,
          )}`}
        />

        {showFeeInfoRow && (
          <DetailRow
            label={t('constants.fee')}
            value={displayCorrectDenomination({
              amount: transaction.details.fee || 0,
              fiatStats,
              masterInfoObject,
            })}
          />
        )}

        {isLRC20Payment && !isUSDBPayment && (
          <DetailRow
            label={t('constants.token')}
            value={selectedToken?.tokenMetadata?.tokenTicker
              ?.toUpperCase()
              ?.slice(0, TOKEN_TICKER_MAX_LENGTH)}
          />
        )}

        {showConversionLine && (
          <DetailRow
            label={t('constants.rate')}
            value={`${APPROXIMATE_SYMBOL} ${displayCorrectDenomination({
              amount: formatBalanceAmount(
                Number(
                  currentPriceAinBToPriceDollars(
                    transaction.details.currentPriceAInB,
                  ),
                ).toFixed(2),
                false,
                masterInfoObject,
              ),
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              forceCurrency: 'USD',
              convertAmount: false,
            })}`}
          />
        )}

        {isEditingMemo ? (
          <View style={styles.memoInput}>
            <UserInput
              value={memoText}
              onChangeText={setMemoText}
              placeholder={t('transactionLabelText.memo')}
              maxLength={200}
              autoFocus={true}
              onBlur={runMemoSave}
            />
          </View>
        ) : (
          <DetailRow
            label={t('transactionLabelText.memo')}
            lines={2}
            value={description}
            icon="Pencil"
            onIconPress={handleEditMemo}
          />
        )}

        {renderSuccessAction()}

        {showMoreDetails && !isEditingMemo && renderTechnicalRows()}

        {isEditingMemo ? (
          <AdaptiveButtonRow
            pill
            labels={[t('constants.cancel'), t('constants.save')]}
            containerStyle={styles.buttons}
          >
            {({ buttonStyle }) => (
              <>
                <CustomButton
                  size="regular"
                  tone="secondary"
                  buttonStyles={buttonStyle}
                  actionFunction={handleCancelMemo}
                  textContent={t('constants.cancel')}
                />
                <CustomButton
                  size="regular"
                  tone="primary"
                  buttonStyles={buttonStyle}
                  actionFunction={runMemoSave}
                  textContent={t('constants.save')}
                />
              </>
            )}
          </AdaptiveButtonRow>
        ) : (
          <AdaptiveButtonRow
            pill
            labels={[secondaryLabel, moreDetailsLabel].filter(Boolean)}
            containerStyle={styles.buttons}
          >
            {({ buttonStyle }) => (
              <>
                {!!secondaryLabel && (
                  <CustomButton
                    size="regular"
                    tone="secondary"
                    buttonStyles={buttonStyle}
                    actionFunction={
                      isFailedPayment
                        ? handleContactSupport
                        : handleViewProgress
                    }
                    textContent={secondaryLabel}
                  />
                )}
                <CustomButton
                  size="regular"
                  tone="secondary"
                  buttonStyles={buttonStyle}
                  actionFunction={() => setShowMoreDetails(prev => !prev)}
                  textContent={moreDetailsLabel}
                />
              </>
            )}
          </AdaptiveButtonRow>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  title: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  heroIconContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: '100%', height: '100%' },
  heroAssetLogo: { width: 30, height: 30 },
  splitAvatars: { flexDirection: 'row' },
  splitAvatar: { borderWidth: 2 },
  amountContainer: { marginTop: 14, alignSelf: 'center' },
  primaryAmount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1.5,
    includeFontPadding: false,
    textAlign: 'center',
  },
  secondaryAmountContainer: { marginTop: 2 },
  secondaryAmount: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: 'center',
  },
  dashedDivider: {
    marginTop: 20,
    marginBottom: 8,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  solidDivider: {
    marginVertical: 8,
    borderTopWidth: 1,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  rowValue: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  rowValueMono: {
    fontFamily: FONT.mono,
    fontSize: 13,
    lineHeight: 19,
  },
  rowButton: {
    width: 44,
    height: 44,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successActionText: { textAlign: 'left' },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  memoInput: { marginTop: 6 },
  buttons: { width: '100%', marginTop: 20 },
});
