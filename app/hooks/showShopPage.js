import { useMemo } from 'react';
import { useGlobalAppData } from '../../context-store/appData';
import { HIDE_IN_APP_PURCHASE_ITEMS } from '../constants';

export default function useShowShopPage() {
  const { decodedChatGPT, decodedVPNS } = useGlobalAppData();
  const hasActiveVPNs = useMemo(() => {
    const now = Date.now();
    decodedVPNS?.find(vpn => {
      const durationTimeConversion = {
        0.1: 1000 * 60 * 60,
        0.5: 1000 * 60 * 60 * 24,
        1.5: 1000 * 60 * 60 * 24 * 7,
        3: 1000 * 60 * 60 * 24 * 7 * 31,
        30: 1000 * 60 * 60 * 24 * 7 * 365,
      };
      const vpnStartDate = new Date(vpn.createdTime).getTime();
      return vpnStartDate + durationTimeConversion[vpn.duration] > now;
    });
  }, [decodedVPNS]);

  const hasGenerativeAICredits = decodedChatGPT?.credits;

  return hasGenerativeAICredits || hasActiveVPNs || !HIDE_IN_APP_PURCHASE_ITEMS;
}
