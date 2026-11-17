import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import { CENTER } from '../../../../constants';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';
import { MOBILE_MONEY_COUNTRIES } from './mobileMoneyCountries';

// Route MobileMoneyCountryScreen: first step of the phone send flow.
export default function MobileMoneyCountryScreen() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const contentWidth = useContentWidth();
  const preSelectedPaymentMethod = useRoute().params?.preSelectedPaymentMethod;

  const handleSelectCountry = useCallback(
    country => {
      navigate.navigate('MobileMoneyPhoneScreen', {
        selectedCountry: country,
        preSelectedPaymentMethod,
      });
    },
    [navigate, preSelectedPaymentMethod],
  );

  return (
    <GlobalThemeView useStandardWidth={false}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.send')} />
        <PageHeader
          title={t('wallet.halfModal.mobileMoneyCountryTitle')}
          sub={t('wallet.halfModal.mobileMoneyCountrySubtitle')}
        />
        <ListCard style={styles.card}>
          <FlatList
            data={MOBILE_MONEY_COUNTRIES}
            keyExtractor={item => item.isoCode}
            renderItem={({ item }) => (
              <ListRow
                onPress={() => handleSelectCountry(item)}
                lead={
                  <View style={styles.flagContainer}>
                    <CountryFlag isoCode={item.isoCode} size={45} />
                  </View>
                }
                title={item.country}
                sub={item.provider}
                showChevron
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        </ListCard>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  card: { flexShrink: 1 },
  flagContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
