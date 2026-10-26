import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../functions/CustomElements/button';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import { COLORS, FONT, ICONS } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';

// Shared pieces of the Add money and Withdraw sheets (SavingsMove.dc.html,
// SavingsSheets.dc.html).

export function SheetTitle({ title, sub, first = false }) {
  const { tokens } = useTheme();
  return (
    <View style={first ? styles.titleFirst : styles.titleAfterBack}>
      <ThemeText styles={styles.title} content={title} />
      {!!sub && (
        <ThemeText
          variant={'body'}
          styles={[styles.sub, { color: tokens.muted }]}
          content={sub}
        />
      )}
    </View>
  );
}

export function EmojiDisc({ emoji }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.disc, { backgroundColor: tokens.disc }]}>
      <ThemeText styles={styles.emoji} content={emoji} />
    </View>
  );
}

export function AssetDisc({ asset }) {
  const icon = asset === 'dollar' ? ICONS.dollarIcon : ICONS.bitcoinIcon;
  return (
    <View
      style={[
        styles.disc,
        {
          backgroundColor:
            asset === 'dollar' ? COLORS.dollarGreen : COLORS.bitcoinOrange,
        },
      ]}
    >
      <ThemeImage
        styles={styles.assetIcon}
        lightModeIcon={icon}
        darkModeIcon={icon}
        lightsOutIcon={icon}
      />
    </View>
  );
}

// Empty state with a Back button pinned to the bottom of the sheet.
export function SheetEmpty({ icon, title, sub, buttonText, onPress }) {
  const { tokens } = useTheme();
  return (
    <>
      <View style={styles.empty}>
        <View style={[styles.emptyDisc, { backgroundColor: tokens.ground }]}>
          <ThemeIcon
            redesign
            iconName={icon}
            size={26}
            colorOverride={tokens.muted}
          />
        </View>
        <ThemeText styles={styles.emptyTitle} content={title} />
        {!!sub && (
          <ThemeText
            variant={'body'}
            styles={[styles.emptySub, { color: tokens.muted }]}
            content={sub}
          />
        )}
      </View>
      <CustomButton
        buttonStyles={styles.bottomButton}
        actionFunction={onPress}
        textContent={buttonText}
        size={'regular'}
        tone={'secondary'}
      />
    </>
  );
}

// Check, label, amount, one status line, Done.
export function SheetResult({ label, amountProps, line, buttonText, onDone }) {
  const { tokens } = useTheme();
  return (
    <>
      <View style={styles.result}>
        <Disc icon="Check" size={88} iconSize={40} tone="primary" />
        <ThemeText
          variant={'body'}
          styles={[styles.resultLabel, { color: tokens.muted }]}
          content={label}
        />
        <AmountHero {...amountProps} amountSize={48} />
        <ThemeText
          variant={'body'}
          styles={[styles.resultLine, { color: tokens.muted }]}
          content={line}
        />
      </View>
      <CustomButton
        buttonStyles={styles.bottomButton}
        actionFunction={onDone}
        textContent={buttonText}
        size={'regular'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  titleFirst: { marginTop: 20 },
  titleAfterBack: { marginTop: 4 },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  sub: { marginTop: 4 },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: {
    fontSize: 19,
    lineHeight: 24,
    includeFontPadding: false,
  },
  assetIcon: { width: 22, height: 22 },
  empty: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  emptyDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
  emptySub: {
    marginTop: 6,
    textAlign: 'center',
  },
  result: {
    marginTop: 48,
    alignItems: 'center',
  },
  resultLabel: {
    marginTop: 28,
    marginBottom: 4,
    textAlign: 'center',
  },
  resultLine: {
    marginTop: 10,
    textAlign: 'center',
  },
  bottomButton: {
    width: '100%',
    marginTop: 'auto',
  },
});
