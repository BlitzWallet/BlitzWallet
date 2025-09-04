import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useMemo} from 'react';
import {COLORS} from '../../../../../../constants';
import {ThemeText} from '../../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../../context-store/theme';
import {useTranslation} from 'react-i18next';

export default function VPNDurationSlider({
  setSelectedDuration,
  selectedDuration,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const {t} = useTranslation();

  const durationOption = useMemo(() => {
    return [
      [
        t('apps.VPN.durationSlider.durationOption', {
          duration: t('constants.hour'),
        }),
        'hour',
      ],
      [
        t('apps.VPN.durationSlider.durationOption', {
          duration: t('constants.day'),
        }),
        'day',
      ],
      [
        t('apps.VPN.durationSlider.durationOption', {
          duration: t('constants.week'),
        }),
        'week',
      ],
      [
        t('apps.VPN.durationSlider.durationOption', {
          duration: t('constants.month'),
        }),
        'month',
      ],
      [
        t('apps.VPN.durationSlider.durationOption', {
          duration: t('constants.quarter'),
        }),
        'quarter',
      ],
    ].map(item => {
      const [name, itemSelector] = item;
      return (
        <TouchableOpacity
          onPress={() => setSelectedDuration(itemSelector)}
          style={{
            ...styles.durationButton,
            borderColor: theme ? COLORS.darkModeText : COLORS.primary,
            backgroundColor:
              selectedDuration === itemSelector
                ? theme
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
          }}
          key={name}>
          <ThemeText
            styles={{
              padding: 10,
              color:
                selectedDuration === itemSelector
                  ? theme
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : textColor,
              includeFontPadding: false,
            }}
            content={name}
          />
        </TouchableOpacity>
      );
    });
  }, [selectedDuration, theme]);

  return (
    <View style={styles.durationContainer}>
      <ThemeText
        styles={{...styles.infoHeaders}}
        content={t('apps.VPN.durationSlider.duration')}
      />
      <View style={styles.durationInnerContianer}>{durationOption}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  durationContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  durationInnerContianer: {
    columnGap: 10,
    rowGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  durationButton: {
    borderWidth: 2,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  infoHeaders: {
    width: '100%',
    marginBottom: 5,
  },
});
