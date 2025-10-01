import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  connect,
  defaultConfig,
  Network,
  Seed,
  ReceivePaymentMethod,
  SendPaymentMethod,
} from '@breeztech/breez-sdk-spark-react-native';
import {useState, useEffect} from 'react';
import {documentDirectory} from 'expo-file-system';
import {getOrCreateDirectory} from '../functions/connectToNode';

// Event Listener Class
class JsEventListener {
  constructor(callback) {
    this.callback = callback;
  }

  onEvent = event => {
    console.log(`Received event: ${JSON.stringify(event)}`);
    if (this.callback) {
      this.callback(event);
    }
  };
}

export default function BreezSpark() {
  const [sdk, setSdk] = useState(null);
  const [balance, setBalance] = useState(null);
  const [events, setEvents] = useState([]);
  const [listenerId, setListenerId] = useState(null);
  const [payments, setPayments] = useState([]);

  // For receiving payments
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [generatedInvoice, setGeneratedInvoice] = useState('');
  const [receiveFeeSats, setReceiveFeeSats] = useState(null);

  // For sending payments
  const [paymentRequest, setPaymentRequest] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [preparedPayment, setPreparedPayment] = useState(null);

  async function connectToSdk() {
    try {
      const mnemonic = '';
      let config = defaultConfig(Network.Mainnet);
      config.apiKey = process.env.LIQUID_BREEZ_KEY;

      const baseDir = documentDirectory.replace('file://', '');
      const workingDir = `${baseDir}breezSdkSpark`;

      const directoryPath = await getOrCreateDirectory('testing', workingDir);

      console.log('API Key configured:', !!config.apiKey);

      const seed = new Seed.Mnemonic({mnemonic});
      const connectedSdk = await connect({
        config,
        seed,
        storageDir: directoryPath,
      });

      setSdk(connectedSdk);
      console.log('✅ Connected successfully!');

      // Start listening to events
      setupEventListener(connectedSdk);

      // Get initial balance
      await fetchBalance(connectedSdk);

      // Load payment history
      await fetchPayments(connectedSdk);
    } catch (err) {
      console.error('❌ Connection error:', err);
      Alert.alert('Connection Error', err.message);
    }
  }

  function setupEventListener(sdkInstance) {
    const eventListener = new JsEventListener(event => {
      setEvents(prev =>
        [{event, timestamp: new Date().toISOString()}, ...prev].slice(0, 10),
      );

      // Refresh balance on payment events
      if (
        event.type === 'paymentSucceeded' ||
        event.type === 'paymentReceived'
      ) {
        fetchBalance(sdkInstance);
        fetchPayments(sdkInstance);
      }
    });

    const id = sdkInstance.addEventListener(eventListener);
    setListenerId(id);
    console.log('Event listener registered:', id);
  }

  async function fetchBalance(sdkInstance = sdk) {
    if (!sdkInstance) return;

    try {
      const info = await sdkInstance.getInfo({});
      setBalance(info.balanceSats);
      console.log('Balance:', info.balanceSats);
    } catch (err) {
      console.error('Error fetching balance:', err);
      Alert.alert('Balance Error', err.message);
    }
  }

  async function fetchPayments(sdkInstance = sdk) {
    if (!sdkInstance) return;

    try {
      const response = await sdkInstance.listPayments({
        offset: undefined,
        limit: 20,
      });
      setPayments(response.payments);
      console.log('Payments loaded:', response.payments.length);
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  }

  async function generateInvoice() {
    if (!sdk) {
      Alert.alert('Error', 'SDK not connected');
      return;
    }

    try {
      const amountSats = invoiceAmount ? BigInt(invoiceAmount) : undefined;

      const response = await sdk.receivePayment({
        paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
          description: invoiceDescription || 'Payment',
          amountSats,
        }),
      });

      setGeneratedInvoice(response.paymentRequest);
      setReceiveFeeSats(response.feeSats);
      console.log('Invoice generated:', response.paymentRequest);
      console.log('Receive fees:', response.feeSats);

      Alert.alert('Invoice Generated', 'Check the invoice field below');
    } catch (err) {
      console.error('Error generating invoice:', err);
      Alert.alert('Invoice Error', err.message);
    }
  }

  async function preparePayment() {
    if (!sdk || !paymentRequest) {
      Alert.alert('Error', 'SDK not connected or no payment request');
      return;
    }

    try {
      const amountSats = sendAmount ? BigInt(sendAmount) : undefined;

      const prepareResponse = await sdk.prepareSendPayment({
        paymentRequest,
        amountSats,
      });

      setPreparedPayment(prepareResponse);

      if (
        prepareResponse.paymentMethod instanceof SendPaymentMethod.Bolt11Invoice
      ) {
        const lightningFee =
          prepareResponse.paymentMethod.inner.lightningFeeSats;
        const sparkFee =
          prepareResponse.paymentMethod.inner.sparkTransferFeeSats;

        Alert.alert(
          'Payment Prepared',
          `Lightning Fees: ${lightningFee} sats\nSpark Fees: ${
            sparkFee || 'N/A'
          } sats`,
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Send Payment', onPress: () => sendPayment(prepareResponse)},
          ],
        );
      }
    } catch (err) {
      console.error('Error preparing payment:', err);
      Alert.alert('Prepare Error', err.message);
    }
  }

  async function sendPayment(prepareResponse) {
    if (!sdk) return;

    try {
      const response = await sdk.sendPayment({
        prepareResponse,
      });

      console.log('Payment sent:', response);
      Alert.alert('Success', 'Payment sent successfully!');

      // Clear form and refresh
      setPaymentRequest('');
      setSendAmount('');
      setPreparedPayment(null);
      await fetchBalance();
      await fetchPayments();
    } catch (err) {
      console.error('Error sending payment:', err);
      Alert.alert('Send Error', err.message);
    }
  }

  useEffect(() => {
    return () => {
      if (sdk && listenerId) {
        sdk.removeEventListener(listenerId);
      }
    };
  }, [sdk, listenerId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Connection Section */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={connectToSdk}
            style={[styles.button, sdk && styles.buttonConnected]}
            disabled={!!sdk}>
            <Text style={styles.buttonText}>
              {sdk ? '✅ Connected' : 'Connect to Breez SDK'}
            </Text>
          </TouchableOpacity>

          {balance !== null && (
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Balance:</Text>
              <Text style={styles.balanceAmount}>
                {balance.toString()} sats
              </Text>
              <TouchableOpacity
                onPress={() => fetchBalance()}
                style={styles.refreshButton}>
                <Text>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Receive Payment Section */}
        {sdk && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receive Payment</Text>
            <TextInput
              style={styles.input}
              placeholder="Invoice description"
              value={invoiceDescription}
              onChangeText={setInvoiceDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount (sats) - optional"
              value={invoiceAmount}
              onChangeText={setInvoiceAmount}
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={generateInvoice} style={styles.button}>
              <Text style={styles.buttonText}>Generate Invoice</Text>
            </TouchableOpacity>

            {generatedInvoice && (
              <View style={styles.invoiceContainer}>
                <Text style={styles.label}>Invoice:</Text>
                <Text style={styles.invoice} selectable>
                  {generatedInvoice}
                </Text>
                {receiveFeeSats !== null && (
                  <Text style={styles.feeText}>
                    Fee: {receiveFeeSats.toString()} sats
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Send Payment Section */}
        {sdk && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Send Payment</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste Lightning invoice (bolt11)"
              value={paymentRequest}
              onChangeText={setPaymentRequest}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder="Amount (sats) - optional"
              value={sendAmount}
              onChangeText={setSendAmount}
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={preparePayment} style={styles.button}>
              <Text style={styles.buttonText}>Prepare & Send Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Events Section */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Recent Events ({events.length})
            </Text>
            {events.map((item, idx) => (
              <View key={idx} style={styles.eventItem}>
                <Text style={styles.eventTime}>{item.timestamp}</Text>
                <Text style={styles.eventText}>
                  {JSON.stringify(item.event, null, 2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payments History */}
        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Payment History ({payments.length})
            </Text>
            {payments.slice(0, 5).map((payment, idx) => (
              <View key={idx} style={styles.paymentItem}>
                <Text style={styles.paymentAmount}>
                  {payment.amountSats?.toString() || 'N/A'} sats
                </Text>
                <Text style={styles.paymentStatus}>{payment.status}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonConnected: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    flex: 1,
    marginLeft: 8,
  },
  refreshButton: {
    padding: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  invoiceContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  invoice: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  feeText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  eventItem: {
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  eventTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  eventText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentStatus: {
    fontSize: 14,
    color: '#666',
  },
});
