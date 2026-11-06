import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GlobalThemeView } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import GiftsOverview from '../../components/admin/homeComponents/gifts/giftsOverview';
import { useNavigation } from '@react-navigation/native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../functions/CustomElements/redesign/IconButton';

export default function GiftsPageHome() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.giftPages.giftsHome.title')}
          right={
            <IconButton
              icon={'RotateCcw'}
              onPress={() => navigate.navigate('ReclaimGift')}
            />
          }
        />
        <GiftsOverview />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
});
