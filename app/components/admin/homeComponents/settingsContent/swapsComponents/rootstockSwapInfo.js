import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useRootstockProvider } from '../../../../../../context-store/rootstockSwapContext';
import { refundRootstockSubmarineSwap } from '../../../../../functions/boltz/rootstock/claims';
import { useToast } from '../../../../../../context-store/toastManager';
import { copyToClipboard, formatBalanceAmount } from '../../../../../functions';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function SubmarineSwapDisplay(props) {
  const swapData = props.route.params.swap;
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, transparentOveraly } =
    GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { signer } = useRootstockProvider();
  const [isRefunding, setIsRefunding] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { bottomPadding, topPadding } = useGlobalInsets();

  const formatAddress = address => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const CopyableValue = ({ value, displayValue, style }) => (
    <TouchableOpacity
      onPress={() => copyToClipboard(value, showToast)}
      style={styles.copyableContainer}
    >
      <ThemeText
        styles={{ ...styles.value, ...style }}
        content={displayValue || value}
      />
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          backgroundColor: transparentOveraly,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
        ]}
      >
        <TouchableOpacity onPress={navigate.goBack} style={styles.closePopup}>
          <ThemeIcon iconName={'X'} />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemeText
            content={t('settings.rootstockSwapInfo.title')}
            styles={styles.title}
          />
          <View style={styles.section}>
            <ThemeText
              styles={styles.label}
              content={t('settings.rootstockSwapInfo.id')}
            />
            <CopyableValue value={swapData.id} />
          </View>
          <View
            style={[styles.divider, { backgroundColor: backgroundColor }]}
          />
          <ThemeText
            content={t('settings.rootstockSwapInfo.swapDetails')}
            styles={styles.sectionTitle}
          />
          <View style={styles.section}>
            <ThemeText
              styles={styles.label}
              content={t('settings.rootstockSwapInfo.claimAddress')}
            />
            <CopyableValue
              value={swapData.data.swap.claimAddress}
              displayValue={formatAddress(swapData.data.swap.claimAddress)}
            />
          </View>
          <View style={styles.section}>
            <ThemeText
              styles={styles.label}
              content={t('settings.rootstockSwapInfo.timeoutBHeight')}
            />
            <CopyableValue
              value={swapData.data.swap.timeoutBlockHeight.toString()}
              displayValue={swapData.data.swap.timeoutBlockHeight.toLocaleString()}
            />
          </View>

          <View style={styles.section}>
            <ThemeText
              styles={styles.label}
              content={t('settings.rootstockSwapInfo.expAmount')}
            />
            <CopyableValue
              value={swapData.data.swap.expectedAmount}
              displayValue={formatBalanceAmount(
                swapData.data.swap.expectedAmount,
                true,
                masterInfoObject,
              )}
            />
          </View>
          <View
            style={[styles.divider, { backgroundColor: backgroundColor }]}
          />

          <ThemeText
            content={t('settings.rootstockSwapInfo.invoice')}
            styles={styles.sectionTitle}
          />
          <View
            style={[
              styles.invoiceContainer,
              { backgroundColor: theme ? backgroundColor : backgroundOffset },
            ]}
          >
            <TouchableOpacity
              onPress={() => copyToClipboard(swapData.data.invoice, showToast)}
              style={styles.copyableContainer}
            >
              <ThemeText
                styles={styles.invoice}
                content={swapData.data.invoice}
                CustomNumberOfLines={2}
                ellipsizeMode="tail"
              />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {swapData.data.didSwapFail && (
          <CustomButton
            actionFunction={async () => {
              setIsRefunding(true);
              const response = await refundRootstockSubmarineSwap(
                swapData,
                signer,
              );
              await new Promise(res => setTimeout(res, 3000));
              if (response) navigate.goBack();
              setIsRefunding(false);
            }}
            buttonStyles={{
              backgroundColor: theme ? backgroundColor : backgroundOffset,
              marginTop: 5,
            }}
            textStyles={{
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}
            textContent={t('settings.rootstockSwapInfo.refundSwap')}
            useLoading={isRefunding}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePopup: {
    alignSelf: 'flex-end',
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    width: INSET_WINDOW_WIDTH,
    maxHeight: '100%',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: SIZES.large,
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: 16,
    marginTop: 8,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  value: {},
  valueSmall: {
    fontSize: SIZES.small,
  },
  copyableContainer: {
    padding: 4,
    borderRadius: 4,
  },
  invoiceContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  invoice: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
});
