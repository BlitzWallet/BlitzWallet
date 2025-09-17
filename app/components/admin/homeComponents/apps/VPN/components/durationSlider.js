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
  vpnInformation,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const {t} = useTranslation();
  const durations = vpnInformation.durations || [];

  const durationOption = useMemo(() => {
    return durations.map(item => {
      const {duration} = item;
      return (
        <TouchableOpacity
          onPress={() => setSelectedDuration(duration)}
          style={{
            ...styles.durationButton,
            borderColor: theme ? COLORS.darkModeText : COLORS.primary,
            backgroundColor:
              selectedDuration === duration
                ? theme
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
          }}
          key={duration}>
          <ThemeText
            styles={{
              padding: 10,
              color:
                selectedDuration === duration
                  ? theme
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : textColor,
              includeFontPadding: false,
            }}
            content={t('apps.VPN.durationSlider.durationOption', {
              duration: t(`apps.VPN.durationSlider.${duration}`),
            })}
          />
        </TouchableOpacity>
      );
    });
  }, [selectedDuration, theme, durations]);

  return (
    <View style={styles.durationContainer}>
      <ThemeText
        styles={{...styles.infoHeaders}}
        content={t('apps.VPN.durationSlider.duration')}
      />
      <View style={styles.durationInnerContianer}>
        {durationOption.length ? (
          durationOption
        ) : (
          <ThemeText content={t('apps.VPN.durationSlider.noDurations')} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  durationContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  durationInnerContianer: {
    gap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  durationButton: {
    borderWidth: 2,
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  infoHeaders: {
    width: '100%',
    marginBottom: 5,
  },
});
