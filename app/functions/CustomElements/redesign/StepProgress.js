import { StyleSheet, View } from 'react-native';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import Spinner from './Spinner';

// D297 export progress: ring header, 20/26 title, 15/22 sub, 36 pt step rows.
// steps: [{ key, label, state: 'done' | 'active' | 'pending' | 'skipped' }]
export default function StepProgress({ title, subtitle, steps = [] }) {
  const { tokens } = useTheme();
  // A single step adds nothing beyond the header loader, so list only 2+.
  const visibleSteps = steps.filter(step => step.state !== 'skipped');
  return (
    <View style={styles.container}>
      <Spinner accessibilityLabel={title} />
      <ThemeText content={title} styles={styles.title} />
      {!!subtitle && (
        <ThemeText
          content={subtitle}
          styles={[styles.subtitle, { color: tokens.muted }]}
        />
      )}
      {visibleSteps.length > 1 && (
        <View style={styles.list}>
          {visibleSteps.map(step => (
            <View key={step.key} style={styles.step}>
              <View style={styles.marker}>
                {step.state === 'done' ? (
                  <View
                    style={[
                      styles.doneDisc,
                      { backgroundColor: tokens.accent },
                    ]}
                  >
                    <ThemeIcon
                      iconName="Check"
                      size={14}
                      strokeWidth={2.5}
                      colorOverride={tokens.onAccent}
                    />
                  </View>
                ) : step.state === 'active' ? (
                  <Spinner size={20} strokeWidth={5} />
                ) : (
                  <View
                    style={[
                      styles.pendingDot,
                      { backgroundColor: tokens.divider },
                    ]}
                  />
                )}
              </View>
              <ThemeText
                content={step.label}
                styles={[
                  styles.stepLabel,
                  step.state === 'pending' && { color: tokens.muted },
                ]}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 12 },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 18,
  },
  subtitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 6,
  },
  list: { alignSelf: 'stretch', marginTop: 24 },
  step: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 12 },
  marker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneDisc: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  stepLabel: {
    flex: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
});
