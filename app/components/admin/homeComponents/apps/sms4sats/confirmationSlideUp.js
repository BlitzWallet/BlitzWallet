import { useTranslation } from 'react-i18next';
import { decode } from '../../../../../functions/decodeBolt11';
import { fetchSms4Sats, formatSmsPhoneNumber, SMS4SATS_API } from './utils';
import SMSConfirmSheet from './smsConfirmSheet';

export default function ConfirmSMSPayment({
  message,
  normalizedPhoneNumber,
  sendTextMessage,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();

  const createOrder = async () => {
    const data = await fetchSms4Sats(`${SMS4SATS_API}/createsendorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        phone: normalizedPhoneNumber,
        ref: process.env.GPT_PAYOUT_LNURL,
      }),
    });
    if (!data.payreq || !data.orderId) throw new Error(data.reason);
    return {
      payreq: data.payreq,
      orderId: data.orderId,
      amountSat: decode(data.payreq).satoshis,
    };
  };

  return (
    <SMSConfirmSheet
      label={t('apps.sms4sats.confirmationSlideUp.title')}
      headline={formatSmsPhoneNumber(normalizedPhoneNumber)}
      planType="SMS"
      sheetHeight={400}
      createOrder={createOrder}
      onConfirm={sendTextMessage}
      setContentHeight={setContentHeight}
      handleBackPressFunction={handleBackPressFunction}
    />
  );
}
