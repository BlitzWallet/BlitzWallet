import { StyleSheet, View } from 'react-native';
import {
  CENTER,
  EMAIL_REGEX,
  FONT,
  POINT_OF_SALE_PAYOUT_DESCRIPTION,
} from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useCallback, useEffect, useMemo, useState } from 'react';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import {
  payPOSContact,
  payPOSLNURL,
} from '../../../../../functions/pos/payments';
import customUUID from '../../../../../functions/customUUID';
import { publishMessage } from '../../../../../functions/messaging/publishMessage';
import { useKeysContext } from '../../../../../../context-store/keys';
import { bulkUpdateDidPay, deleteEmployee } from '../../../../../functions/pos';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import TipsTXItem from './internalComponents/tipTx';
import { usePOSTransactions } from '../../../../../../context-store/pos';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { getSingleContact } from '../../../../../../db';
import { useServerTimeOnly } from '../../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useTheme } from '../../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import SectionHeader from '../../../../../functions/CustomElements/redesign/SectionHeader';
import StepProgress from '../../../../../functions/CustomElements/redesign/StepProgress';
import { SheetSurface } from '../../../../../functions/CustomElements/redesign/sheetSurface';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../../functions/CustomElements/redesign/AnimatedStep';

const HEIGHTS = { tips: 640, loading: 420 };

