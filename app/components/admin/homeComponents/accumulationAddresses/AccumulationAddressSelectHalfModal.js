import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { CENTER, SIZES } from '../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';

export default function AccumulationAddressSelectHalfModal({
  addresses,
  selectedId,
  onSelect,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

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
              disabled={isSelected}
              key={addr.accumulationAddressId}
              activeOpacity={0.7}
              style={[
                styles.row,
                {
                  backgroundColor: isSelected
                    ? theme && darkModeType
                      ? backgroundColor
                      : backgroundOffset
                    : 'transparent',
                  borderWidth: isSelected ? 1 : 0,
                  borderColor:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                },
              ]}
              onPress={() => handleSelect(addr)}
            >
              <ThemeText styles={styles.addressText} content={shortAddress} />
              {!isSelected && <ThemeIcon size={20} iconName={'ChevronRight'} />}
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
    fontWeight: 500,
    marginBottom: 10,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
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
