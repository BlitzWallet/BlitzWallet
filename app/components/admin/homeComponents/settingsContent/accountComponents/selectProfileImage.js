import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, SectionList } from 'react-native';
import { EMOJI_CATEGORIES } from '../../../../../functions/accounts/handleEmoji';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import ContactProfileImage from '../../contacts/internalComponents/profileImage';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { COLORS, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import { HIDDEN_OPACITY, SIZES } from '../../../../../constants/theme';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import { useNavigation } from '@react-navigation/native';
import AccountProfileImage from '../../accounts/accountProfileImage';
import { useTranslation } from 'react-i18next';

export default function EmojiAvatarSelector(props) {
  const navigate = useNavigation();
  const selectedAccount = props?.route?.params?.account;
  const { updateAccount } = useActiveCustodyAccount();
  const { t } = useTranslation();
  const [selectedEmoji, setSelectedEmoji] = useState(
    selectedAccount.profileEmoji || '',
  );
  const [isKeyboardActive, setIskeyboardActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const sectionListRef = useRef(null);

  // Handle emoji selection with animation
  const handleEmojiSelect = useCallback(emoji => {
    setSelectedEmoji(emoji);
  }, []);

  // Filter emojis based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES;
    }

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

  // Render emoji row (7 per row)
  const renderEmojiRow = useCallback(
    ({ item }) => (
      <View style={styles.emojiRow}>
        {item.map((emoji, index) => (
          <TouchableOpacity
            key={`${emoji.emoji}-${index}`}
            style={styles.emojiButton}
            onPress={() => handleEmojiSelect(emoji.emoji)}
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
    ),
    [handleEmojiSelect],
  );

  // Group emojis into rows of 7
  const sectionsWithRows = useMemo(() => {
    return filteredSections.map(section => {
      const rows = [];
      for (let i = 0; i < section.data.length; i += 7) {
        rows.push(section.data.slice(i, i + 7));
      }
      return {
        title: section.title,
        data: rows,
      };
    });
  }, [filteredSections]);

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section }) => (
      <View style={[styles.sectionHeader, { backgroundColor }]}>
        <ThemeText styles={styles.sectionTitle} content={section.title} />
      </View>
    ),
    [],
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (selectedEmoji !== selectedAccount.profileEmoji) {
      updateAccount({ ...selectedAccount, profileEmoji: selectedEmoji });
      keyboardGoBack(navigate);
    } else {
      navigate.goBack();
    }
  }, [selectedEmoji, updateAccount, selectedAccount]);

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedEmoji('');
  }, []);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        label={t('settings.accountComponents.selectProfileImage.title')}
      />

      {/* Avatar Preview */}
      <View style={styles.previewContainer}>
        <View
          style={[styles.previewCircle, { backgroundColor: backgroundOffset }]}
        >
          {selectedEmoji ? (
            <>
              <AccountProfileImage
                imageSize={120}
                account={{ ...selectedAccount, profileEmoji: selectedEmoji }}
              />
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <ThemeIcon
                  size={25}
                  colorOverride={COLORS.lightModeText}
                  iconName={'X'}
                />
              </TouchableOpacity>
            </>
          ) : (
            <ContactProfileImage />
          )}
        </View>
      </View>

      {/* Search Bar */}
      <CustomSearchInput
        containerStyles={styles.searchContainer}
        placeholderText={t(
          'settings.accountComponents.selectProfileImage.searchPlaceholder',
        )}
        inputText={searchQuery}
        setInputText={setSearchQuery}
        autoCapitalize="none"
        onFocusFunction={() => setIskeyboardActive(true)}
        onBlurFunction={() => setIskeyboardActive(false)}
      />

      {/* Emoji Grid */}
      <SectionList
        ref={sectionListRef}
        sections={sectionsWithRows}
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

      {/* Save Button */}
      <CustomButton
        buttonStyles={styles.saveButton}
        actionFunction={handleSave}
        textContent={
          selectedEmoji === selectedAccount.profileEmoji
            ? t('constants.back')
            : t('settings.accountComponents.selectProfileImage.saveButton')
        }
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
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
    fontSize: 40,
  },
  placeholderText: {
    fontSize: 120,
    color: '#333',
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
  saveButtonDisabled: {
    opacity: 0.5,
  },
});
