import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';

// Import your actual Spark SDK functions
import {
  initializeSparkWallet,
  getSparkBalance,
  getSparkTransactions,
  sendSparkLightningPayment,
  sendSparkPayment,
  receiveSparkLightningPayment,
  getSparkLightningPaymentFeeEstimate,
} from '../functions/spark';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomKeyboardAvoidingView } from '../functions/CustomElements';

const SparkPerformanceTest = () => {
  const [mnemonic, setMnemonic] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [balance, setBalance] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Payment forms
  const [lightningInvoice, setLightningInvoice] = useState('');
  const [sparkAddress, setSparkAddress] = useState('');
  const [sparkAmount, setSparkAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMemo, setReceiveMemo] = useState('');

  const addLog = (message, duration = null, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      duration,
      type,
      id: Date.now() + Math.random(),
    };
    setLogs(prev => [logEntry, ...prev].slice(0, 50));
  };

  const measurePerformance = async (operation, fn) => {
    const startTime = Date.now();

    try {
      setIsProcessing(true);
      const result = await fn();

      const duration = Date.now() - startTime;

      addLog(`${operation} completed`, duration);

      return result;
    } catch (error) {
      addLog(`${operation} failed: ${error.message}`, null, 'error');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const initializeWallet = async () => {
    if (!mnemonic.trim()) {
      addLog('Please enter a mnemonic', null, 'error');
      return;
    }

    await measurePerformance('Initialize Wallet', async () => {
      const result = await initializeSparkWallet(mnemonic, true);
      console.log(result);
      if (result.isConnected) {
        setIsInitialized(true);
      }
      return result;
    });
  };

  const getBalance = async () => {
    if (!isInitialized) {
      addLog('Wallet not initialized', null, 'error');
      return;
    }

    await measurePerformance('Get Balance', async () => {
      const result = await getSparkBalance(mnemonic);
      if (result.didWork) {
        setBalance(result);
      }
      return result;
    });
  };

  const getTransactionHistory = async () => {
    if (!isInitialized) {
      addLog('Wallet not initialized', null, 'error');
      return;
    }

    await measurePerformance('Get Transactions', async () => {
      const result = await getSparkTransactions(100, 0, mnemonic);
      return result;
    });
  };

  const sendLightningPayment = async () => {
    if (!isInitialized || !lightningInvoice) {
      addLog('Missing required fields', null, 'error');
      return;
    }

    await measurePerformance('Get Lightning Fee Estimate', async () => {
      return await getSparkLightningPaymentFeeEstimate(
        lightningInvoice,
        0,
        mnemonic,
      );
    });

    await measurePerformance('Send Lightning Payment', async () => {
      const result = await sendSparkLightningPayment({
        invoice: lightningInvoice,
        maxFeeSats: 1000,
        mnemonic,
      });

      if (result.didWork) {
        setLightningInvoice('');
      }

      return result;
    });
  };

  const sendSparkPaymentHandler = async () => {
    if (!isInitialized || !sparkAddress || !sparkAmount) {
      addLog('Missing required fields', null, 'error');
      return;
    }

    await measurePerformance('Send Spark Payment', async () => {
      const result = await sendSparkPayment({
        receiverSparkAddress: sparkAddress,
        amountSats: parseInt(sparkAmount),
        mnemonic,
      });

      if (result.didWork) {
        setSparkAddress('');
        setSparkAmount('');
      }

      return result;
    });
  };

  const receiveLightningPayment = async () => {
    if (!isInitialized || !receiveAmount) {
      addLog('Missing required fields', null, 'error');
      return;
    }

    await measurePerformance('Create Lightning Invoice', async () => {
      const result = await receiveSparkLightningPayment({
        amountSats: parseInt(receiveAmount),
        memo: receiveMemo || 'Payment',
        mnemonic,
      });

      console.log(result);

      if (result.didWork) {
        addLog(
          `📋 Invoice: ${result.response.invoice.encodedInvoice?.substring(
            0,
            30,
          )}...`,
          null,
          'success',
        );
        setReceiveAmount('');
        setReceiveMemo('');
      }

      return result;
    });
  };

  const runStressTest = async () => {
    addLog('Starting stress test...', null, 'warning');

    const operations = [
      () => getBalance(),
      () => getTransactionHistory(),
      () => getBalance(),
      () => getTransactionHistory(),
    ];

    for (const op of operations) {
      await op();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    addLog('Stress test completed', null, 'success');
  };

  const LogItem = ({ log }) => {
    const backgroundColor =
      log.type === 'error'
        ? '#ef444420'
        : log.type === 'warning'
        ? '#f59e0b20'
        : log.type === 'success'
        ? '#10b98120'
        : '#ffffff10';

    const borderColor =
      log.type === 'error'
        ? '#ef4444'
        : log.type === 'warning'
        ? '#f59e0b'
        : log.type === 'success'
        ? '#10b981'
        : '#ffffff30';

    const durationColor =
      log.duration > 1000
        ? '#ef4444'
        : log.duration > 500
        ? '#f59e0b'
        : '#10b981';

    return (
      <View
        style={[
          styles.logItem,
          { backgroundColor, borderColor, borderWidth: 1 },
        ]}
      >
        <View style={styles.logHeader}>
          <Text style={styles.logTimestamp}>{log.timestamp}</Text>
          {log.duration && (
            <Text style={[styles.logDuration, { color: durationColor }]}>
              {log.duration.toFixed(0)}ms
            </Text>
          )}
        </View>
        <Text style={styles.logMessage}>{log.message}</Text>
      </View>
    );
  };

  return (
    <CustomKeyboardAvoidingView globalThemeViewStyles={styles.container}>
      {/* Performance Logs */}
      <View style={[styles.card, { maxHeight: 300 }]}>
        <View style={styles.logsHeader}>
          <Text style={styles.cardTitle}>Performance Logs</Text>
          {isProcessing && <ActivityIndicator color="#f59e0b" />}
        </View>
        <ScrollView nestedScrollEnabled={true}>
          {isProcessing && (
            <View style={styles.processingBanner}>
              <ActivityIndicator color="#f59e0b" />
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}

          <View style={styles.logsContainer}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLogs}>
                No operations yet. Start by initializing the wallet.
              </Text>
            ) : (
              logs.map(log => <LogItem key={log.id} log={log} />)
            )}
          </View>
        </ScrollView>
      </View>
      <ScrollView style={styles.scrollView}>
        {/* Initialize Wallet */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Initialize Wallet (all lowercase)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter mnemonic phrase"
            placeholderTextColor="#ffffff60"
            value={mnemonic}
            onChangeText={setMnemonic}
            editable={!isInitialized}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              (isInitialized || isProcessing) && styles.disabledButton,
            ]}
            onPress={initializeWallet}
            disabled={isInitialized || isProcessing}
          >
            <Text style={styles.buttonText}>
              {isInitialized ? 'Wallet Initialized' : 'Initialize Wallet'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Query Operations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Query Operations</Text>
          <TouchableOpacity
            style={[
              styles.button,
              styles.successButton,
              (!isInitialized || isProcessing) && styles.disabledButton,
            ]}
            onPress={getBalance}
            disabled={!isInitialized || isProcessing}
          >
            <Text style={styles.buttonText}>Get Balance</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.successButton,
              (!isInitialized || isProcessing) && styles.disabledButton,
            ]}
            onPress={getTransactionHistory}
            disabled={!isInitialized || isProcessing}
          >
            <Text style={styles.buttonText}>Get Transaction History</Text>
          </TouchableOpacity>

          {balance && (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceAmount}>
                {(Number(balance.balance) / 100000000).toFixed(8)} BTC
              </Text>
            </View>
          )}
        </View>

        {/* Send Lightning Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Send Lightning Payment</Text>
          <TextInput
            style={styles.input}
            placeholder="Lightning Invoice"
            placeholderTextColor="#ffffff60"
            value={lightningInvoice}
            onChangeText={setLightningInvoice}
          />
          <TouchableOpacity
            style={[
              styles.button,
              styles.warningButton,
              (!isInitialized || isProcessing) && styles.disabledButton,
            ]}
            onPress={sendLightningPayment}
            disabled={!isInitialized || isProcessing}
          >
            <Text style={styles.buttonText}>Send Lightning Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Send Spark Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Send Spark Payment</Text>
          <TextInput
            style={styles.input}
            placeholder="Spark Address"
            placeholderTextColor="#ffffff60"
            value={sparkAddress}
            onChangeText={setSparkAddress}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount (sats)"
            placeholderTextColor="#ffffff60"
            value={sparkAmount}
            onChangeText={setSparkAmount}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[
              styles.button,
              styles.secondaryButton,
              (!isInitialized || isProcessing) && styles.disabledButton,
            ]}
            onPress={sendSparkPaymentHandler}
            disabled={!isInitialized || isProcessing}
          >
            <Text style={styles.buttonText}>Send Spark Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Receive Lightning Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receive Lightning Payment</Text>
          <TextInput
            style={styles.input}
            placeholder="Amount (sats)"
            placeholderTextColor="#ffffff60"
            value={receiveAmount}
            onChangeText={setReceiveAmount}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Memo (optional)"
            placeholderTextColor="#ffffff60"
            value={receiveMemo}
            onChangeText={setReceiveMemo}
          />
          <TouchableOpacity
            style={[
              styles.button,
              styles.warningButton,
              (!isInitialized || isProcessing) && styles.disabledButton,
            ]}
            onPress={receiveLightningPayment}
            disabled={!isInitialized || isProcessing}
          >
            <Text style={styles.buttonText}>Create Invoice</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </CustomKeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  secondaryButton: {
    backgroundColor: '#8b5cf6',
  },
  disabledButton: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f59e0b20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginBottom: 12,
  },
  processingText: {
    color: '#f59e0b',
    fontWeight: '600',
    marginLeft: 8,
  },
  logsContainer: {
    maxHeight: 600,
  },
  emptyLogs: {
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTimestamp: {
    fontSize: 11,
    color: '#94a3b8',
  },
  logDuration: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  logMessage: {
    fontSize: 13,
    color: '#ffffff',
  },
  transactionItem: {
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: 13,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  transactionAmount: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  transactionStatus: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  instructionText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
  },
});

export default SparkPerformanceTest;
