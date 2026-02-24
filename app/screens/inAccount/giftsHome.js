import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GlobalThemeView } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import GiftsOverview from '../../components/admin/homeComponents/gifts/giftsOverview';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useNavigation } from '@react-navigation/native';

export default function GiftsPageHome() {
  const { t } = useTranslation();
  const navigate = useNavigation();

  return (
    <GlobalThemeView useStandardWidth={true} style={[styles.container]}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.giftPages.giftsHome.title')}
        iconNew="History"
        showLeftImage={true}
        leftImageFunction={() => navigate.navigate('ReclaimGift')}
      />

      <GiftsOverview />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
