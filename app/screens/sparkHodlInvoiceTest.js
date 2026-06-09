import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

import QrCodeWrapper from '../functions/CustomElements/QrWrapper';
import {
  claimSparkHodlLightningPayment,
  getSparkBalance,
  getSparkLightningPaymentFeeEstimate,
  getSparkLightningSendRequest,
  getSparkLightningPaymentStatus,
  getWallet,
  querySparkHodlLightningPayments,
  receiveSparkHodlLightningPayment,
  sendSparkLightningPayment,
} from '../functions/spark';
import { useActiveCustodyAccount } from '../../context-store/activeAccount';
import CustomSettingsTopBar from '../functions/CustomElements/settingsTopBar';

const HODL_STATUS = {
  0: 'Pending / held',
  1: 'Claimed / completed',
  2: 'Failed / canceled',
};

const CANCEL_METHODS = [
  'cancelLightningHodlInvoice',
  'cancelHodlInvoice',
  'cancelHTLC',
  'failHTLC',
];

function safeJson(value) {
  try {
    return (
      JSON.stringify(
        value,
        (key, item) => {
          if (typeof item === 'bigint') return item.toString();
          if (item instanceof Uint8Array) return bytesToHex(item);
          return item;
        },
        2,
      ) || ''
    );
  } catch (err) {
    return `Unable to stringify payload: ${err.message}`;
  }
}

function eventMessage(title, payload) {
  const timestamp = new Date().toISOString();
  return {
    id: `${timestamp}-${Math.random()}`,
    timestamp,
    title,
    payload,
  };
}

async function makePreimagePair() {
  const preimageBytes = await Crypto.getRandomBytesAsync(32);
  const preimage = bytesToHex(preimageBytes);
  const paymentHash = bytesToHex(sha256(preimageBytes));
  return { preimage, paymentHash };
}

function getInvoiceText(receiveRequest) {
  return (
    receiveRequest?.invoice?.encodedInvoice ||
    receiveRequest?.invoice?.bolt11 ||
    receiveRequest?.encodedInvoice ||
    ''
  );
}

function getSendRequestId(response) {
  return (
    response?.paymentResponse?.id ||
    response?.response?.id ||
    response?.id ||
    response?.payment?.id ||
    ''
  );
}

