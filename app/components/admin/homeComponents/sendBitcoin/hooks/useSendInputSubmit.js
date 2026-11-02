import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { useImageCache } from '../../../../../../context-store/imageCache';
import { resolveExternalChainNavigation } from '../../../../../functions';
import handlePreSendPageParsing from '../../../../../functions/sendBitcoin/handlePreSendPageParsing';
import getReceiveAddressAndContactForContactsPayment from '../../contacts/internalComponents/getReceiveAddressAndKindForPayment';
import getClipboardText from '../../../../../functions/getClipboardText';

export default function useSendInputSubmit(preSelectedPaymentMethod) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { cache } = useImageCache();
  const { decodedAddedContacts, globalContactsInformation } =
    useGlobalContacts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputError, setInputError] = useState('');
  // The page stays mounted under the next screen, so the guard is released
  // when it regains focus instead of staying latched.
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }, []),
  );

  const clearError = useCallback(() => setInputError(''), []);

  const release = useCallback(() => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }, []);

  const submit = useCallback(
    async rawInput => {
      if (!rawInput?.trim()) return;
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      const input = rawInput.trim();
      const isContact = input.startsWith('@');

      const normalized = isContact
        ? input.slice(1).toLowerCase()
        : input.toLowerCase();
      if (!normalized) {
        release();
        return;
      }
      const matchedContact = isContact
        ? decodedAddedContacts.find(
            c => c.uniqueName?.toLowerCase() === normalized,
          )
        : undefined;

      if (matchedContact) {
        const senderName =
          globalContactsInformation.myProfile?.name ||
          globalContactsInformation.myProfile?.uniqueName;
        const payingContactMessage = {
          usingTranslation: true,
          type: 'paid',
          name: senderName,
        };

        const {
          receiveAddress,
          retrivedContact,
          formattedPayingContactMessage,
          didWork,
          error,
        } = await getReceiveAddressAndContactForContactsPayment({
          sendingAmountSat: 0,
          selectedContact: matchedContact,
          myProfileMessage: '',
          payingContactMessage,
        });

        if (!isMountedRef.current) return;
        if (!didWork) {
          setInputError(t(error));
          release();
          return;
        }

        const endReceiveType =
          retrivedContact?.lnurlReceiveCurrency?.toLowerCase() === 'usd'
            ? 'USD'
            : 'BTC';

        navigate.navigate('ConfirmPaymentScreen', {
          btcAdress: receiveAddress,
          fromPage: 'contacts',
          enteredPaymentInfo: {
            endReceiveType,
            fromContacts: true,
          },
          contactInfo: {
            imageData: cache[matchedContact.uuid],
            name: matchedContact.name || matchedContact.uniqueName,
            isLNURLPayment: matchedContact?.isLNURL,
            payingContactMessage: formattedPayingContactMessage,
            uniqueName: retrivedContact?.contacts?.myProfile?.uniqueName,
            uuid: matchedContact.uuid,
          },
          selectedContact: matchedContact,
          retrivedContact,
          preSelectedPaymentMethod,
        });
        return;
      }

      const parsed = handlePreSendPageParsing(input);
      if (parsed.error) {
        setInputError(parsed.error);
        release();
        return;
      }
      if (parsed.navigateToWebView) {
        navigate.navigate('CustomWebView', {
          headerText: '',
          webViewURL: parsed.webViewURL,
        });
        return;
      }
      if (parsed.isExternalChain) {
        const { method, screen, params } = resolveExternalChainNavigation(
          parsed,
          'home',
        );
        navigate[method](screen, params);
        return;
      }
      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: parsed.btcAdress,
        fromPage: '',
        preSelectedPaymentMethod,
      });
    },
    [
      navigate,
      decodedAddedContacts,
      globalContactsInformation,
      cache,
      t,
      preSelectedPaymentMethod,
    ],
  );

  const paste = useCallback(async () => {
    const { didWork, reason, data } = await getClipboardText();
    if (!didWork) {
      setInputError(t(reason));
      return;
    }
    submit(data.trim());
  }, [submit, t]);

  return { submit, paste, isSubmitting, inputError, clearError };
}
