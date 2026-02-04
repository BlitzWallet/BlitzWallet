import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import {
  Client,
  InMemoryWalletStorage,
  InMemorySwapStorage,
} from '@lendasat/lendaswap-sdk-pure';
import {
  getStatusText,
  getStatusColor,
  shortenAddress,
  formatRelativeTime,
} from '../functions/lendaswap/utils';
import * as ExpoSplashScreen from 'expo-splash-screen';

// ============================================================================
// Constants
// ============================================================================

const SWAP_DIRECTIONS = [
  {
    label: 'BTC Lightning -> USDC (Polygon)',
    from: 'btc_lightning',
    to: 'usdc_pol',
  },
  {
    label: 'BTC Lightning -> USDT (Polygon)',
    from: 'btc_lightning',
    to: 'usdt_pol',
  },
];

// ============================================================================
// Main Component
// ============================================================================

export default function LendaswapTest() {
  // SDK state
  const [client, setClient] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [mnemonic, setMnemonic] = useState(null);
  const [error, setError] = useState(null);

  // Pairs & quotes
  const [pairs, setPairs] = useState([]);
  const [loadingPairs, setLoadingPairs] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState(0);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Swap state
  const [activeSwap, setActiveSwap] = useState(null);
  const [creatingSwap, setCreatingSwap] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [swapHistory, setSwapHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('swap');

  useEffect(() => {
    ExpoSplashScreen.hide();
  }, []);

  // ==========================================================================
  // Initialize SDK Client
  // ==========================================================================

  const initializeClient = useCallback(async () => {
    if (initializing || initialized) return;
    setInitializing(true);
    setError(null);

    try {
      const sdkClient = await Client.builder()
        .withSignerStorage(new InMemoryWalletStorage())
        .withSwapStorage(new InMemorySwapStorage())
        .build();

      setClient(sdkClient);
      setMnemonic(sdkClient.getMnemonic());
      setInitialized(true);
    } catch (err) {
      console.error('Failed to initialize Lendaswap client:', err);
      setError(err.message || 'Failed to initialize');
    } finally {
      setInitializing(false);
    }
  }, [initializing, initialized]);

  // ==========================================================================
  // Fetch Asset Pairs
  // ==========================================================================

  const fetchPairs = useCallback(async () => {
    if (!client) return;
    setLoadingPairs(true);

    try {
      const result = await client.getAssetPairs();
      setPairs(result);
    } catch (err) {
      console.error('Failed to fetch pairs:', err);
    } finally {
      setLoadingPairs(false);
    }
  }, [client]);

  useEffect(() => {
    if (initialized && client) {
      fetchPairs();
    }
  }, [initialized, client, fetchPairs]);

  // ==========================================================================
  // Get Quote
  // ==========================================================================

  const fetchQuote = useCallback(async () => {
    if (!client || !amount) return;
    setLoadingQuote(true);
    setQuote(null);

    const direction = SWAP_DIRECTIONS[selectedDirection];
    try {
      const result = await client.getQuote(
        direction.from,
        direction.to,
        parseInt(amount, 10),
      );
      console.log(result);
      setQuote(result);
    } catch (err) {
      console.error('Failed to get quote:', err);
      setError(err.message || 'Failed to get quote');
    } finally {
      setLoadingQuote(false);
    }
  }, [client, amount, selectedDirection]);

  // ==========================================================================
  // Create Swap
  // ==========================================================================

  const createSwap = useCallback(async () => {
    if (!client || !amount || !destinationAddress) {
      Alert.alert(
        'Missing fields',
        'Please enter amount and destination address.',
      );
      return;
    }
    setCreatingSwap(true);
    setError(null);

    const direction = SWAP_DIRECTIONS[selectedDirection];
    try {
      const result = await client.createLightningToEvmSwap({
        targetAddress: destinationAddress,
        targetToken: direction.to,
        targetChain: direction.to.includes('pol') ? 'polygon' : 'arbitrum',
        sourceAmount: parseInt(amount, 10),
      });
      console.log(result);
      setActiveSwap(result.response);
    } catch (err) {
      console.error('Failed to create swap:', err);
      setError(err.message || 'Failed to create swap');
    } finally {
      setCreatingSwap(false);
    }
  }, [client, amount, destinationAddress, selectedDirection]);

  // ==========================================================================
  // Get Swap Status
  // ==========================================================================

  const refreshSwapStatus = useCallback(async () => {
    if (!client || !activeSwap?.id) return;

    try {
      const result = await client.getSwap(activeSwap.id);
      console.log(result);
      setActiveSwap(result);
    } catch (err) {
      console.error('Failed to refresh swap status:', err);
    }
  }, [client, activeSwap?.id]);

  // ==========================================================================
  // Claim EVM Swap
  // ==========================================================================

  const claimSwap = useCallback(async () => {
    if (!client || !activeSwap?.id) return;

    try {
      const result = await client.claim(activeSwap.id);
      Alert.alert('Claim submitted', `TX: ${result.tx_hash || 'pending'}`);
      refreshSwapStatus();
    } catch (err) {
      console.error('Failed to claim swap:', err);
      setError(err.message || 'Failed to claim');
    }
  }, [client, activeSwap?.id, refreshSwapStatus]);

  // ==========================================================================
  // Load History
  // ==========================================================================

  const loadHistory = useCallback(async () => {
    if (!client) return;
    setLoadingHistory(true);
    try {
      const stored = client.getStoredSwaps ? await client.getStoredSwaps() : [];
      setSwapHistory(Array.isArray(stored) ? stored : []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [client]);

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Lendaswap Test</Text>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: initialized ? '#28A745' : '#6C757D',
          },
        ]}
      >
        <Text style={styles.statusText}>
          {initialized ? 'Connected' : 'Not Connected'}
        </Text>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {['swap', 'history', 'info'].map(tab => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Text
            style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderInitSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>SDK Initialization</Text>
      {!initialized ? (
        <TouchableOpacity
          style={[styles.primaryButton, initializing && { opacity: 0.6 }]}
          onPress={initializeClient}
          disabled={initializing}
        >
          {initializing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Initialize Client</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Client initialized with in-memory storage
          </Text>
          {mnemonic && (
            <Text style={styles.infoTextSmall}>
              {`Mnemonic: ${mnemonic.split(' ').slice(0, 3).join(' ')}...`}
            </Text>
          )}
        </View>
      )}
      {error && !initialized && (
        <Text style={styles.errorText}>{`Error: ${error}`}</Text>
      )}
    </View>
  );
  console.log(activeSwap);
  const renderSwapTab = () => (
    <View>
      {renderInitSection()}

      {initialized && (
        <>
          {/* Direction Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Swap Direction</Text>
            {SWAP_DIRECTIONS.map((dir, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.directionOption,
                  {
                    backgroundColor:
                      selectedDirection === idx ? '#0375F6' : '#2a2a2a',
                    borderColor: selectedDirection === idx ? '#0375F6' : '#444',
                  },
                ]}
                onPress={() => {
                  setSelectedDirection(idx);
                  setQuote(null);
                }}
              >
                <Text
                  style={[
                    styles.directionText,
                    {
                      color: selectedDirection === idx ? '#fff' : '#ccc',
                    },
                  ]}
                >
                  {dir.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount (sats)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 100000"
              placeholderTextColor="#767676"
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.secondaryButton, { opacity: !amount ? 0.5 : 1 }]}
              onPress={fetchQuote}
              disabled={!amount || loadingQuote}
            >
              {loadingQuote ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Get Quote</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Quote Display */}
          {quote && (
            <View style={styles.quoteCard}>
              <Text style={styles.sectionTitle}>Quote</Text>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>You send:</Text>
                <Text style={styles.quoteValue}>{`${amount} sats`}</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>You receive:</Text>
                <Text style={[styles.quoteValue, { color: '#29C467' }]}>
                  {`${amount - quote.network_fee - quote.protocol_fee}`}
                </Text>
              </View>
            </View>
          )}

          {/* Destination Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EVM Destination Address</Text>
            <TextInput
              style={styles.input}
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              placeholder="0x..."
              placeholderTextColor="#767676"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Create Swap */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { opacity: !amount || !destinationAddress ? 0.5 : 1 },
              ]}
              onPress={createSwap}
              disabled={!amount || !destinationAddress || creatingSwap}
            >
              {creatingSwap ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Swap</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Active Swap Display */}
          {activeSwap && (
            <View style={styles.swapCard}>
              <Text style={styles.sectionTitle}>Active Swap</Text>

              <View style={styles.swapRow}>
                <Text style={styles.swapLabel}>ID:</Text>
                <Text style={styles.swapValue}>
                  {shortenAddress(
                    activeSwap.id || activeSwap.swapId || 'N/A',
                    8,
                  )}
                </Text>
              </View>

              <View style={styles.swapRow}>
                <Text style={styles.swapLabel}>Status:</Text>
                <View
                  style={[
                    styles.swapStatusBadge,
                    { backgroundColor: getStatusColor(activeSwap.status) },
                  ]}
                >
                  <Text style={styles.swapStatusText}>
                    {getStatusText(activeSwap.status) ||
                      activeSwap.status ||
                      'Unknown'}
                  </Text>
                </View>
              </View>

              {activeSwap.lightning_invoice && (
                <View style={styles.swapRow}>
                  <Text style={styles.swapLabel}>Invoice:</Text>
                  <Text style={[styles.swapValue, { fontSize: 11 }]}>
                    {shortenAddress(activeSwap.lightning_invoice, 12)}
                  </Text>
                </View>
              )}

              <View style={styles.swapActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#0375F6' }]}
                  onPress={refreshSwapStatus}
                >
                  <Text style={styles.actionButtonText}>Refresh</Text>
                </TouchableOpacity>
                {activeSwap.status === 'serverfunded' && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: '#29C467' },
                    ]}
                    onPress={claimSwap}
                  >
                    <Text style={styles.actionButtonText}>Claim</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </>
      )}

      {error && initialized && (
        <View style={styles.section}>
          <Text style={styles.errorText}>{`Error: ${error}`}</Text>
        </View>
      )}
    </View>
  );

  const renderHistoryTab = () => (
    <View>
      {!initialized ? (
        <View style={styles.section}>
          <Text style={[styles.infoText, { textAlign: 'center' }]}>
            Initialize the SDK to view swap history
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={loadHistory}
              disabled={loadingHistory}
            >
              {loadingHistory ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Load History</Text>
              )}
            </TouchableOpacity>
          </View>

          {swapHistory.length === 0 ? (
            <View style={styles.section}>
              <Text
                style={[styles.infoText, { textAlign: 'center', opacity: 0.6 }]}
              >
                No swap history found
              </Text>
            </View>
          ) : (
            swapHistory.map((swap, idx) => (
              <View key={swap.swapId || idx} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyId}>
                    {shortenAddress(swap.swapId || swap.id || 'N/A', 6)}
                  </Text>
                  <View
                    style={[
                      styles.swapStatusBadge,
                      {
                        backgroundColor: getStatusColor(swap.response?.status),
                      },
                    ]}
                  >
                    <Text style={styles.swapStatusText}>
                      {getStatusText(swap.response?.status) || 'Unknown'}
                    </Text>
                  </View>
                </View>
                {swap.storedAt && (
                  <Text style={[styles.historyDate, { opacity: 0.6 }]}>
                    {formatRelativeTime(swap.storedAt)}
                  </Text>
                )}
              </View>
            ))
          )}
        </>
      )}
    </View>
  );

  const renderInfoTab = () => (
    <View>
      {!initialized ? (
        <View style={styles.section}>
          <Text style={[styles.infoText, { textAlign: 'center' }]}>
            Initialize the SDK to view info
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>SDK Info</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: '#29C467' }]}>
                Connected
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Storage</Text>
              <Text style={styles.infoValue}>In-Memory</Text>
            </View>

            {mnemonic && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mnemonic</Text>
                <Text style={[styles.infoValue, { fontSize: 11 }]}>
                  {`${mnemonic.split(' ').slice(0, 4).join(' ')}...`}
                </Text>
              </View>
            )}
          </View>

          {/* Asset Pairs */}
          <View style={styles.infoCard}>
            <View style={styles.pairsHeader}>
              <Text style={styles.sectionTitle}>Asset Pairs</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={fetchPairs}
                disabled={loadingPairs}
              >
                {loadingPairs ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Refresh</Text>
                )}
              </TouchableOpacity>
            </View>

            {pairs.length === 0 && !loadingPairs ? (
              <Text style={[styles.infoText, { opacity: 0.6 }]}>
                No pairs loaded
              </Text>
            ) : (
              pairs.map((pair, idx) => (
                <View key={idx} style={styles.pairItem}>
                  <Text style={styles.pairText}>
                    {`${pair.from || pair[0] || 'N/A'} -> ${
                      pair.to || pair[1] || 'N/A'
                    }`}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Supported Directions */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Supported Swap Types</Text>
            {[
              'Lightning -> EVM (USDC, USDT)',
              'Arkade -> EVM',
              'On-chain BTC -> EVM',
              'EVM -> Lightning',
              'EVM -> Arkade',
            ].map((type, idx) => (
              <View key={idx} style={styles.typeRow}>
                <Text style={styles.typeText}>{type}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderTabs()}

        {activeTab === 'swap' && renderSwapTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'info' && renderInfoTab()}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 50,
  },
  container: {
    flex: 1,
    width: '95%',
    alignSelf: 'center',
  },
  contentContainer: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0375F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: '#0375F6',
  },

  // Sections
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },

  // Buttons
  primaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0375F6',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0375F6',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionButton: {
    minWidth: 90,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  smallButton: {
    minWidth: 70,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#0375F6',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Inputs
  input: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 14,
    backgroundColor: '#2a2a2a',
    color: '#fff',
    marginBottom: 5,
  },

  // Direction
  directionOption: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
  },
  directionText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Quote
  quoteCard: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    backgroundColor: '#2a2a2a',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quoteLabel: {
    fontSize: 12,
    color: '#ccc',
  },
  quoteValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Swap card
  swapCard: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    backgroundColor: '#2a2a2a',
  },
  swapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  swapLabel: {
    fontSize: 12,
    color: '#ccc',
  },
  swapValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  swapStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  swapStatusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
  swapActions: {
    flexDirection: 'row',
    marginTop: 10,
  },

  // Info
  infoCard: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 8,
    backgroundColor: '#2a2a2a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  infoText: {
    fontSize: 12,
    color: '#ccc',
  },
  infoTextSmall: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },

  // History
  historyItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#2a2a2a',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyId: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  historyDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },

  // Pairs
  pairsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pairItem: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#444',
  },
  pairText: {
    fontSize: 12,
    color: '#ccc',
  },

  // Types
  typeRow: {
    paddingVertical: 4,
  },
  typeText: {
    fontSize: 12,
    color: '#ccc',
  },

  // Error
  errorText: {
    fontSize: 12,
    color: '#e20000',
    marginTop: 8,
  },
});
