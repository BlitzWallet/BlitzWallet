import {StyleSheet, View} from 'react-native';
import {useCallback, useMemo, useState} from 'react';
import {useGlobalContextProvider} from '../../../context-store/context';
import PagerView from 'react-native-pager-view';
import {MyTabs} from '../../../navigation/tabs';
import AdminHome from './home';
import {ContactsDrawer} from '../../../navigation/drawers';
import AppStore from './appStore';
import SendPaymentHome from './sendBtcPage';
import GetThemeColors from '../../hooks/themeColors';

const CAMERA_PAGE = 0;
const HOME_PAGE = 1;

export default function AdminHomeIndex() {
  const {masterInfoObject} = useGlobalContextProvider();
  const [currentPage, setCurrentPage] = useState(HOME_PAGE);
  const {backgroundColor} = GetThemeColors();

  const handlePageChange = useCallback(e => {
    setCurrentPage(e.nativeEvent.position);
  }, []);

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
      onPageSelected={handlePageChange}>
      <SendPaymentHome
        from="home"
        pageViewPage={currentPage}
        key={CAMERA_PAGE}
      />
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
