import { useEffect, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../../constants';
import { useTheme } from '../../../../../../../context-store/theme';
import { useActiveCustodyAccount } from '../../../../../../../context-store/activeAccount';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../../functions/CustomElements/redesign/PageHeader';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import { getRecommendedOnchainFees } from '../../../../../../functions/spark';

const PILL_GAP = 10;
// Mempool-recommended rates. 'medium' is preselected for non-technical users.
const SPEEDS = [
  { value: 'slow', feeKey: 'hourFee' },
  { value: 'medium', feeKey: 'halfHourFee' },
  { value: 'fast', feeKey: 'fastestFee' },
];

export default function UnilateralExitFee(props) {
  const { address } = props.route.params;
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [speed, setSpeed] = useState('medium');
  const [fees, setFees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRecommendedOnchainFees(currentWalletMnemoinc).then(res => {
      if (res.didWork) setFees(res.fees);
      else setError(res.error);
    });
  }, [currentWalletMnemoinc]);

  const selected = SPEEDS.find(s => s.value === speed);
  const feeRate = fees?.[selected.feeKey];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.container}>
          <TopBar title={t('settings.unilateralExit.title')} />
          <PageHeader
            title={t('settings.unilateralExit.feeTitle')}
            sub={t('settings.unilateralExit.feeSub')}
          />
          <View style={styles.pills}>
            {SPEEDS.map(option => {
              const isSelected = option.value === speed;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.7}
                  onPress={() => setSpeed(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.pill,
                    { width: (contentWidth - PILL_GAP * 2) / 3 },
                    {
                      backgroundColor: isSelected
                        ? tokens.accent
                        : tokens.surface,
                    },
                  ]}
                >
                  <ThemeText
                    content={t(`settings.unilateralExit.${option.value}Plain`)}
                    styles={[
                      styles.pillText,
                      { color: isSelected ? tokens.onAccent : tokens.ink },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <Note
            tone={error ? 'warn' : 'info'}
            text={
              error ||
              (fees
                ? t(`settings.unilateralExit.${speed}Note`, { rate: feeRate })
                : t('settings.unilateralExit.loadingFees'))
            }
          />
        </View>
        <CustomButton
          disabled={!feeRate}
          textContent={t('constants.review')}
          actionFunction={() =>
            navigate.navigate('UnilateralExitReview', { address, feeRate })
          }
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PILL_GAP,
    marginBottom: 24,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
});
