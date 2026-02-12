import React, { useState, useMemo, useCallback, useRef, memo } from 'react';
import { View, TouchableOpacity, StyleSheet, SectionList } from 'react-native';
import { EMOJI_CATEGORIES } from '../../../../../functions/accounts/handleEmoji';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { COLORS, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import { HIDDEN_OPACITY, SIZES } from '../../../../../constants/theme';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import { useNavigation } from '@react-navigation/native';
import AccountProfileImage from '../../accounts/accountProfileImage';
import { useTranslation } from 'react-i18next';

const EmojiRow = memo(({ item, onEmojiSelect }) => (
  <View style={styles.emojiRow}>
    {item.map((emoji, index) => (
      <TouchableOpacity
        key={`${emoji.emoji}-${index}`}
        style={styles.emojiButton}
        onPress={() => onEmojiSelect(emoji.emoji)}
        activeOpacity={0.7}
      >
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          styles={styles.emojiText}
          content={emoji.emoji}
        />
      </TouchableOpacity>
    ))}
  </View>
));

const SectionHeader = memo(({ title, backgroundColor }) => (
  <View style={[styles.sectionHeader, { backgroundColor }]}>
    <ThemeText styles={styles.sectionTitle} content={title} />
  </View>
));

const EmojiGrid = memo(({ sections, onEmojiSelect, backgroundColor }) => {
  const renderEmojiRow = useCallback(
    ({ item }) => <EmojiRow item={item} onEmojiSelect={onEmojiSelect} />,
    [onEmojiSelect],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <SectionHeader title={section.title} backgroundColor={backgroundColor} />
    ),
    [backgroundColor],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => `row-${index}`}
      renderItem={renderEmojiRow}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={true}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
});

const AvatarPreview = memo(
  ({ selectedEmoji, backgroundOffset, onClear, selectedAccount }) => (
    <View style={styles.previewContainer}>
      <View
        style={[styles.previewCircle, { backgroundColor: backgroundOffset }]}
      >
        <AccountProfileImage
          imageSize={120}
          account={{ ...selectedAccount, profileEmoji: selectedEmoji }}
        />
        {!!selectedEmoji && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClear}
            activeOpacity={0.7}
          >
            <ThemeIcon
              size={25}
              colorOverride={COLORS.lightModeText}
              iconName={'X'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ),
);

export default function EmojiAvatarSelector(props) {
  const navigate = useNavigation();
  const selectedAccount = props?.route?.params?.account;
  const { updateAccount } = useActiveCustodyAccount();
  const { t } = useTranslation();

  const [selectedEmoji, setSelectedEmoji] = useState(
    selectedAccount.profileEmoji || '',
  );
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const handleEmojiSelect = useCallback(emoji => {
    setSelectedEmoji(emoji);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedEmoji('');
  }, []);

  const handleSave = useCallback(() => {
    if (selectedEmoji !== selectedAccount.profileEmoji) {
      updateAccount({ ...selectedAccount, profileEmoji: selectedEmoji });
      keyboardGoBack(navigate);
    } else {
      navigate.goBack();
    }
  }, [selectedEmoji, updateAccount, selectedAccount, navigate]);

  // Only recomputes on searchQuery change
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return EMOJI_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return EMOJI_CATEGORIES.map(section => ({
      ...section,
      data: section.data.filter(
        emoji =>
          emoji.name.toLowerCase().includes(query) ||
          emoji.shortName.toLowerCase().includes(query),
      ),
    })).filter(section => section.data.length > 0);
  }, [searchQuery]);

  // Chunking into rows of 7 — only recomputes on searchQuery change
  const sectionsWithRows = useMemo(() => {
    return filteredSections.map(section => {
      const rows = [];
      for (let i = 0; i < section.data.length; i += 7) {
        rows.push(section.data.slice(i, i + 7));
      }
      return { title: section.title, data: rows };
    });
  }, [filteredSections]);

  const saveLabel =
    selectedEmoji === selectedAccount.profileEmoji
      ? t('constants.back')
      : t('settings.accountComponents.selectProfileImage.saveButton');

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        label={t('settings.accountComponents.selectProfileImage.title')}
      />

      <AvatarPreview
        selectedAccount={selectedAccount}
        selectedEmoji={selectedEmoji}
        backgroundOffset={backgroundOffset}
        onClear={handleClear}
      />

      <CustomSearchInput
        containerStyles={styles.searchContainer}
        placeholderText={t(
          'settings.accountComponents.selectProfileImage.searchPlaceholder',
        )}
        inputText={searchQuery}
        setInputText={setSearchQuery}
        autoCapitalize="none"
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
      />

      <EmojiGrid
        sections={sectionsWithRows}
        onEmojiSelect={handleEmojiSelect}
        backgroundColor={backgroundColor}
      />

      <CustomButton
        buttonStyles={styles.saveButton}
        actionFunction={handleSave}
        textContent={saveLabel}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 32,
  },
  previewCircle: {
    width: 120,
    height: 120,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewEmoji: {
    fontSize: 60,
  },
  clearButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 18,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingBottom: 12,
    paddingTop: 10,
  },
  sectionTitle: {
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: HIDDEN_OPACITY,
  },
  emojiRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  emojiButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  emojiText: {
    fontSize: SIZES.xLarge,
  },
  saveButton: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
