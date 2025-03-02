import {useNavigation} from '@react-navigation/native';
import {useLiquidEvent} from './liquidEventContext';
import {useEffect, useRef} from 'react';
import {useLightningEvent} from './lightningEventContext';
import {useAppStatus} from './appStatus';
import {useGlobaleCash} from './eCash';

export function LiquidNavigationListener() {
  const navigation = useNavigation();
  const {didGetToHomepage} = useAppStatus();
  const {pendingNavigation, setPendingNavigation} = useLiquidEvent();
  const isNavigating = useRef(false);

  useEffect(() => {
    console.log('RUNNING IN PENDING NAVIGATION LISTENER', pendingNavigation);
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    isNavigating.current = true;
    navigation.reset(pendingNavigation);
    requestAnimationFrame(() => {
      isNavigating.current = false;
      setPendingNavigation(null);
    });
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}

export function LightningNavigationListener() {
  const navigation = useNavigation();
  const {didGetToHomepage} = useAppStatus();
  const {pendingNavigation, setPendingNavigation} = useLightningEvent();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    isNavigating.current = true;
    navigation.reset(pendingNavigation);
    requestAnimationFrame(() => {
      isNavigating.current = false;
      setPendingNavigation(null);
    });
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}

export function EcashNavigationListener() {
  const navigation = useNavigation();
  const {didGetToHomepage} = useAppStatus();
  const {pendingNavigation, setPendingNavigation} = useGlobaleCash();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    isNavigating.current = true;
    navigation.reset(pendingNavigation);
    requestAnimationFrame(() => {
      isNavigating.current = false;
      setPendingNavigation(null);
    });
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}
