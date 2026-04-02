import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import AccumulationInfoCard from './AccumulationInfoCard';
import AccumulationAddressCard from './AccumulationAddressCard';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../functions/CustomElements/button';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';

export default function AccumulationAddressesHome() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { addresses } = useAccumulationAddresses();
  const { isConnectedToTheInternet } = useAppStatus();

  const handleCreate = useCallback(() => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'createAccumulationAddress',
      sliderHight: 0.6,
    });
  }, [isConnectedToTheInternet, navigate, t]);

  const renderAddressItem = useCallback(({ item }) => {
    return (
      <AccumulationAddressCard
        key={item.accumulationAddressId}
        address={item}
      />
    );
  }, []);

  const renderEmptyState = () => (
    <NoContentSceen
      iconName="ArrowDownToLine"
      titleText={t('screens.accumulationAddresses.empty.title')}
      subTitleText={t('screens.accumulationAddresses.empty.subtitle')}
    />
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('screens.accumulationAddresses.title')} />

      <View style={styles.innerContainer}>
        <FlatList
          data={addresses}
          renderItem={renderAddressItem}
          keyExtractor={item => item.accumulationAddressId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          ListHeaderComponent={
            <>
              <AccumulationInfoCard isExpanded={false} />
              {addresses.length > 0 && (
                <ThemeText
                  styles={styles.sectionHeader}
                  content={t('screens.accumulationAddresses.sectionTitle')}
                />
              )}
            </>
          }
        />

        <CustomButton
          buttonStyles={styles.createBtn}
          textContent={t('screens.accumulationAddresses.createButton')}
          actionFunction={handleCreate}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  sectionHeader: {
    fontSize: SIZES.large,
    marginTop: 20,
    marginBottom: 12,
  },
  createBtn: { width: '100%', marginTop: CONTENT_KEYBOARD_OFFSET },
});
