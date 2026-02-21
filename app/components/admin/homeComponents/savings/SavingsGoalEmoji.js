import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { WINDOWWIDTH } from '../../../../constants/theme';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../../../hooks/themeColors';

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

export default function SavingsGoalEmoji() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [selectedEmoji, setSelectedEmoji] = useState('💵');
  const { backgroundOffset } = GetThemeColors();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('savings.goalEmoji.screenTitle')} />
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.goalEmoji.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('savings.goalEmoji.subtitle')}
        />

        <FlatList
          showsVerticalScrollIndicator={false}
          data={GOAL_EMOJIS}
          keyExtractor={item => item}
          numColumns={3}
          style={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const selected = item === selectedEmoji;
            return (
              <TouchableOpacity
                onPress={() => setSelectedEmoji(item)}
                activeOpacity={0.7}
                style={[
                  styles.emojiCell,
                  { backgroundColor: backgroundOffset },
                  selected && {
                    ...styles.emojiSelected,
                    borderColor:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  },
                ]}
              >
                <ThemeText styles={styles.emojiText} content={item} />
              </TouchableOpacity>
            );
          }}
        />

        <CustomButton
          buttonStyles={{
            marginTop: CONTENT_KEYBOARD_OFFSET,
            alignSelf: 'center',
          }}
          actionFunction={() =>
            navigate.navigate('SavingsGoalDescribe', { emoji: selectedEmoji })
          }
          textContent={t('savings.goalEmoji.continueButton')}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
    justifyContent: 'space-between',
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginTop: 26,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
    includeFontPadding: false,
  },
  grid: {
    marginTop: 18,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emojiCell: {
    width: '30%',
    flexShrink: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiSelected: {
    borderColor: COLORS.black,
    borderWidth: 4,
  },
  emojiText: {
    fontSize: 30,
  },
  primaryButton: {
    borderRadius: 22,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
});
