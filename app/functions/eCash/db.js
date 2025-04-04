import * as SQLite from 'expo-sqlite';
import EventEmitter from 'events';
export const ECASH_DB_NAME = 'ECASH_STORAGE';
export const PROOF_TABLE_NAME = 'PROOFS_TABLE';
export const MINTS_TABLE_NAME = 'MINTS_TABLE';
export const TRANSACTIONS_TABLE_NAME = 'TRANSACTION_TABLE';
export const PROOF_EVENT_UPDATE_NAME = 'PROOFS_EVENT_UPDATE';
export const MINT_EVENT_UPDATE_NAME = 'MINT_EVENT_UPDATE';
export const TRANSACTIONS_EVENT_UPDATE_NAME = 'TRANSACTIONS_EVENT_UPDATE';
export const sqlEventEmitter = new EventEmitter();

let sqlLiteDB;
if (!sqlLiteDB) {
  async function openDBConnection() {
    sqlLiteDB = await SQLite.openDatabaseAsync(`${ECASH_DB_NAME}.db`);
  }
  openDBConnection();
}

export const initEcashDBTables = async () => {
  try {
    await sqlLiteDB.runAsync(`PRAGMA journal_mode = WAL;`);
    await sqlLiteDB.runAsync(`PRAGMA foreign_keys = ON;`);
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');

    // Mints Table
    await sqlLiteDB.runAsync(`CREATE TABLE IF NOT EXISTS ${MINTS_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mintURL TEXT UNIQUE,
        counter INTEGER DEFAULT 0,
        isSelected INTEGER DEFAULT 0
      );`);

    // Proofs Table
    await sqlLiteDB.runAsync(`CREATE TABLE IF NOT EXISTS ${PROOF_TABLE_NAME} (
        proofIndex INTEGER PRIMARY KEY AUTOINCREMENT,
        id INTEGER,
        amount INTEGER,
        secret TEXT UNIQUE,
        C TEXT,
        dleq TEXT,
        dleqValid INTEGER,
        witness TEXT,
        mintURL TEXT,
        FOREIGN KEY(mintURL) REFERENCES ${MINTS_TABLE_NAME}(mintURL) ON DELETE CASCADE
      );`);

    // Transactions Table
    await sqlLiteDB.runAsync(`CREATE TABLE IF NOT EXISTS ${TRANSACTIONS_TABLE_NAME} (
        id TEXT PRIMARY KEY,
        time INTEGER,
        amount INTEGER,
        type TEXT,
        paymentType TEXT,
        fee INTEGER,
        preImage TEXT,
        mintURL TEXT,
        description TEXT,
        invoice TEXT,
        FOREIGN KEY(mintURL) REFERENCES ${MINTS_TABLE_NAME}(mintURL) ON DELETE CASCADE
      );`);
    await sqlLiteDB.execAsync('COMMIT;');

    const result = await sqlLiteDB.getFirstAsync(`
            SELECT COUNT(*) AS count FROM pragma_table_info('${TRANSACTIONS_TABLE_NAME}') 
            WHERE name='invoice';
          `);

    if (result.count === 0) {
      await sqlLiteDB.execAsync(`
              ALTER TABLE ${TRANSACTIONS_TABLE_NAME} 
              ADD COLUMN invoice TEXT;
            `);
    }

    console.log('opened or created ecash tables');
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};

export const deleteEcashDBTables = async () => {
  try {
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');

    await sqlLiteDB.runAsync(
      `DROP TABLE IF EXISTS ${TRANSACTIONS_TABLE_NAME};`,
    );
    await sqlLiteDB.runAsync(`DROP TABLE IF EXISTS ${PROOF_TABLE_NAME};`);
    await sqlLiteDB.runAsync(`DROP TABLE IF EXISTS ${MINTS_TABLE_NAME};`);

    await sqlLiteDB.execAsync('COMMIT;');

    console.log('Deleted all ecash tables');
    return true;
  } catch (err) {
    console.log('Error deleting tables:', err);
    await sqlLiteDB.execAsync('ROLLBACK;');
    return false;
  }
};

export const storeProofs = async (proofs, mintURL) => {
  try {
    const chosingMint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const currentMint = await chosingMint;
    if (!currentMint) throw new Error('No selected mint to save to');
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');
    for (const proof of proofs) {
      await sqlLiteDB.runAsync(
        `INSERT OR IGNORE INTO ${PROOF_TABLE_NAME} 
        (id, amount, secret, C, dleq, dleqValid, witness, mintURL) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          proof.id,
          proof.amount,
          proof.secret,
          proof.C,
          typeof proof.dleq === 'string'
            ? proof.dleq
            : JSON.stringify(proof.dleq), // Store dleq as a JSON string
          proof.dleqValid ? 1 : 0, // Store dleqValid as 1 (true) or 0 (false)
          proof.witness || null, // Store witness if it exists, otherwise null,
          currentMint, //be able to link proofs to correct mint
        ],
      );
    }
    await sqlLiteDB.execAsync('COMMIT;');
    sqlEventEmitter.emit(PROOF_EVENT_UPDATE_NAME, 'storeProofs');
    console.log('Bulk proofs processed successfully');
    return true;
  } catch (err) {
    console.log('unable to store proofs', err);
    // Rollback the transaction in case of an error
    await sqlLiteDB.execAsync('ROLLBACK;');
    console.error(err, 'proofs storeage SQL error');
    return false;
  }
};

export const getStoredProofs = async mintURL => {
  try {
    const usedMint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const currentMint = await usedMint;
    if (!currentMint) throw new Error('No selected mint to save to');
    let proofs = [];
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${PROOF_TABLE_NAME} WHERE mintURL = ?;`,
      [currentMint],
    );

    for (const proof of result) {
      let formmattedProof = {
        ...proof,
      };
      formmattedProof['dlep'] = JSON.parse(proof.dleq);
      formmattedProof['dleqValid'] = proof.dleqValid === 1;
      formmattedProof['witness'] = proof.witness || undefined;
      proofs.push(formmattedProof);
    }
    console.log('Successfully got saved proofs');
    return proofs;
  } catch (err) {
    console.log('getting stored ecash proofs error', err);
    return [];
  }
};

export const removeProofs = async proofsToRemove => {
  try {
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');
    if (proofsToRemove.length <= 500) {
      const secrets = proofsToRemove.map(p => p.secret);
      const placeholders = secrets.map(() => '?').join(',');

      if (secrets.length > 0) {
        await sqlLiteDB.runAsync(
          `DELETE FROM ${PROOF_TABLE_NAME} WHERE secret IN (${placeholders});`,
          secrets,
        );
      }
    } else {
      // For larger batches, process in chunks to avoid SQLite parameter limits
      const batchSize = 500;
      for (let i = 0; i < proofsToRemove.length; i += batchSize) {
        const batch = proofsToRemove.slice(i, i + batchSize);
        const secrets = batch.map(p => p.secret);
        const placeholders = secrets.map(() => '?').join(',');

        await sqlLiteDB.runAsync(
          `DELETE FROM ${PROOF_TABLE_NAME} WHERE secret IN (${placeholders});`,
          secrets,
        );
      }
    }
    sqlEventEmitter.emit(PROOF_EVENT_UPDATE_NAME, 'removeProofs');
    await sqlLiteDB.execAsync('COMMIT;');
    console.log('Bulk remove proofs processed successfully');
    return true;
  } catch (err) {
    console.log('removing proofs error', err);
    await sqlLiteDB.execAsync('ROLLBACK;');
    return false;
  }
};

export const storeEcashTransactions = async (transactions, mintURL) => {
  try {
    const chosingMint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const currentMint = await chosingMint;
    if (!currentMint) throw new Error('No selected mint to save to');
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');
    for (const transaction of transactions) {
      console.log(
        transaction.id,
        transaction.time,
        transaction.amount,
        transaction.paymentType,
        transaction.fee,
        transaction.preImage,
        transaction.description,
        transaction.invoice,
        currentMint,
        'store transaction informatino',
      );
      await sqlLiteDB.runAsync(
        `INSERT OR REPLACE INTO ${TRANSACTIONS_TABLE_NAME} 
        (id, time, amount, type, paymentType, fee, preImage, mintURL, description, invoice) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          transaction.id,
          transaction.time,
          transaction.amount,
          transaction.type,
          transaction.paymentType,
          transaction.fee,
          transaction.preImage,
          currentMint,
          transaction.description,
          transaction.invoice,
        ],
      );
    }
    await sqlLiteDB.execAsync('COMMIT;');
    sqlEventEmitter.emit(TRANSACTIONS_EVENT_UPDATE_NAME, 'storeTransactions');
    console.log('Bulk adding transactions processed successfully');
    return true;
  } catch (err) {
    console.log('adding transactions error', err);
    return false;
  }
};

export const getStoredEcashTransactions = async () => {
  try {
    const currentMint = await getSelectedMint();
    if (!currentMint) throw new Error('No selected mint to save to');

    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${TRANSACTIONS_TABLE_NAME} WHERE mintURL = ? ORDER BY time DESC;`,
      [currentMint],
    );

    console.log('Successfully got saved transactions');
    return result || [];
  } catch (err) {
    console.log('Error getting saved transactions:', err);
    return [];
  }
};

export const addMint = async mintURL => {
  try {
    await sqlLiteDB.runAsync(
      `INSERT OR IGNORE INTO ${MINTS_TABLE_NAME} (mintURL, counter, isSelected) 
         VALUES (?, 0, 0);`,
      [mintURL],
    );
    console.log(`Mint ${mintURL} added`);
    sqlEventEmitter.emit(MINT_EVENT_UPDATE_NAME, 'addMint');
    return true;
  } catch (err) {
    console.log('Error adding mint:', err);
    return false;
  }
};

export const getAllMints = async () => {
  try {
    const result = await sqlLiteDB.getAllAsync(
      `SELECT * FROM ${MINTS_TABLE_NAME};`,
    );
    console.log('Got all mints:', result);

    return result; // Return the array of mints
  } catch (err) {
    console.log('Error getting all mints:', err);
    return [];
  }
};

export const selectMint = async mintURL => {
  try {
    await sqlLiteDB.execAsync('BEGIN TRANSACTION;');

    await sqlLiteDB.runAsync(`UPDATE ${MINTS_TABLE_NAME} SET isSelected = 0;`);

    await sqlLiteDB.runAsync(
      `UPDATE ${MINTS_TABLE_NAME} SET isSelected = 1 WHERE mintURL = ?;`,
      [mintURL.trim()],
    );

    await sqlLiteDB.execAsync('COMMIT;');
    sqlEventEmitter.emit(MINT_EVENT_UPDATE_NAME, 'selectMint');
    console.log(`Mint ${mintURL} selected`);
    return true;
  } catch (err) {
    console.log('Error selecting mint:', err);
    await sqlLiteDB.execAsync('ROLLBACK;');
    return false;
  }
};
export const deleteMint = async mintURL => {
  try {
    await sqlLiteDB.runAsync(
      `DELETE FROM ${MINTS_TABLE_NAME} WHERE mintURL = ?;`,
      [mintURL],
    );

    console.log(
      `Mint ${mintURL} and all associated proofs and transactions deleted`,
    );
    sqlEventEmitter.emit(MINT_EVENT_UPDATE_NAME, 'deleteMint');
    return true;
  } catch (err) {
    console.log('Error deleting mint:', err);
    return false;
  }
};

export const getSelectedMint = async () => {
  try {
    const result = await sqlLiteDB.getFirstAsync(
      `SELECT mintURL FROM ${MINTS_TABLE_NAME} WHERE isSelected = 1;`,
    );
    return result ? result.mintURL : null;
  } catch (err) {
    console.log('Error fetching selected mint:', err);
    return null;
  }
};
export const getSelectedMintData = async () => {
  try {
    const result = await sqlLiteDB.getFirstAsync(
      `SELECT * FROM ${MINTS_TABLE_NAME} WHERE isSelected = 1;`,
    );
    return result ? result : null;
  } catch (err) {
    console.log('Error fetching selected mint:', err);
    return null;
  }
};

export const incrementMintCounter = async (mintURL, count) => {
  try {
    await sqlLiteDB.runAsync(
      `UPDATE ${MINTS_TABLE_NAME} 
         SET counter = counter + ? 
         WHERE mintURL = ?;`,
      [count || 1, mintURL],
    );

    const result = await sqlLiteDB.getFirstAsync(
      `SELECT counter FROM ${MINTS_TABLE_NAME} WHERE mintURL = ?;`,
      [mintURL],
    );

    const newCounter = result ? result.counter : null;
    console.log(`Counter for mint ${mintURL} incremented to ${newCounter}`);
    return newCounter;
  } catch (err) {
    console.log('Error incrementing counter:', err);
    return null;
  }
};

export const setMintCounter = async (mintURL, count) => {
  try {
    await sqlLiteDB.runAsync(
      `UPDATE ${MINTS_TABLE_NAME} 
           SET counter = ? 
           WHERE mintURL = ?;`,
      [count, mintURL],
    );
    console.log(`Set counter for mint ${mintURL} ${count}`);
    return true;
  } catch (err) {
    console.log('Error incrementing counter:', err);
    return false;
  }
};
