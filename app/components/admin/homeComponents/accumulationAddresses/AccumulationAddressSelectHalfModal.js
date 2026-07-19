import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { CENTER, SIZES } from '../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';

export default function AccumulationAddressSelectHalfModal({
  addresses,
  selectedId,
  onSelect,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    setContentHeight(450);
  }, [setContentHeight]);

  const handleSelect = addr => {
    onSelect(addr);
    handleBackPressFunction();
  };

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('screens.accumulationAddresses.detail.selectAddress')}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {(addresses || []).map(addr => {
          const depositAddress = addr.depositAddress ?? '';
          const shortAddress = `${depositAddress.slice(
            0,
            8,
          )}…${depositAddress.slice(-6)}`;
          const isSelected = addr.accumulationAddressId === selectedId;
          return (
            <TouchableOpacity
              key={addr.accumulationAddressId}
              activeOpacity={0.7}
              style={styles.row}
              onPress={() => handleSelect(addr)}
            >
              <ThemeText styles={styles.addressText} content={shortAddress} />
              <View style={styles.rightSection}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => copyToClipboard(depositAddress, showToast)}
                  style={styles.copyButton}
                >
                  <ThemeIcon iconName="Copy" size={18} />
                </TouchableOpacity>
                {isSelected && <ThemeIcon iconName="Check" size={18} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 20,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 55,
  },
  addressText: {
    includeFontPadding: false,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copyButton: {
    padding: 4,
  },
});
