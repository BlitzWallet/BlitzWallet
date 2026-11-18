import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createIdempotencyKey,
  fetchSms4Sats,
  RECEIVE_ORDERS_ENDPOINT,
} from './utils';
import SMSConfirmSheet from './smsConfirmSheet';

export default function ConfirmSMSReceiveCode({
  serviceCode,
  location,
  countryLabel,
  title,
  getReceiveCode,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  // One key per sheet so a retried request can't create a second order.
  const idempotencyKey = useRef(createIdempotencyKey()).current;

  const createOrder = async () => {
    const data = await fetchSms4Sats(RECEIVE_ORDERS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        country: location,
        service: serviceCode,
        referral: process.env.GPT_PAYOUT_LNURL,
      }),
    });
    if (!data.invoice || !data.orderId || !data.accessToken) {
      throw new Error(data.message);
    }
    return {
      payreq: data.invoice,
      orderId: data.orderId,
      accessToken: data.accessToken,
      amountSat: data.priceSats,
      serviceCode,
      title,
    };
  };

  return (
    <SMSConfirmSheet
      label={t('apps.sms4sats.confirmationSlideUp.receiveTitle')}
      headline={title}
      rows={[
        {
          label: t('apps.sms4sats.confirmationSlideUp.country'),
          value: countryLabel,
        },
      ]}
      note={t('apps.sms4sats.confirmationSlideUp.refundNote')}
      planType={t('apps.sms4sats.confirmationSlideUp.receivePlanType')}
      sheetHeight={500}
      createOrder={createOrder}
      onConfirm={getReceiveCode}
      setContentHeight={setContentHeight}
      handleBackPressFunction={handleBackPressFunction}
    />
  );
}