export default function SparkHodlInvoiceTest() {
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const [amountSats, setAmountSats] = useState('100');
  const [memo, setMemo] = useState('Blitz HODL invoice test');
  const [expirySeconds, setExpirySeconds] = useState('3600');
  const [preimage, setPreimage] = useState('');
  const [paymentHash, setPaymentHash] = useState('');
  const [receiveRequest, setReceiveRequest] = useState(null);
  const [invoice, setInvoice] = useState('');
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState('');
  const [events, setEvents] = useState([]);

  const [externalInvoice, setExternalInvoice] = useState('');
  const [externalAmountSats, setExternalAmountSats] = useState('');
  const [maxFeeSats, setMaxFeeSats] = useState('20');
  const [sendRequestId, setSendRequestId] = useState('');

  const canUseWallet = useMemo(
    () => !!currentWalletMnemoinc,
    [currentWalletMnemoinc],
  );

  function addEvent(title, payload) {
    setEvents(prev => [eventMessage(title, payload), ...prev].slice(0, 30));
  }

  function getNumericInput(value, label, { required = true } = {}) {
    const normalized = value.trim();
    if (!normalized && !required) return undefined;
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error(`${label} must be a safe whole number`);
    }
    return parsed;
  }

  async function runAction(name, action) {
    if (!canUseWallet) {
      Alert.alert('Missing wallet', 'No active wallet mnemonic is available.');
      return null;
    }

    setLoading(name);
    try {
      const result = await action();
      addEvent(name, result);
      return result;
    } catch (err) {
      const payload = { error: err.message };
      addEvent(`${name} error`, payload);
      Alert.alert(name, err.message);
      return null;
    } finally {
      setLoading('');
    }
  }

  async function refreshBalance(label = 'Refresh balance') {
    return runAction(label, async () => {
      const response = await getSparkBalance(currentWalletMnemoinc);
      if (!response?.didWork) throw new Error('Unable to fetch Spark balance');
      const nextBalance =
        response.balance?.toString?.() || String(response.balance);
      setBalance(nextBalance);
      return { balance: nextBalance, response };
    });
  }

  async function generatePreimage() {
    return runAction('Generate preimage', async () => {
      const pair = await makePreimagePair();
      setPreimage(pair.preimage);
      setPaymentHash(pair.paymentHash);
      return pair;
    });
  }

  async function createHodlInvoice() {
    return runAction('Create HODL invoice', async () => {
      const amount = getNumericInput(amountSats, 'Amount sats');
      const expiry = getNumericInput(expirySeconds, 'Expiry seconds');
      const pair =
        preimage && paymentHash
          ? { preimage, paymentHash }
          : await makePreimagePair();

      setPreimage(pair.preimage);
      setPaymentHash(pair.paymentHash);

      const response = await receiveSparkHodlLightningPayment({
        amountSats: amount,
        paymentHash: pair.paymentHash,
        memo,
        expirySeconds: expiry,
        mnemonic: currentWalletMnemoinc,
      });

      if (!response?.didWork) {
        throw new Error(response?.error || 'Unable to create HODL invoice');
      }

      const request = response.response;
      const encodedInvoice = getInvoiceText(request);
      setReceiveRequest(request);
      setInvoice(encodedInvoice);

      return {
        preimage: pair.preimage,
        paymentHash: pair.paymentHash,
        request,
        encodedInvoice,
      };
    });
  }

  async function queryReceiverStatus() {
    return runAction('Query receiver HODL status', async () => {
      if (!paymentHash) throw new Error('Create or enter a payment hash first');

      const response = await querySparkHodlLightningPayments({
        paymentHashes: [paymentHash],
        mnemonic: currentWalletMnemoinc,
      });

      if (!response?.didWork) {
        throw new Error(response?.error || 'Unable to query HODL status');
      }

      return {
        ...response,
        statuses: response.paidPreimages?.map(item => ({
          ...item,
          statusLabel: HODL_STATUS[item.status] || `Unknown (${item.status})`,
        })),
      };
    });
  }

  async function queryLightningReceiveStatus() {
    return runAction('Query receive request', async () => {
      const requestId = receiveRequest?.id;
      if (!requestId) throw new Error('Create a HODL invoice first');

      return getSparkLightningPaymentStatus({
        lightningInvoiceId: requestId,
        mnemonic: currentWalletMnemoinc,
      });
    });
  }

  async function claimInvoice() {
    return runAction('Claim HODL invoice', async () => {
      if (!preimage) throw new Error('Missing preimage');

      const response = await claimSparkHodlLightningPayment({
        preimage,
        mnemonic: currentWalletMnemoinc,
      });

      if (!response?.didWork) {
        throw new Error(response?.error || 'Unable to claim HODL invoice');
      }

      await refreshBalance('Balance after claim');
      return response;
    });
  }

  async function cancelInvoiceBestEffort() {
    return runAction('Cancel HODL invoice', async () => {
      if (!paymentHash && !receiveRequest?.id) {
        throw new Error('Create a HODL invoice first');
      }

      const wallet = await getWallet(currentWalletMnemoinc);
      const methodName = CANCEL_METHODS.find(
        candidate => typeof wallet?.[candidate] === 'function',
      );

      if (!methodName) {
        return {
          didWork: false,
          unsupported: true,
          message:
            'This Spark SDK build does not expose a receiver-side HODL cancel method.',
          probedMethods: CANCEL_METHODS,
        };
      }

      const response = await wallet[methodName]({
        id: receiveRequest?.id,
        paymentHash,
      });

      await refreshBalance('Balance after cancel');
      return { didWork: true, methodName, response };
    });
  }

  async function copyInvoice() {
    if (!invoice) return;
    await Clipboard.setStringAsync(invoice);
    Alert.alert('Copied', 'Invoice copied to clipboard');
  }

  async function copyPreimageDebugData() {
    const data = safeJson({ preimage, paymentHash, receiveRequest });
    await Clipboard.setStringAsync(data);
    Alert.alert('Copied', 'HODL debug data copied to clipboard');
  }

  async function estimateExternalInvoiceFee() {
    return runAction('Estimate external invoice fee', async () => {
      if (!externalInvoice.trim()) throw new Error('Paste an invoice first');
      const amount = getNumericInput(externalAmountSats, 'Amount sats', {
        required: false,
      });

      const response = await getSparkLightningPaymentFeeEstimate(
        externalInvoice,
        amount,
        currentWalletMnemoinc,
      );

      if (!response?.didWork) {
        throw new Error(response?.error || 'Unable to estimate fee');
      }

      return response;
    });
  }

  async function payExternalInvoice() {
    return runAction('Pay external invoice', async () => {
      if (!externalInvoice.trim()) throw new Error('Paste an invoice first');
      const amount = getNumericInput(externalAmountSats, 'Amount sats', {
        required: false,
      });
      const maxFee = getNumericInput(maxFeeSats, 'Max fee sats');

      const balanceBefore = await getSparkBalance(currentWalletMnemoinc);
      const response = await sendSparkLightningPayment({
        invoice: externalInvoice,
        maxFeeSats: maxFee,
        amountSats: amount,
        mnemonic: currentWalletMnemoinc,
      });
      const balanceAfter = await getSparkBalance(currentWalletMnemoinc);

      if (!response?.didWork) {
        throw new Error(response?.error || 'Unable to pay invoice');
      }

      const requestId = getSendRequestId(response);
      setSendRequestId(requestId);
      setBalance(
        balanceAfter?.balance?.toString?.() || String(balanceAfter?.balance),
      );

      return {
        balanceBefore: balanceBefore?.balance?.toString?.(),
        response,
        requestId,
        balanceAfter: balanceAfter?.balance?.toString?.(),
      };
    });
  }

  async function queryExternalSendStatus() {
    return runAction('Query outgoing send status', async () => {
      if (!sendRequestId.trim()) throw new Error('Missing send request ID');
      return getSparkLightningSendRequest(sendRequestId, currentWalletMnemoinc);
    });
  }

  const disabled = !!loading || !canUseWallet;

  return (
    <SafeAreaView style={styles.container}>
      <CustomSettingsTopBar />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Spark HODL Invoice Test</Text>
          <Text style={styles.subtitle}>
            Issue #903 debug surface for held, claimed, failed, and canceled
            Lightning payments.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Wallet</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <Text style={styles.muted}>
            Active wallet: {canUseWallet ? 'available' : 'missing'}
          </Text>
          <Text style={styles.balance}>
            Balance: {balance === null ? 'not loaded' : `${balance} sats`}
          </Text>
          <TouchableOpacity
            disabled={disabled}
            onPress={() => refreshBalance()}
            style={[styles.button, disabled && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>Refresh Balance</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create Receive HODL Invoice</Text>
          <TextInput
            style={styles.input}
            value={amountSats}
            onChangeText={setAmountSats}
            placeholder="Amount sats"
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.input}
            value={memo}
            onChangeText={setMemo}
            placeholder="Memo"
          />
          <TextInput
            style={styles.input}
            value={expirySeconds}
            onChangeText={setExpirySeconds}
            placeholder="Expiry seconds"
            keyboardType="number-pad"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              disabled={disabled}
              onPress={generatePreimage}
              style={[
                styles.secondaryButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>New Hash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={createHodlInvoice}
              style={[
                styles.button,
                styles.flexButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonText}>Create Invoice</Text>
            </TouchableOpacity>
          </View>

          {paymentHash ? (
            <View style={styles.debugBox}>
              <Text style={styles.label}>Payment hash</Text>
              <Text selectable style={styles.mono}>
                {paymentHash}
              </Text>
              <Text style={styles.label}>Preimage</Text>
              <Text selectable style={styles.mono}>
                {preimage}
              </Text>
            </View>
          ) : null}

          {invoice ? (
            <View style={styles.invoiceArea}>
              <QrCodeWrapper
                QRData={invoice}
                qrSize={250}
                outerContainerStyle={styles.qrOuter}
                innerContainerStyle={styles.qrInner}
              />
              <Text selectable style={styles.invoiceText}>
                {invoice}
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={copyInvoice}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Copy Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={copyPreimageDebugData}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Copy Debug</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receiver Actions</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity
              disabled={disabled}
              onPress={queryReceiverStatus}
              style={[
                styles.secondaryButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Query HTLC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={queryLightningReceiveStatus}
              style={[
                styles.secondaryButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Query Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={cancelInvoiceBestEffort}
              style={[styles.warningButton, disabled && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={claimInvoice}
              style={[styles.successButton, disabled && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Claim</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pay External HODL Invoice</Text>
          <Text style={styles.muted}>
            Use this side to reproduce payer balance behavior after another
            service cancels/fails a HODL invoice.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={externalInvoice}
            onChangeText={setExternalInvoice}
            placeholder="Paste external BOLT11 invoice"
            multiline
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={externalAmountSats}
            onChangeText={setExternalAmountSats}
            placeholder="Amount sats for zero-amount invoice only"
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.input}
            value={maxFeeSats}
            onChangeText={setMaxFeeSats}
            placeholder="Max fee sats"
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.input}
            value={sendRequestId}
            onChangeText={setSendRequestId}
            placeholder="Outgoing send request ID"
            autoCapitalize="none"
          />
          <View style={styles.buttonGrid}>
            <TouchableOpacity
              disabled={disabled}
              onPress={estimateExternalInvoiceFee}
              style={[
                styles.secondaryButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Estimate Fee</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={payExternalInvoice}
              style={[styles.button, disabled && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Pay Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={queryExternalSendStatus}
              style={[
                styles.secondaryButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Query Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={disabled}
              onPress={() => refreshBalance('Balance after external cancel')}
              style={[
                styles.secondaryButton,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Check Balance</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Events</Text>
          {events.length === 0 ? (
            <Text style={styles.muted}>No events yet.</Text>
          ) : (
            events.map(item => (
              <View key={item.id} style={styles.eventItem}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>{item.timestamp}</Text>
                <Text selectable style={styles.eventPayload}>
                  {safeJson(item.payload)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  muted: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  balance: {
    color: '#0f766e',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  buttonGrid: {
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  debugBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  label: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mono: {
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 10,
  },
  invoiceArea: {
    alignItems: 'center',
    marginTop: 12,
  },
  qrOuter: {
    width: 282,
    minHeight: 282,
    marginBottom: 12,
  },
  qrInner: {
    width: 250,
    height: 250,
  },
  invoiceText: {
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  eventItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  eventTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  eventTime: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 8,
  },
  eventPayload: {
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
