import { bech32mDecode } from '@buildonspark/spark-sdk';

/**
 * Convert 5-bit words to 8-bit bytes (BIP173)
 */
function convertBits(data, fromBits, toBits, pad = true) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error('Invalid data');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || (acc << (toBits - bits)) & maxv) {
    throw new Error('Invalid padding');
  }

  return Buffer.from(ret);
}

/**
 * Simple protobuf decoder for Spark addresses
 * Based on the encoding structure from encodeSparkAddressWithSignature
 */
class ProtobufReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.pos = 0;
  }

  readVarint() {
    let result = 0;
    let shift = 0;
    while (this.pos < this.buffer.length) {
      const byte = this.buffer[this.pos++];
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  }

  readBytes(length) {
    const result = this.buffer.slice(this.pos, this.pos + length);
    this.pos += length;
    return result;
  }

  readLengthDelimited() {
    const length = this.readVarint();
    return this.readBytes(length);
  }

  hasMore() {
    return this.pos < this.buffer.length;
  }
}

/**
 * Decode SparkInvoiceFields from protobuf bytes
 */
function decodeSparkInvoiceFields(bytes) {
  const reader = new ProtobufReader(bytes);
  const fields = {};

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1: // version
        fields.version = reader.readVarint();
        break;

      case 2: // id (UUID bytes)
        fields.id = reader.readLengthDelimited();
        break;

      case 3: // payment_type (oneof field)
        const paymentBytes = reader.readLengthDelimited();
        fields.paymentType = decodePaymentType(paymentBytes);
        break;

      case 4: // memo
        const memoBytes = reader.readLengthDelimited();
        fields.memo = memoBytes.toString('utf8');
        break;

      case 5: // sender_public_key
        fields.senderPublicKey = reader.readLengthDelimited();
        break;

      case 6: // expiry_time (timestamp)
        const expiryBytes = reader.readLengthDelimited();
        fields.expiryTime = decodeTimestamp(expiryBytes);
        break;

      default:
        // Skip unknown fields
        if (wireType === 2) {
          reader.readLengthDelimited();
        } else {
          reader.readVarint();
        }
    }
  }

  // If no payment_type field exists, default to sats
  if (!fields.paymentType) {
    fields.paymentType = { type: 'sats', data: {} };
  }

  return fields;
}

/**
 * Decode payment type (sats or tokens)
 *
 * The structure is:
 * - If field 1 is 32 bytes: TokensPayment with token_identifier
 * - If field 1 is variable bytes (not 32): SatsPayment with amount
 * - Field 2 is TokensPayment.amount
 */
function decodePaymentType(bytes) {
  const reader = new ProtobufReader(bytes);
  const payment = {};
  let hasTokenIdentifier = false;

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1:
        const field1Data = reader.readLengthDelimited();
        // 32 bytes = token identifier, otherwise it's a sats amount
        if (field1Data.length === 32) {
          payment.type = 'tokens';
          payment.data = { tokenIdentifier: field1Data };
          hasTokenIdentifier = true;
        } else {
          payment.type = 'sats';
          payment.data = { amount: varBytesToBigInt(field1Data) };
        }
        break;

      case 2:
        // This is the amount field for tokens payment
        const amountBytes = reader.readLengthDelimited();
        if (hasTokenIdentifier) {
          payment.data.amount = varBytesToBigInt(amountBytes);
        }
        break;

      default:
        if (wireType === 2) {
          reader.readLengthDelimited();
        } else {
          reader.readVarint();
        }
    }
  }

  return payment;
}

/**
 * Decode protobuf timestamp
 */
function decodeTimestamp(bytes) {
  const reader = new ProtobufReader(bytes);
  let seconds = 0;

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;

    if (fieldNumber === 1) {
      // seconds
      seconds = reader.readVarint();
    } else {
      reader.readVarint();
    }
  }

  return new Date(seconds * 1000);
}

/**
 * Convert variable-length bytes to BigInt
 */
