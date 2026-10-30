import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import GetThemeColors from '../../../../../hooks/themeColors';
import {
  CENTER,
  COLORS,
  ICONS,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../constants';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';

export default function SelectContactRequestCurrency({
  selectedRecieveOption,
  handleBackPressFunction,
  setContentHeight,
  fromPage,
  onSelectMethod,
}) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const selectSendingBalance = term => {
    const selected = term || selectedRecieveOption;
    if (onSelectMethod) {
      onSelectMethod(selected);
      handleBackPressFunction();
      return;
    }
    handleBackPressFunction(() =>
      navigate.popTo(
        fromPage || 'SendAndRequestPage',
        {
          selectedRequestMethod: selected,
        },
        { merge: true },
      ),
    );
  };

  return (
    <View style={[styles.innerContainer, { width: contentWidth }]}>
      <PageHeader
        title={t('contacts.selectCurrencyToRequest.header')}
        showSub={false}
      />
      <ListCard>
        <PickRow
          lead={
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? darkModeType
                        ? backgroundColor
                        : backgroundOffset
                      : COLORS.bitcoinOrange,
                },
              ]}
            >
              <ThemeImage
                styles={styles.icon}
                lightModeIcon={ICONS.bitcoinIcon}
                darkModeIcon={ICONS.bitcoinIcon}
                lightsOutIcon={ICONS.bitcoinIcon}
              />
            </View>
          }
          onPress={() => selectSendingBalance('BTC')}
          title={t('constants.bitcoin_upper')}
          sub={t('contacts.selectCurrencyToRequest.paidInSats')}
          selected={selectedRecieveOption === 'BTC'}
          minHeight={76}
        />
        <PickRow
          lead={
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? darkModeType
                        ? backgroundColor
                        : backgroundOffset
                      : COLORS.dollarGreen,
                },
              ]}
            >
              <ThemeImage
                styles={styles.icon}
                lightModeIcon={ICONS.dollarIcon}
                darkModeIcon={ICONS.dollarIcon}
                lightsOutIcon={ICONS.dollarIcon}
              />
            </View>
          }
          onPress={() => selectSendingBalance('USD')}
          title={t('constants.dollars_upper')}
          sub={t('contacts.selectCurrencyToRequest.paidInUsd')}
          selected={selectedRecieveOption === 'USD'}
          minHeight={76}
        />
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
  icon: { width: 24, height: 24 },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
