import {StyleSheet, View} from 'react-native';
import {useCallback, useState} from 'react';
import {useGlobalContextProvider} from '../../../context-store/context';
import PagerView from 'react-native-pager-view';
import {MyTabs} from '../../../navigation/tabs';
import AdminHome from './home';
import {ContactsDrawer} from '../../../navigation/drawers';
import AppStore from './appStore';
import SendPaymentHome from './sendBtcPage';
import GetThemeColors from '../../hooks/themeColors';
import {crashlyticsLogReport} from '../../functions/crashlyticsLogs';

const CAMERA_PAGE = 0;
const HOME_PAGE = 1;

export default function AdminHomeIndex() {
  const {masterInfoObject} = useGlobalContextProvider();
  const [currentPage, setCurrentPage] = useState(HOME_PAGE);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const {backgroundColor} = GetThemeColors();

  const handlePageChange = useCallback(e => {
    console.log(e.nativeEvent, 'PAGE CHANGE');
    crashlyticsLogReport('Handling page change with pagerView');
    const newPage = e.nativeEvent.position;
    setCurrentPage(newPage);

    if (newPage === CAMERA_PAGE) {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
    }
  }, []);

  const handlePageScroll = e => {
    const state = e.nativeEvent.pageScrollState;
    console.log(
      currentPage,
      'CURRENT PAGE IN SCROLL',
      state,
      state === 'dragging' && currentPage === HOME_PAGE,
      state === 'idle' && currentPage === HOME_PAGE,
    );
    if (state === 'dragging' && currentPage === HOME_PAGE) {
      setIsCameraActive(true);
    }
  };

  const MainContent = useCallback(
    () => (
      <MyTabs
        adminHome={AdminHome}
        contactsDrawer={ContactsDrawer}
        appStore={AppStore}
      />
    ),
    [],
  );

  if (!masterInfoObject.enabledSlidingCamera) {
    return (
      <View style={{...styles.container, backgroundColor}}>
        <MainContent />
      </View>
    );
  }

  return (
    <PagerView
      style={{...styles.container, backgroundColor}}
      initialPage={HOME_PAGE}
      onPageSelected={handlePageChange}
      onPageScrollStateChanged={handlePageScroll}>
      <View style={{flex: 1}} key={CAMERA_PAGE}>
        {isCameraActive && (
          <SendPaymentHome from="home" pageViewPage={currentPage} />
        )}
      </View>
      <View key={HOME_PAGE} style={styles.container}>
        <MainContent />
      </View>
    </PagerView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