function varBytesToBigInt(bytes) {
  if (bytes.length === 0) return 0n;
  let result = 0n;
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/**
 * Parse Spark address from decoded bech32m response
 *
 * Structure (protobuf):
 * - Field 1: identity_public_key (bytes)
 * - Field 2: spark_invoice_fields (nested message)
 * - Field 3: signature (bytes)
 */
function parseSparkAddress(decodeResponse) {
  try {
    const { prefix, words } = decodeResponse;

    // Convert 5-bit words to 8-bit bytes
    const data = convertBits(words, 5, 8, false);
    const reader = new ProtobufReader(data);

    const result = {
      network: prefix,
      identityPublicKey: null,
      sparkInvoiceFields: null,
      signature: null,
    };

    // Parse protobuf fields
    while (reader.hasMore()) {
      const tag = reader.readVarint();
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;

      switch (fieldNumber) {
        case 1: // identity_public_key
          result.identityPublicKey = reader.readLengthDelimited();
          break;

        case 2: // spark_invoice_fields
          const invoiceBytes = reader.readLengthDelimited();
          result.sparkInvoiceFields = decodeSparkInvoiceFields(invoiceBytes);
          break;

        case 3: // signature
          result.signature = reader.readLengthDelimited();
          break;

        default:
          // Skip unknown fields
          if (wireType === 2) {
            reader.readLengthDelimited();
          } else {
            reader.readVarint();
          }
      }
    }

    // Format the result
    const payment = result.sparkInvoiceFields?.paymentType;

    let tokenIdentifierBech32m = null;
    console.log(payment);
    if (payment?.data?.tokenIdentifier) {
      tokenIdentifierBech32m = formatTokenIdentifier(
        payment.data.tokenIdentifier,
        result.network === 'spark' ? 'mainnet' : 'regtest',
      );
    }

    return {
      network: result.network,
      identityPublicKey: result.identityPublicKey?.toString('hex'),
      version: result.sparkInvoiceFields?.version,
      invoiceId: result.sparkInvoiceFields?.id?.toString('hex'),
      paymentType: payment?.type || 'sats',
      tokenIdentifier:
        payment?.type === 'tokens'
          ? payment.data.tokenIdentifier?.toString('hex')
          : null,
      tokenIdentifierBech32m,
      amount: payment?.data?.amount?.toString() || null,
      memo: result.sparkInvoiceFields?.memo || null,
      senderPublicKey:
        result.sparkInvoiceFields?.senderPublicKey?.toString('hex') || null,
      expiryTime: result.sparkInvoiceFields?.expiryTime || null,
      signature: result.signature?.toString('hex'),
    };
  } catch (err) {
    console.error('Error parsing Spark address:', err);
    throw new Error(`Failed to parse Spark address: ${err.message}`);
  }
}

/**
 * Convert token identifier hex to Bech32m format
 * @param {string} tokenIdentifierHex - 32-byte hex string
 * @param {string} network - 'mainnet' or 'regtest'
 * @returns {string} Bech32m encoded token identifier (btkn1... or btknrt1...)
 */
function encodeBech32mTokenIdentifier(tokenIdentifierHex, network = 'mainnet') {
  // Convert hex to bytes
  const tokenBytes = Buffer.from(tokenIdentifierHex, 'hex');

  if (tokenBytes.length !== 32) {
    throw new Error('Token identifier must be exactly 32 bytes');
  }

  // Convert bytes to 5-bit words for bech32m
  const words = convertBits(Array.from(tokenBytes), 8, 5, true);

  // Determine the HRP (human-readable part) based on network
  const hrp = network === 'regtest' ? 'btknrt' : 'btkn';

  // Encode using bech32m
  // If you have bech32mEncode from @buildonspark/spark-sdk, use that
  // Otherwise, use a bech32m library
  const encoded = bech32mEncode(hrp, words);

  return encoded;
}

/**
 * Simple bech32m encoder (if not available from SDK)
 * Based on BIP 350
 */
function bech32mEncode(hrp, data) {
  const BECH32M_CONST = 0x2bc830a3;
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  const values = [...data, ...createChecksum(hrp, data, BECH32M_CONST)];
  return hrp + '1' + values.map(v => CHARSET[v]).join('');
}

function createChecksum(hrp, data, const_value) {
  const values = [...hrpExpand(hrp), ...data];
  const polymod = polymodStep([...values, 0, 0, 0, 0, 0, 0]) ^ const_value;
  const checksum = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return checksum;
}

function hrpExpand(hrp) {
  const result = [];
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >> 5);
  }
  result.push(0);
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31);
  }
  return result;
}

function polymodStep(values) {
  const GENERATOR = [
    0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
  ];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GENERATOR[i];
      }
    }
  }
  return chk;
}

/**
 * Helper function to add to your parsed invoice result
 */
function formatTokenIdentifier(tokenIdentifierHex, network = 'mainnet') {
  if (!tokenIdentifierHex) return null;
  return encodeBech32mTokenIdentifier(tokenIdentifierHex, network);
}

/**
 * Main function to decode a Spark invoice
 */
export function decodeSparkInvoice(sparkAddress) {
  const decodeResponse = bech32mDecode(sparkAddress);
  const parsed = parseSparkAddress(decodeResponse);

  // Add formatted token identifier if it's a token invoice
  if (parsed.tokenIdentifier) {
    parsed.tokenIdentifierBech32m = formatTokenIdentifier(
      parsed.tokenIdentifier,
      parsed.network === 'spark' ? 'mainnet' : 'regtest',
    );
  }

  return parsed;
}
