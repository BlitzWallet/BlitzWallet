import { BackHandler, StyleSheet, View } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useGlobalContextProvider } from '../../../context-store/context';
import PagerView from 'react-native-pager-view';
import Animated, { useHandler, useEvent } from 'react-native-reanimated';
import { MyTabs } from '../../../navigation/tabs';
import AppStore from './appStore';
import SendPaymentHome from './sendBtcPage';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { ContactsPage, HomeLightning } from '../../components/admin';
import GiftsPageHome from './giftsHome';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const CAMERA_PAGE = 0;
const HOME_PAGE = 1;

function usePagerScrollHandler(handlers, dependencies) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent(
    event => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer,
  );
}

export default function AdminHomeIndex() {
  const { masterInfoObject } = useGlobalContextProvider();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const pagerRef = useRef(null);
  const currentPageRef = useRef(HOME_PAGE);

  const handleBackPressFunction = useCallback(() => {
    if (currentPageRef.current !== HOME_PAGE) {
      console.log('RUNNING');
      requestAnimationFrame(() => pagerRef.current?.setPage(HOME_PAGE));
      return true;
    } else {
      return false;
    }
  }, []);

  useHandleBackPressNew(handleBackPressFunction);

  const handlePageChange = useCallback(e => {
    crashlyticsLogReport('Handling page change with pagerView');
    const newPage = e.nativeEvent.position;
    currentPageRef.current = newPage;

    if (newPage === CAMERA_PAGE) {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
    }
  }, []);

  const scrollHandler = usePagerScrollHandler({
    onPageScroll: e => {
      'worklet';
      // Trigger camera activation when starting to drag from HOME_PAGE
      if (e.position === HOME_PAGE && e.offset > 0) {
        setIsCameraActive(true);
      }
    },
  });

  const MainContent = useCallback(
    () => (
      <MyTabs
        adminHome={HomeLightning}
        ContactsPage={ContactsPage}
        appStore={AppStore}
        giftsPageHome={GiftsPageHome}
      />
    ),
    [],
  );

  if (!masterInfoObject.enabledSlidingCamera) {
    return (
      <View style={styles.container}>
        <MainContent />
      </View>
    );
  }

  return (
    <AnimatedPagerView
      ref={pagerRef}
      style={styles.container}
      initialPage={HOME_PAGE}
      onPageSelected={handlePageChange}
      onPageScroll={scrollHandler}
    >
      <View style={styles.container} key={CAMERA_PAGE}>
        {isCameraActive && (
          <SendPaymentHome from="home" pageViewPage={currentPageRef.current} />
        )}
      </View>
      <View key={HOME_PAGE} style={styles.container}>
        <MainContent />
      </View>
    </AnimatedPagerView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
