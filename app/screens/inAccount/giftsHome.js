import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ThemeText } from '../../functions/CustomElements';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, COLORS, ICONS, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import ProfileImageSettingsNavigator from '../../functions/CustomElements/profileSettingsNavigator';
import { useTranslation } from 'react-i18next';
import { WINDOWWIDTH } from '../../constants/theme';

import GiftsOverview from '../../components/admin/homeComponents/gifts/giftsOverview';
import ClaimGiftHome from '../../components/admin/homeComponents/gifts/claimGiftHome';
import ReclaimGift from '../../components/admin/homeComponents/gifts/reclaimGift';

export default function GiftsPageHome({ navigation }) {
  const tabsNavigate = navigation.navigate;
  const [currentView, setCurrentView] = useState('overview');
  const [activeTab, setActiveTab] = useState('my-gifts');
  const { topPadding } = useGlobalInsets();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  const handleTabChange = value => {
    setActiveTab(value);
    if (value === 'my-gifts') setCurrentView('overview');
    if (value === 'claim') setCurrentView('claim');
    if (value === 'reclaim') setCurrentView('reclaim');
  };

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.topBarContainer, { paddingTop: topPadding }]}>
        <View style={styles.topBar}>
          <ThemeText
            CustomNumberOfLines={1}
            content={t('screens.inAccount.giftPages.giftsHome.title')}
            styles={styles.headerText}
          />
          <View style={{ marginLeft: 'auto' }}>
            <ProfileImageSettingsNavigator />
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabContainer,
          {
            borderBottomColor: backgroundOffset,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'my-gifts' && {
              ...styles.activeTab,
              borderBottomColor: textColor,
            },
          ]}
          onPress={() => handleTabChange('my-gifts')}
        >
          <ThemeText
            styles={[
              styles.tabText,
              activeTab === 'my-gifts' && styles.activeTabText,
            ]}
            content={t('constants.manage')}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'claim' && {
              ...styles.activeTab,
              borderBottomColor: textColor,
            },
          ]}
          onPress={() => handleTabChange('claim')}
        >
          <ThemeText
            styles={[
              styles.tabText,
              activeTab === 'claim' && styles.activeTabText,
            ]}
            content={t('constants.claim')}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'reclaim' && {
              ...styles.activeTab,
              borderBottomColor: textColor,
            },
          ]}
          onPress={() => handleTabChange('reclaim')}
        >
          <ThemeText
            styles={[
              styles.tabText,
              activeTab === 'reclaim' && styles.activeTabText,
            ]}
            content={t('constants.reclaim')}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {currentView === 'overview' && (
        <GiftsOverview theme={theme} darkModeType={darkModeType} />
      )}
      {currentView === 'claim' && (
        <ClaimGiftHome theme={theme} darkModeType={darkModeType} />
      )}
      {currentView === 'reclaim' && (
        <ReclaimGift theme={theme} darkModeType={darkModeType} t />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarContainer: {
    width: '100%',
  },
  topBar: {
    width: WINDOWWIDTH,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // minHeight: 40,
    marginBottom: 10,
    ...CENTER,
  },
  headerText: {
    flexShrink: 1,
    width: '100%',
    textAlign: 'center',
    fontSize: SIZES.large,
    paddingHorizontal: 45,
    position: 'absolute',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    width: '100%',
    flexShrink: 1,
    fontSize: SIZES.large,
    textAlign: 'center',
    backgroundColor: 'red',
    position: 'absolute',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 5,

    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: SIZES.small,
    textAlign: 'center',
    padding: 5,
  },
  activeTabText: {
    fontWeight: '500',
  },
});