// Someone's tips (CustomHalfModal 'posTipsDetail', mounted in POSStack so the
// tips stay live). Steps: tips → loading (can't be dismissed while paying).
export default function TotalTipsScreen({
  name: wantedName,
  handleBackPressFunction,
  setContentHeight,
  setDismissLocked,
}) {
  const { sendWebViewRequest } = useWebView();
  const { decodedAddedContacts, globalContactsInformation } =
    useGlobalContactsInfo();
  const { groupedTxs } = usePOSTransactions();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const createdGroup = useMemo(() => {
    return groupedTxs.find(item => item[0] === wantedName) || [];
  }, [groupedTxs, wantedName]);

  const [
    name,
    { lastActivity, totalPaidTxs, totalTipAmount, txs, unpaidTxs } = {},
  ] = createdGroup;

  const getServerTime = useServerTimeOnly();
  const { contactsPrivateKey, accountMnemoinc } = useKeysContext();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const [currentPage, setCurrentPage] = useState('tips');
  const [direction, setDirection] = useState(1);
  const [isNotifying, setIsNotifying] = useState(false);

  useStepSheetHeight(setContentHeight, HEIGHTS[currentPage]);

  // Two pages only, so the step always comes from the other one. Not read from
  // `currentPage`: handlePayment's finally runs with the goTo it started with.
  const goTo = useCallback(
    page => {
      const from = page === 'loading' ? 'tips' : 'loading';
      setDirection(page === 'loading' ? 1 : -1);
      growThenStep(setContentHeight, HEIGHTS[from], HEIGHTS[page], () =>
        setCurrentPage(page),
      );
    },
    [setContentHeight],
  );

  useEffect(() => {
    setDismissLocked?.(currentPage === 'loading');
  }, [currentPage, setDismissLocked]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true;
    return handleBackPressFunction();
  }, [currentPage, handleBackPressFunction]);
  useHandleBackPressNew(handleBackPress);

  const sourtedTxs = useMemo(() => {
    try {
      if (!txs || !Array.isArray(txs)) return [];
      return [...txs].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
    } catch (err) {
      console.log('error sorting txs', err);
      return [];
    }
  }, [txs]);

  const formatAmount = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const handlePayment = useCallback(async () => {
    try {
      if (totalTipAmount < 1) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.posPath.totalTipsScreen.noTipBalanceError'),
        });
        return;
      }
      goTo('loading');
      const [blitzContact] = await Promise.all([
        getSingleContact(name?.toLowerCase()),
      ]);

      if (blitzContact.length) {
        const selectedContact = blitzContact[0];

        if (!selectedContact.contacts.myProfile.sparkAddress)
          throw new Error(
            t('settings.posPath.totalTipsScreen.updateContactMessage'),
          );

        //  use pay pos contact payment here
        // const address = blitzContact.receiveAddress;
        const pubKey = selectedContact.uuid;
        const fromPubKey = globalContactsInformation.myProfile.uuid;

        // is blitz contact
        const paymentResponse = await payPOSContact({
          blitzContact: selectedContact,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
          // webViewRef,
          sparkInformation,
          currentWalletMnemoinc: accountMnemoinc,
          sendWebViewRequest,
        });
        // const didPay = await payPOSLiquid({
        //   liquidNodeInformation,
        //   eCashBalance,
        //   nodeInformation,
        //   address, // liquid address
        //   payingStateUpdate: setPaymentUpdate,
        //   minMaxLiquidSwapAmounts,
        //   sendingAmountSats: totalTipAmount,
        //   masterInfoObject,
        //   description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
        //   webViewRef,
        // });
        if (paymentResponse.didWork) {
          setIsNotifying(true);
          // First notify employee that tips have been paid and update contacts transactions
          const UUID = customUUID();
          const currentTime = getServerTime();
          const sendObject = {
            amountMsat: totalTipAmount * 1000,
            description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
            uuid: UUID,
            isRequest: false,
            isRedeemed: null,
            wasSeen: null,
            didSend: null,
            txid: paymentResponse.paymentResponse.response.id,
            name:
              globalContactsInformation.myProfile.name ||
              globalContactsInformation.myProfile.uniqueName,
            senderProfileSnapshot: {
              uniqueName: globalContactsInformation.myProfile.uniqueName,
            },
          };

          await publishMessage({
            toPubKey: pubKey,
            fromPubKey: fromPubKey,
            data: sendObject,
            globalContactsInformation,
            selectedContact: selectedContact.contacts.myProfile,
            isLNURLPayment: false,
            privateKey: contactsPrivateKey,
            retrivedContact: selectedContact,
            currentTime,
            masterInfoObject,
          });
          // update internal db state of paid tips so you dont pay a tip twice
          await updateInteralDBState(unpaidTxs);
        } else
          throw new Error(t('settings.posPath.totalTipsScreen.errorPaying'));
      } else if (EMAIL_REGEX.test(name)) {
        // is lnurl
        const didPay = await payPOSLNURL({
          LNURLAddress: name,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
          sparkInformation,
          currentWalletMnemoinc: accountMnemoinc,
          // liquidNodeInformation,
          // nodeInformation,
          // minMaxLiquidSwapAmounts,
          sendWebViewRequest,
        });
        if (didPay) {
          await updateInteralDBState(unpaidTxs);
        } else
          throw new Error(t('settings.posPath.totalTipsScreen.errorPaying'));
      } else throw new Error(t('settings.posPath.totalTipsScreen.invalidName'));
    } catch (err) {
      console.log('handle tips payment error', err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsNotifying(false);
      goTo('tips');
    }
  }, [
    // minMaxLiquidSwapAmounts,
    decodedAddedContacts,
    name,
    totalTipAmount,
    unpaidTxs,
    getServerTime,
    masterInfoObject,
    sendWebViewRequest,
  ]);

  const updateInteralDBState = useCallback(async txList => {
    const dateAddedArray = txList.map(tx => tx.dbDateAdded);
    await bulkUpdateDidPay(dateAddedArray);
  }, []);

  const removeEmployee = useCallback(() => {
    navigate.navigate('ConfirmDialog', {
      title: t('settings.posPath.totalTipsScreen.removeEmployeeTitle', {
        name,
      }),
      message: totalTipAmount
        ? t('settings.posPath.totalTipsScreen.removeEmployeeUnpaidWarning', {
            amount: formatAmount(totalTipAmount),
          })
        : t('settings.posPath.totalTipsScreen.removeEmployeeWarning'),
      cancelLabel: t('constants.cancel'),
      confirmLabel: t('constants.remove'),
      onConfirm: async () => {
        await deleteEmployee(name);
        navigate.popTo('ViewPOSTransactions');
      },
    });
  }, [name, totalTipAmount, navigate, t]);

  // The group is gone once the person is removed; the sheet is closing.
  if (!name) return null;

  const contactType = EMAIL_REGEX.test(name)
    ? t('settings.posPath.totalTipsScreen.lightningAddress')
    : t('settings.posPath.totalTipsScreen.blitzUser');
  const lastSale = lastActivity
    ? new Date(lastActivity).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;
  const toPay = formatAmount(totalTipAmount);
  // "2,450 sats" → big number + muted unit; fiat values stay whole.
  const toPayParts = String(toPay).match(/^(.*\d)(\s+\D+)$/);

  return (
    <SheetSurface>
      <View style={styles.container}>
        <AnimatedStep active={currentPage === 'tips'} direction={direction}>
          <View style={styles.page}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.name}
                  content={name}
                />
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={[styles.small, { color: tokens.muted }]}
                  content={
                    lastSale
                      ? t('settings.posPath.totalTipsScreen.lastSaleSub', {
                          type: contactType,
                          date: lastSale,
                        })
                      : contactType
                  }
                />
              </View>
              <IconButton
                icon="Trash2"
                iconSize={20}
                tone="disc"
                label={t('settings.posPath.totalTipsScreen.remove', { name })}
                onPress={removeEmployee}
              />
            </View>

            <View
              style={[styles.toPayCard, { backgroundColor: tokens.ground }]}
            >
              <ThemeText
                styles={[styles.toPayLabel, { color: tokens.muted }]}
                content={t('settings.posPath.totalTipsScreen.toPay')}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.toPayAmount}
                content={
                  toPayParts
                    ? [
                        toPayParts[1],
                        <ThemeText
                          key="unit"
                          content={toPayParts[2]}
                          styles={[styles.toPayUnit, { color: tokens.muted }]}
                        />,
                      ]
                    : toPay
                }
              />
              {!!totalPaidTxs && (
                <ThemeText
                  styles={[
                    styles.small,
                    styles.paidBefore,
                    { color: tokens.muted },
                  ]}
                  content={t('settings.posPath.totalTipsScreen.paidBefore', {
                    amount: formatAmount(totalPaidTxs),
                  })}
                />
              )}
            </View>

            <SectionHeader
              title={t('settings.posPath.totalTipsScreen.tips')}
              style={styles.tipsHeader}
            />
            <CustomScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
              <ListCard>
                {sourtedTxs.map(item => (
                  <TipsTXItem
                    key={String(item.dbDateAdded)}
                    item={item}
                    masterInfoObject={masterInfoObject}
                    fiatStats={fiatStats}
                    t={t}
                  />
                ))}
              </ListCard>
            </CustomScrollView>

            <CustomButton
              buttonStyles={styles.payButton}
              disabled={totalTipAmount < 1}
              actionFunction={handlePayment}
              textContent={t('settings.posPath.totalTipsScreen.payAmount', {
                amount: toPay,
              })}
              size="regular"
            />
          </View>
        </AnimatedStep>

        <AnimatedStep
          active={currentPage === 'loading'}
          direction={direction}
          exitsBack={true}
        >
          <View style={styles.loading}>
            <StepProgress
              title={
                isNotifying
                  ? t('settings.posPath.totalTipsScreen.notifyingTitle', {
                      name,
                    })
                  : t('settings.posPath.totalTipsScreen.payingTitle', { name })
              }
              subtitle={t('settings.posPath.totalTipsScreen.payingSub', {
                amount: toPay,
              })}
            />
          </View>
        </AnimatedStep>
      </View>
    </SheetSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  page: { flex: 1 },
  header: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  small: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  toPayCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
  },
  toPayLabel: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  toPayAmount: {
    fontSize: 36,
    fontFamily: FONT.Title_Medium,
    letterSpacing: -1,
    includeFontPadding: false,
  },
  toPayUnit: {
    fontSize: 18,
    fontFamily: FONT.Title_Regular,
    letterSpacing: 0,
  },
  paidBefore: { marginTop: 6 },
  tipsHeader: { marginTop: 20 },
  list: { flex: 1 },
  payButton: { width: '100%', marginTop: 12 },
  loading: { flex: 1, justifyContent: 'center' },
});
