import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';

const GOAL_EMOJIS = [
  '💵',
  '🏖️',
  '🎁',
  '🎓',
  '🏠',
  '☔',
  '🎂',
  '❤️',
  '♟️',
  '🍽️',
  '💻',
  '📍',
];
const COLUMNS = 4;
const GAP = 10;

export default function SavingsGoalEmoji() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [selectedEmoji, setSelectedEmoji] = useState('💵');
  const { tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const tileWidth = (contentWidth - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('savings.goalEmoji.screenTitle')} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemeText
            variant={'title'}
            styles={styles.title}
            content={t('savings.goalEmoji.title')}
          />
          <ThemeText
            variant={'body'}
            styles={[styles.subtitle, { color: tokens.muted }]}
            content={t('savings.goalEmoji.subtitle')}
          />

          <View style={styles.grid}>
            {GOAL_EMOJIS.map(item => {
              const selected = item === selectedEmoji;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setSelectedEmoji(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={item}
                  accessibilityState={{ selected }}
                  style={[
                    styles.emojiCell,
                    {
                      width: tileWidth,
                      backgroundColor: tokens.surface,
                      borderColor: selected ? tokens.accent : 'transparent',
                    },
                  ]}
                >
                  <ThemeText styles={styles.emojiText} content={item} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <CustomButton
          buttonStyles={styles.button}
          actionFunction={() =>
            navigate.navigate('SavingsGoalDescribe', { emoji: selectedEmoji })
          }
          textContent={t('savings.goalEmoji.continueButton')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  title: {
    marginTop: 20,
  },
  subtitle: {
    marginTop: 8,
  },
  grid: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  emojiCell: {
    height: 72,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 32,
    lineHeight: 40,
    includeFontPadding: false,
  },
  button: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
