import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  WALLET: '@lendaswap:wallet',
  SWAPS: '@lendaswap:swaps',
  MNEMONIC: '@lendaswap:mnemonic',
  METADATA: '@lendaswap:metadata',
};

// ============================================================================
// AsyncStorageAdapter Class
// ============================================================================

/**
 * AsyncStorage adapter that implements the storage interface
 * required by Lendaswap SDK (mimics SqliteStorageHandle)
 */
export class AsyncStorageAdapter {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize storage
   */
  async init() {
    if (this.initialized) return;

    try {
      // Create default storage structure if needed
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.METADATA);
      if (!existing) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.METADATA,
          JSON.stringify({
            version: '1.0.0',
            createdAt: Date.now(),
          }),
        );
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Save wallet data
   */
  async saveWallet(walletData) {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.WALLET,
        JSON.stringify(walletData),
      );
    } catch (error) {
      console.error('Failed to save wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet data
   */
  async getWallet() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WALLET);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get wallet:', error);
      return null;
    }
  }

  /**
   * Save mnemonic
   */
  async saveMnemonic(mnemonic) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MNEMONIC, mnemonic);
    } catch (error) {
      console.error('Failed to save mnemonic:', error);
      throw error;
    }
  }

  /**
   * Get mnemonic
   */
  async getMnemonic() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.MNEMONIC);
    } catch (error) {
      console.error('Failed to get mnemonic:', error);
      return null;
    }
  }

  /**
   * Save a swap
   */
  async saveSwap(swap) {
    try {
      const swaps = await this.getAllSwaps();

      // Update or add swap
      const index = swaps.findIndex(s => s.id === swap.id);
      if (index >= 0) {
        swaps[index] = { ...swap, updatedAt: Date.now() };
      } else {
        swaps.push({ ...swap, createdAt: Date.now(), updatedAt: Date.now() });
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SWAPS, JSON.stringify(swaps));
    } catch (error) {
      console.error('Failed to save swap:', error);
      throw error;
    }
  }

  /**
   * Get a swap by ID
   */
  async getSwap(swapId) {
    try {
      const swaps = await this.getAllSwaps();
      return swaps.find(s => s.id === swapId) || null;
    } catch (error) {
      console.error('Failed to get swap:', error);
      return null;
    }
  }

  /**
   * Get all swaps
   */
  async getAllSwaps() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SWAPS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all swaps:', error);
      return [];
    }
  }

  /**
   * Delete a swap
   */
  async deleteSwap(swapId) {
    try {
      const swaps = await this.getAllSwaps();
      const filtered = swaps.filter(s => s.id !== swapId);
      await AsyncStorage.setItem(STORAGE_KEYS.SWAPS, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete swap:', error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clear() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.WALLET,
        STORAGE_KEYS.SWAPS,
        STORAGE_KEYS.MNEMONIC,
        STORAGE_KEYS.METADATA,
      ]);
      this.initialized = false;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      const swaps = await this.getAllSwaps();
      const wallet = await this.getWallet();

      return {
        totalSwaps: swaps.length,
        hasWallet: !!wallet,
        storageUsed: JSON.stringify({ swaps, wallet }).length,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalSwaps: 0,
        hasWallet: false,
        storageUsed: 0,
      };
    }
  }

  /**
   * Static factory method (mimics SqliteStorageHandle.open)
   */
  static open() {
    return new AsyncStorageAdapter();
  }
}

// ============================================================================
// Additional Storage Utilities
// ============================================================================

/**
 * Backup all storage data
 */
export async function backupStorage() {
  try {
    const keys = Object.values(STORAGE_KEYS);
    const items = await AsyncStorage.multiGet(keys);

    const backup = {};
    items.forEach(([key, value]) => {
      if (value) {
        backup[key] = JSON.parse(value);
      }
    });

    return {
      timestamp: Date.now(),
      data: backup,
    };
  } catch (error) {
    console.error('Failed to backup storage:', error);
    throw error;
  }
}

/**
 * Restore storage from backup
 */
export async function restoreStorage(backup) {
  try {
    if (!backup || !backup.data) {
      throw new Error('Invalid backup format');
    }

    const entries = Object.entries(backup.data).map(([key, value]) => [
      key,
      JSON.stringify(value),
    ]);

    await AsyncStorage.multiSet(entries);
  } catch (error) {
    console.error('Failed to restore storage:', error);
    throw error;
  }
}

/**
 * Export storage as JSON string
 */
export async function exportStorage() {
  try {
    const backup = await backupStorage();
    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Failed to export storage:', error);
    throw error;
  }
}

/**
 * Import storage from JSON string
 */
export async function importStorage(jsonString) {
  try {
    const backup = JSON.parse(jsonString);
    await restoreStorage(backup);
  } catch (error) {
    console.error('Failed to import storage:', error);
    throw error;
  }
}
