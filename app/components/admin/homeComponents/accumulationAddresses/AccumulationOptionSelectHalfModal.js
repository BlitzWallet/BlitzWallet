import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { ThemeText } from '../../../../functions/CustomElements';
import { ACCUMULATION_CHAINS } from '../../../../constants/accumulationAddresses';
import { CENTER, ICONS, SIZES } from '../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';

export default function AccumulationOptionSelectHalfModal({
  options,
  onSelect,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();

  useEffect(() => {
    setContentHeight(450);
  }, [setContentHeight]);

  const handleSelect = option => {
    onSelect(option);
    handleBackPressFunction();
  };

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t(
          'screens.accumulationAddresses.detail.selectAnotherOption',
        )}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {(options || []).map(option => {
          const chainMeta = ACCUMULATION_CHAINS.find(
            c => c.id === option.sourceChain,
          );
          const chainLabel = chainMeta?.label ?? option.sourceChain ?? '';
          const subLabel = `${option.sourceAsset} → ${
            option.destinationAsset === 'BTC'
              ? t('constants.bitcoin_upper')
              : t('constants.dollars_upper')
          }`;

          return (
            <TouchableOpacity
              key={`${option.sourceChain}:${option.sourceAsset}:${option.destinationAsset}`}
              activeOpacity={0.7}
              style={styles.row}
              onPress={() => handleSelect(option)}
            >
              <Image
                style={styles.assetIcon}
                source={ICONS[`chain_${chainLabel.toLocaleLowerCase()}`]}
                contentFit="contain"
              />
              <View style={styles.middleSection}>
                <ThemeText styles={styles.label} content={chainLabel} />
                <ThemeText styles={styles.subLabel} content={subLabel} />
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
    minHeight: 45,
    borderRadius: 16,
    paddingVertical: 10,
  },
  assetIcon: {
    width: 45,
    height: 45,
    borderRadius: 30,
  },
  middleSection: {
    flex: 1,
    gap: 2,
    marginLeft: 8,
    marginRight: 5,
  },
  label: {
    fontWeight: 500,
    includeFontPadding: false,
  },
  subLabel: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
  },
});
