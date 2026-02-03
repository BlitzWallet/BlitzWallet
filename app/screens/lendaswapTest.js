import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { GlobalThemeView, ThemeText } from '../functions/CustomElements';
import CustomButton from '../functions/CustomElements/button';
import GetThemeColors from '../hooks/themeColors';
import { useGlobalThemeContext } from '../../context-store/theme';
import { COLORS, FONT, SIZES, WINDOWWIDTH } from '../constants';
import {
  Client,
  InMemoryWalletStorage,
  InMemorySwapStorage,
} from '@lendasat/lendaswap-sdk-pure';
import {
  formatSats,
  formatAmount,
  getStatusText,
  getStatusColor,
  shortenAddress,
  formatRelativeTime,
  TokenInfo,
} from '../functions/lendaswap/utils';

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
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const {
    textColor,
    backgroundColor,
    backgroundOffset,
    textInputBackground,
    textInputColor,
  } = GetThemeColors();

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
  const [activeTab, setActiveTab] = useState('swap'); // swap | history | info

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
      setActiveSwap(result);
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
      const result = await client.claimEvmSwap(activeSwap.id);
      Alert.alert('Claim submitted', `TX: ${result.tx_hash || 'pending'}`);
      refreshSwapStatus();
    } catch (err) {
      console.error('Failed to claim swap:', err);
      setError(err.message || 'Failed to claim');
    }
  }, [client, activeSwap?.id, refreshSwapStatus]);

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const renderHeader = () => (
    <View style={styles.header}>
      <ThemeText
        content="Lendaswap Test"
        styles={{ ...styles.headerTitle, color: textColor }}
      />
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: initialized ? '#28A745' : backgroundOffset },
        ]}
      >
        <ThemeText
          content={initialized ? 'Connected' : 'Not Connected'}
          styles={{
            ...styles.statusText,
            color: initialized ? '#fff' : textColor,
          }}
        />
      </View>
    </View>
  );

  const renderTabs = () => (
    <View
      style={[styles.tabContainer, { borderBottomColor: backgroundOffset }]}
    >
      {['swap', 'history', 'info'].map(tab => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            activeTab === tab && {
              borderBottomColor: COLORS.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab(tab)}
        >
          <ThemeText
            content={tab.charAt(0).toUpperCase() + tab.slice(1)}
            styles={{
              ...styles.tabText,
              color: activeTab === tab ? COLORS.primary : textColor,
            }}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderInitSection = () => (
    <View style={styles.section}>
      <ThemeText
        content="SDK Initialization"
        styles={{ ...styles.sectionTitle, color: textColor }}
      />
      {!initialized ? (
        <CustomButton
          actionFunction={initializeClient}
          textContent={initializing ? 'Initializing...' : 'Initialize Client'}
          useLoading={initializing}
          buttonStyles={{
            ...styles.primaryButton,
            opacity: initializing ? 0.6 : 1,
          }}
        />
      ) : (
        <View style={[styles.infoCard, { backgroundColor: backgroundOffset }]}>
          <ThemeText
            content="Client initialized with in-memory storage"
            styles={{ ...styles.infoText, color: textColor }}
          />
          {mnemonic && (
            <ThemeText
              content={`Mnemonic: ${mnemonic
                .split(' ')
                .slice(0, 3)
                .join(' ')}...`}
              styles={{
                ...styles.infoTextSmall,
                color: textColor,
                opacity: 0.7,
              }}
            />
          )}
        </View>
      )}
      {error && !initialized && (
        <ThemeText content={`Error: ${error}`} styles={styles.errorText} />
      )}
    </View>
  );

  const renderSwapTab = () => (
    <View>
      {renderInitSection()}

      {initialized && (
        <>
          {/* Direction Selection */}
          <View style={styles.section}>
            <ThemeText
              content="Swap Direction"
              styles={{ ...styles.sectionTitle, color: textColor }}
            />
            {SWAP_DIRECTIONS.map((dir, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.directionOption,
                  {
                    backgroundColor:
                      selectedDirection === idx
                        ? COLORS.primary
                        : backgroundOffset,
                    borderColor:
                      selectedDirection === idx
                        ? COLORS.primary
                        : backgroundOffset,
                  },
                ]}
                onPress={() => {
                  setSelectedDirection(idx);
                  setQuote(null);
                }}
              >
                <ThemeText
                  content={dir.label}
                  styles={{
                    ...styles.directionText,
                    color: selectedDirection === idx ? '#fff' : textColor,
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Input */}
          <View style={styles.section}>
            <ThemeText
              content="Amount (sats)"
              styles={{ ...styles.sectionTitle, color: textColor }}
            />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: textInputBackground, color: textInputColor },
              ]}
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 100000"
              placeholderTextColor={COLORS.opaicityGray}
              keyboardType="numeric"
            />
            <CustomButton
              actionFunction={fetchQuote}
              textContent="Get Quote"
              useLoading={loadingQuote}
              disabled={!amount}
              buttonStyles={{
                ...styles.secondaryButton,
                backgroundColor: COLORS.primary,
                opacity: !amount ? 0.5 : 1,
              }}
              textStyles={{ color: '#fff' }}
            />
          </View>

          {/* Quote Display */}
          {quote && (
            <View
              style={[styles.quoteCard, { backgroundColor: backgroundOffset }]}
            >
              <ThemeText
                content="Quote"
                styles={{ ...styles.sectionTitle, color: textColor }}
              />
              <View style={styles.quoteRow}>
                <ThemeText
                  content="You send:"
                  styles={{ ...styles.quoteLabel, color: textColor }}
                />
                <ThemeText
                  content={`${amount} sats`}
                  styles={{ ...styles.quoteValue, color: textColor }}
                />
              </View>
              <View style={styles.quoteRow}>
                <ThemeText
                  content="You receive:"
                  styles={{ ...styles.quoteLabel, color: textColor }}
                />
                <ThemeText
                  content={`${quote}`}
                  styles={{ ...styles.quoteValue, color: COLORS.nostrGreen }}
                />
              </View>
            </View>
          )}

          {/* Destination Address */}
          <View style={styles.section}>
            <ThemeText
              content="EVM Destination Address"
              styles={{ ...styles.sectionTitle, color: textColor }}
            />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: textInputBackground, color: textInputColor },
              ]}
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              placeholder="0x..."
              placeholderTextColor={COLORS.opaicityGray}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Create Swap */}
          <View style={styles.section}>
            <CustomButton
              actionFunction={createSwap}
              textContent="Create Swap"
              useLoading={creatingSwap}
              disabled={!amount || !destinationAddress}
              buttonStyles={{
                ...styles.primaryButton,
                opacity: !amount || !destinationAddress ? 0.5 : 1,
              }}
            />
          </View>

          {/* Active Swap Display */}
          {activeSwap && (
            <View
              style={[styles.swapCard, { backgroundColor: backgroundOffset }]}
            >
              <ThemeText
                content="Active Swap"
                styles={{ ...styles.sectionTitle, color: textColor }}
              />

              <View style={styles.swapRow}>
                <ThemeText
                  content="ID:"
                  styles={{ ...styles.swapLabel, color: textColor }}
                />
                <ThemeText
                  content={shortenAddress(
                    activeSwap.id || activeSwap.swapId || 'N/A',
                    8,
                  )}
                  styles={{ ...styles.swapValue, color: textColor }}
                />
              </View>

              <View style={styles.swapRow}>
                <ThemeText
                  content="Status:"
                  styles={{ ...styles.swapLabel, color: textColor }}
                />
                <View
                  style={[
                    styles.swapStatusBadge,
                    { backgroundColor: getStatusColor(activeSwap.status) },
                  ]}
                >
                  <ThemeText
                    content={
                      getStatusText(activeSwap.status) ||
                      activeSwap.status ||
                      'Unknown'
                    }
                    styles={{ ...styles.swapStatusText }}
                  />
                </View>
              </View>

              {activeSwap.lightning_invoice && (
                <View style={styles.swapRow}>
                  <ThemeText
                    content="Invoice:"
                    styles={{ ...styles.swapLabel, color: textColor }}
                  />
                  <ThemeText
                    content={shortenAddress(activeSwap.lightning_invoice, 12)}
                    styles={{
                      ...styles.swapValue,
                      color: textColor,
                      fontSize: SIZES.small,
                    }}
                  />
                </View>
              )}

              <View style={styles.swapActions}>
                <CustomButton
                  actionFunction={refreshSwapStatus}
                  textContent="Refresh"
                  buttonStyles={{
                    ...styles.actionButton,
                    backgroundColor: COLORS.primary,
                  }}
                  textStyles={{ color: '#fff', fontSize: SIZES.small }}
                />
                {activeSwap.status === 'serverfunded' && (
                  <CustomButton
                    actionFunction={claimSwap}
                    textContent="Claim"
                    buttonStyles={{
                      ...styles.actionButton,
                      backgroundColor: COLORS.nostrGreen,
                    }}
                    textStyles={{ color: '#fff', fontSize: SIZES.small }}
                  />
                )}
              </View>
            </View>
          )}
        </>
      )}

      {error && initialized && (
        <View style={styles.section}>
          <ThemeText content={`Error: ${error}`} styles={styles.errorText} />
        </View>
      )}
    </View>
  );

  const renderHistoryTab = () => {
    const loadHistory = async () => {
      if (!client) return;
      setLoadingHistory(true);
      try {
        const stored = client.getStoredSwaps
          ? await client.getStoredSwaps()
          : [];
        setSwapHistory(Array.isArray(stored) ? stored : []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    return (
      <View>
        {!initialized ? (
          <View style={styles.section}>
            <ThemeText
              content="Initialize the SDK to view swap history"
              styles={{
                ...styles.infoText,
                color: textColor,
                textAlign: 'center',
              }}
            />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <CustomButton
                actionFunction={loadHistory}
                textContent="Load History"
                useLoading={loadingHistory}
                buttonStyles={{
                  ...styles.secondaryButton,
                  backgroundColor: COLORS.primary,
                }}
                textStyles={{ color: '#fff' }}
              />
            </View>

            {swapHistory.length === 0 ? (
              <View style={styles.section}>
                <ThemeText
                  content="No swap history found"
                  styles={{
                    ...styles.infoText,
                    color: textColor,
                    textAlign: 'center',
                    opacity: 0.6,
                  }}
                />
              </View>
            ) : (
              swapHistory.map((swap, idx) => (
                <View
                  key={swap.swapId || idx}
                  style={[
                    styles.historyItem,
                    { backgroundColor: backgroundOffset },
                  ]}
                >
                  <View style={styles.historyHeader}>
                    <ThemeText
                      content={shortenAddress(
                        swap.swapId || swap.id || 'N/A',
                        6,
                      )}
                      styles={{ ...styles.historyId, color: textColor }}
                    />
                    <View
                      style={[
                        styles.swapStatusBadge,
                        {
                          backgroundColor: getStatusColor(
                            swap.response?.status,
                          ),
                        },
                      ]}
                    >
                      <ThemeText
                        content={
                          getStatusText(swap.response?.status) || 'Unknown'
                        }
                        styles={styles.swapStatusText}
                      />
                    </View>
                  </View>
                  {swap.storedAt && (
                    <ThemeText
                      content={formatRelativeTime(swap.storedAt)}
                      styles={{
                        ...styles.historyDate,
                        color: textColor,
                        opacity: 0.6,
                      }}
                    />
                  )}
                </View>
              ))
            )}
          </>
        )}
      </View>
    );
  };

  const renderInfoTab = () => (
    <View>
      {!initialized ? (
        <View style={styles.section}>
          <ThemeText
            content="Initialize the SDK to view info"
            styles={{
              ...styles.infoText,
              color: textColor,
              textAlign: 'center',
            }}
          />
        </View>
      ) : (
        <>
          <View
            style={[styles.infoCard, { backgroundColor: backgroundOffset }]}
          >
            <ThemeText
              content="SDK Info"
              styles={{ ...styles.sectionTitle, color: textColor }}
            />

            <View style={styles.infoRow}>
              <ThemeText
                content="Status"
                styles={{ ...styles.infoLabel, color: textColor }}
              />
              <ThemeText
                content="Connected"
                styles={{ ...styles.infoValue, color: COLORS.nostrGreen }}
              />
            </View>

            <View style={styles.infoRow}>
              <ThemeText
                content="Storage"
                styles={{ ...styles.infoLabel, color: textColor }}
              />
              <ThemeText
                content="In-Memory"
                styles={{ ...styles.infoValue, color: textColor }}
              />
            </View>

            {mnemonic && (
              <View style={styles.infoRow}>
                <ThemeText
                  content="Mnemonic"
                  styles={{ ...styles.infoLabel, color: textColor }}
                />
                <ThemeText
                  content={`${mnemonic.split(' ').slice(0, 4).join(' ')}...`}
                  styles={{
                    ...styles.infoValue,
                    color: textColor,
                    fontSize: SIZES.small,
                  }}
                />
              </View>
            )}
          </View>

          {/* Asset Pairs */}
          <View
            style={[styles.infoCard, { backgroundColor: backgroundOffset }]}
          >
            <View style={styles.pairsHeader}>
              <ThemeText
                content="Asset Pairs"
                styles={{ ...styles.sectionTitle, color: textColor }}
              />
              <CustomButton
                actionFunction={fetchPairs}
                textContent="Refresh"
                useLoading={loadingPairs}
                buttonStyles={{
                  ...styles.smallButton,
                  backgroundColor: COLORS.primary,
                }}
                textStyles={{ color: '#fff', fontSize: SIZES.xSmall }}
              />
            </View>

            {pairs.length === 0 && !loadingPairs ? (
              <ThemeText
                content="No pairs loaded"
                styles={{ ...styles.infoText, color: textColor, opacity: 0.6 }}
              />
            ) : (
              pairs.map((pair, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.pairItem,
                    { borderBottomColor: backgroundOffset },
                  ]}
                >
                  <ThemeText
                    content={`${pair.from || pair[0] || 'N/A'} -> ${
                      pair.to || pair[1] || 'N/A'
                    }`}
                    styles={{ ...styles.pairText, color: textColor }}
                  />
                </View>
              ))
            )}
          </View>

          {/* Supported Directions */}
          <View
            style={[styles.infoCard, { backgroundColor: backgroundOffset }]}
          >
            <ThemeText
              content="Supported Swap Types"
              styles={{ ...styles.sectionTitle, color: textColor }}
            />
            {[
              'Lightning -> EVM (USDC, USDT)',
              'Arkade -> EVM',
              'On-chain BTC -> EVM',
              'EVM -> Lightning',
              'EVM -> Arkade',
            ].map((type, idx) => (
              <View key={idx} style={styles.typeRow}>
                <ThemeText
                  content={type}
                  styles={{ ...styles.typeText, color: textColor }}
                />
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
    <GlobalThemeView>
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
    </GlobalThemeView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
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
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Bold,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Title_Medium,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Medium,
  },

  // Sections
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Bold,
    marginBottom: 8,
  },

  // Buttons
  primaryButton: {
    minWidth: '100%',
    minHeight: 48,
    borderRadius: 8,
  },
  secondaryButton: {
    minWidth: '100%',
    minHeight: 42,
    borderRadius: 8,
    marginTop: 8,
  },
  actionButton: {
    minWidth: 90,
    minHeight: 36,
    borderRadius: 6,
    marginRight: 8,
  },
  smallButton: {
    minWidth: 70,
    minHeight: 30,
    borderRadius: 6,
  },

  // Inputs
  input: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Regular,
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
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Medium,
  },

  // Quote
  quoteCard: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quoteLabel: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
  },
  quoteValue: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Bold,
  },

  // Swap card
  swapCard: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  swapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  swapLabel: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
  },
  swapValue: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Medium,
  },
  swapStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  swapStatusText: {
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Title_Medium,
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
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Medium,
  },
  infoText: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
  },
  infoTextSmall: {
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Title_Regular,
    marginTop: 4,
  },

  // History
  historyItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyId: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Medium,
  },
  historyDate: {
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Title_Regular,
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
  },
  pairText: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
  },

  // Types
  typeRow: {
    paddingVertical: 4,
  },
  typeText: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
  },

  // Error
  errorText: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
    color: COLORS.cancelRed,
    marginTop: 8,
  },
});
