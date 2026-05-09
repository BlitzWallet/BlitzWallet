import {
  isPossibleNumber,
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';
import { sendCountryCodes } from './sendCountryCodes';

export const SMS_SEND_MAX_LENGTH = 140;

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
  const response = await fetch('https://api2.sms4sats.com/getCountries');
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

  return {
    sanitizedPhoneNumber: `${cc}${phoneNumber}`,
    normalizedPhoneNumber: `${cc}${phoneNumber}`,
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
