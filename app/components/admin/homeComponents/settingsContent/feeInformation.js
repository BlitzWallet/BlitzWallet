import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useMemo, useState } from 'react';
import { CENTER, COLORS, ICONS, SIZES } from '../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTranslation } from 'react-i18next';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { formatBalanceAmount } from '../../../../functions';
import openWebBrowser from '../../../../functions/openWebBrowser';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function BlitzFeeInformation() {
  const { showTokensInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset } = GetThemeColors();
  const [paymentType, setPaymentType] = useState('lightning');
  const { t } = useTranslation();

  const feeOptions = showTokensInformation
    ? ['lightning', 'spark', 'bitcoin', 'tokens']
    : ['lightning', 'spark', 'bitcoin'];

  const timeFrameElements = useMemo(() => {
    return feeOptions.map(item => {
      return (
        <TouchableOpacity
          key={item}
          onPress={() => setPaymentType(item)}
          style={{
            backgroundColor:
              item === paymentType
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
            borderColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            ...styles.timeFrameElement,
          }}
        >
          <ThemeText
            styles={{
              color:
                item === paymentType
                  ? theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : textColor,
              ...styles.timeFrameElementText,
            }}
            content={item}
          />
        </TouchableOpacity>
      );
    });
  }, [paymentType, textColor, theme, darkModeType, feeOptions]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 20,
        alignItems: 'center',
        width: INSET_WINDOW_WIDTH,
        ...CENTER,
      }}
    >
      <ThemeText
        styles={{ textAlign: 'center', marginBottom: 30 }}
        content={t('settings.feeInformation.description')}
      />
      <FeeTable masterInfoObject={masterInfoObject} />

      <TouchableOpacity
        onPress={() =>
          openWebBrowser({
            link: 'https://docs.spark.money/wallets/estimate-fees',
          })
        }
        activeOpacity={0.75}
        style={[
          styles.sparkPill,
          {
            backgroundColor: backgroundOffset,
          },
        ]}
      >
        <View style={styles.pillContentContainer}>
          {/* Spark icon pill */}
          <View
            style={[
              styles.pillIconContianer,
              {
                backgroundColor:
                  theme && darkModeType ? COLORS.background : COLORS.primary,
              },
            ]}
          >
            <ThemeImage
              styles={{ height: 20, width: 20 }}
              lightModeIcon={ICONS.receiptWhite}
              darkModeIcon={ICONS.receiptWhite}
              lightsOutIcon={ICONS.receiptWhite}
            />
          </View>
          <View style={{ flexShrink: 1 }}>
            <ThemeText
              styles={{
                fontSize: SIZES.small,
                includeFontPadding: false,
              }}
              content={t('settings.feeInformation.othersFee')}
            />
            <ThemeText
              styles={{
                fontSize: SIZES.xSmall,
                opacity: 0.55,
                includeFontPadding: false,
              }}
              content={t('settings.feeInformation.networkFeeLinkDesc')}
            />
          </View>
        </View>
        <ThemeIcon iconName={'ChevronRight'} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function FeeTable({ masterInfoObject }) {
  const { poolInfoRef } = useFlashnet();
  const { backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();

  const feeData = [
    // {
    //   transactionType: t('settings.feeInformation.swapsType'),
    //   fee: t('settings.feeInformation.swapsFee', {
    //     poolFee: formatBalanceAmount(
    //       poolInfoRef.lpFeeBps / 100,
    //       false,
    //       masterInfoObject,
    //     ),
    //     blitzFee: 1,
    //   }),
    // },
    {
      transactionType: t('settings.feeInformation.stablecoinType'),
      fee: t('settings.feeInformation.swapsFee', {
        poolFee: formatBalanceAmount(0.05, false, masterInfoObject),
        blitzFee: 0.5,
      }),
    },
    {
      transactionType: t('settings.feeInformation.othersType'),
      fee: t('settings.feeInformation.othersFee'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={[styles.headerRow, { backgroundColor: backgroundOffset }]}>
        <ThemeText
          styles={styles.headerCell}
          content={t('settings.feeInformation.transactionType')}
        />
        <ThemeText styles={styles.headerCell} content={t('constants.fee')} />
      </View>
      <View
        style={[styles.dataRowContainer, { borderColor: backgroundOffset }]}
      >
        {/* Data Rows */}
        {feeData.map((row, index) => (
          <View
            key={index}
            style={[
              styles.dataRow,
              { borderColor: backgroundOffset },
              index === feeData.length - 1 && styles.lastRow,
            ]}
          >
            <View style={styles.dataCell}>
              <ThemeText
                styles={styles.cellText}
                content={row.transactionType}
              />
            </View>
            <View style={styles.dataCell}>
              <ThemeText styles={styles.cellText} content={row.fee} />
              {row.subFee && (
                <ThemeText
                  styles={[styles.cellText, styles.subFeeText]}
                  content={`(formula: ${row.subFee})`}
                />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    width: '100%',
    paddingVertical: 5,
    borderRadius: 8,
  },

  container: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  headerCell: {
    flex: 1,
    fontSize: SIZES.small,
    textAlign: 'left',
    includeFontPadding: false,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    gap: 10,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  dataRowContainer: {
    borderWidth: 2,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
  },
  dataCell: {
    flex: 1,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: SIZES.small,
    textAlign: 'left',
  },
  subFeeText: {
    fontSize: SIZES.xSmall,
    opacity: 0.7,
    marginTop: 4,
  },
  sparkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 15,
  },
  pillContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 15,
  },
  pillIconContianer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
