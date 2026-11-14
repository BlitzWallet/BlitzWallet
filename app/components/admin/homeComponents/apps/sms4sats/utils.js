import {
  isPossibleNumber,
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';
import { randomBytes } from 'react-native-quick-crypto';
import { sendCountryCodes } from './sendCountryCodes';

export const SMS_SEND_MAX_LENGTH = 140;

// https://docs.sms4sats.com — send keeps the legacy paths, receive is v2.
export const SMS4SATS_API = 'https://api.sms4sats.com';
export const RECEIVE_ORDERS_ENDPOINT = `${SMS4SATS_API}/v2/receive-sms/orders`;
export const RECEIVE_TERMINAL_STATES = [
  'completed',
  'cancelled',
  'expired',
  'failed',
];

// v2 expects the legacy Auto Select id (999) as "auto" and ids as strings.
export const toSms4SatsCountryId = value =>
  value === 999 || value == null ? 'auto' : String(value);

// Idempotency-Key for order creation must be a UUID v4.
export const createIdempotencyKey = () => {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// v2 errors are { error, message }; legacy send errors are { reason }.
export const fetchSms4Sats = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.reason || `HTTP ${response.status}`);
  }
  return data;
};

export const fetchReceiveOrder = (orderId, accessToken) =>
  fetchSms4Sats(`${RECEIVE_ORDERS_ENDPOINT}/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

export const DEFAULT_SMS_COUNTRY =
  sendCountryCodes.find(item => item.country === 'United States') ||
  sendCountryCodes[0];

export const sanitizeSmsPhoneInput = value =>
  `${value || ''}`.replace(/\D/g, '');

export const formatSmsPhoneNumber = number => {
  if (!number) return '';

  try {
    const normalizedNumber = number.startsWith('+') ? number : `+${number}`;
    return parsePhoneNumberWithError(normalizedNumber).formatInternational();
  } catch (error) {
    return number;
  }
};

export const fetchSms4SatsCountries = async () => {
  const response = await fetch(`${SMS4SATS_API}/getCountries`);
  if (!response.ok) throw new Error('Failed to fetch sms4sats countries');
  const countries = await response.json();
  return new Set(countries.map(c => c.id));
};

export const validateAndNormalizeSmsPhoneNumber = ({
  phoneNumber,
  isoCode,
  cc,
}) => {
  const isPossible = isPossibleNumber(phoneNumber, isoCode) === true;
  const isVaild = isValidPhoneNumber(phoneNumber, isoCode) === true;

  if (!isPossible || !isVaild) {
    throw new Error('invalid-phone-number');
  }

  const parsed = parsePhoneNumberWithError(phoneNumber, isoCode);
  const e164 = parsed.number;

  return {
    sanitizedPhoneNumber: e164,
    normalizedPhoneNumber: e164,
    selectedCountry: sendCountryCodes.find(c => c.isoCode === isoCode) || {
      isoCode,
      cc,
    },
  };
};

export const buildSmsMessageUniqueKey = (messageItem, index) => {
  return (
    messageItem?.orderId ||
    `${messageItem?.phone || messageItem?.number || 'sms'}-${
      messageItem?.timestamp || messageItem?.createdAt || index
    }-${index}`
  );
};

export const dedupeSmsMessages = (messageList = []) => {
  const seenKeys = new Set();

  return messageList.filter((messageItem, index) => {
    const uniqueKey = buildSmsMessageUniqueKey(messageItem, index);

    if (seenKeys.has(uniqueKey)) return false;

    seenKeys.add(uniqueKey);
    return true;
  });
};
