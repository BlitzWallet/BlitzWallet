import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  memo,
  useEffect,
} from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  useWindowDimensions,
} from 'react-native';
import { EMOJI_CATEGORIES } from '../../../../../functions/accounts/handleEmoji';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useTheme } from '../../../../../../context-store/theme';
import SectionHeader from '../../../../../functions/CustomElements/redesign/SectionHeader';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import {
  getChildAccountEmoji,
  setChildAccountEmoji,
  useChildAccountEmoji,
} from '../../../../../functions/accounts/childAccountEmojis';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import { useNavigation } from '@react-navigation/native';
import AccountProfileImage from '../../accounts/accountProfileImage';
import { useTranslation } from 'react-i18next';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';

// One grid row of 7. Each row is its own slice of the white card (first/last
// rows round the corners) so the SectionList stays virtualised. `selected` is
// only set on the row holding the pick, so the other rows skip re-rendering.
const EmojiRow = memo(({ item, onEmojiSelect, selected, isFirst, isLast }) => {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.emojiRow,
        { backgroundColor: tokens.surface },
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
      ]}
    >
      {Array.from({ length: 7 }, (_, index) => {
        const emoji = item[index];
        if (!emoji) return <View key={index} style={styles.emojiButton} />;
        const isSelected = emoji.emoji === selected;
        return (
          <TouchableOpacity
            key={`${emoji.emoji}-${index}`}
            style={[
              styles.emojiButton,
              isSelected && {
                backgroundColor: tokens.disc,
                borderColor: tokens.accent,
              },
            ]}
            onPress={() => onEmojiSelect(emoji.emoji)}
            accessibilityRole="button"
            accessibilityLabel={emoji.name}
            accessibilityState={{ selected: isSelected }}
            activeOpacity={0.7}
          >
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              styles={styles.emojiText}
              content={emoji.emoji}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const EmojiGrid = memo(({ sections, onEmojiSelect, selectedEmoji }) => {
  const renderEmojiRow = useCallback(
    ({ item, index, section }) => (
      <EmojiRow
        item={item}
        onEmojiSelect={onEmojiSelect}
        selected={
          item.some(emoji => emoji.emoji === selectedEmoji)
            ? selectedEmoji
            : null
        }
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
      />
    ),
    [onEmojiSelect, selectedEmoji],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => <SectionHeader title={section.title} />,
    [],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => `row-${index}`}
      renderItem={renderEmojiRow}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps={'handled'}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
});

const AvatarPreview = memo(({ selectedEmoji, onClear, selectedAccount }) => {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.previewContainer}>
      <View style={[styles.previewCircle, { backgroundColor: tokens.surface }]}>
        <AccountProfileImage
          imageSize={104}
          useStoredEmoji={false}
          account={{ ...selectedAccount, profileEmoji: selectedEmoji }}
        />
      </View>
      {!!selectedEmoji && (
        <TouchableOpacity
          style={[
            styles.clearButton,
            { backgroundColor: tokens.surface, borderColor: tokens.ground },
          ]}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={t('constants.clear')}
          activeOpacity={0.7}
        >
          <ThemeIcon redesign size={18} iconName={'X'} />
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function EmojiAvatarSelector(props) {
  const navigate = useNavigation();
  const accountId = props?.route?.params?.accountId;
  const { updateAccount, custodyAccountsList } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();

  // Managed (child) accounts live in the childAccounts registry, personal
  // custody accounts in custodyAccountsList.
  const selectedAccount = useMemo(() => {
    const childAccount = (masterInfoObject?.childAccounts || []).find(
      item => item.uuid === accountId,
    );
    if (childAccount) return childAccount;
    return custodyAccountsList?.find(item => item.uuid === accountId) || {};
  }, [custodyAccountsList, masterInfoObject?.childAccounts, accountId]);

  const isChild = selectedAccount?.childIndex !== undefined;

  // For child accounts the emoji lives in the local-only store, not the
  // account object. Seed from it once, and hydrate again when the store
  // finishes its async load (the effect only fires before the user picks).
  const storedChildEmoji = useChildAccountEmoji(isChild ? accountId : null);
  const [selectedEmoji, setSelectedEmoji] = useState(() => {
    if (isChild) return getChildAccountEmoji(accountId);
    return selectedAccount.profileEmoji || '';
  });
  const didInteractRef = useRef(false);
  useEffect(() => {
    if (!isChild || didInteractRef.current) return;
    setSelectedEmoji(storedChildEmoji);
  }, [isChild, storedChildEmoji]);

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleEmojiSelect = useCallback(emoji => {
    didInteractRef.current = true;
    setSelectedEmoji(emoji);
  }, []);

  const handleClear = useCallback(() => {
    didInteractRef.current = true;
    setSelectedEmoji('');
  }, []);

  const initialEmoji = isChild
    ? getChildAccountEmoji(accountId)
    : selectedAccount.profileEmoji || '';

  const handleSave = useCallback(async () => {
    if (selectedEmoji !== initialEmoji) {
      if (isChild) {
        await setChildAccountEmoji(accountId, selectedEmoji);
      } else {
        await updateAccount({
          ...selectedAccount,
          profileEmoji: selectedEmoji,
        });
      }
      keyboardGoBack(navigate);
    } else {
      navigate.goBack();
    }
  }, [
    selectedEmoji,
    initialEmoji,
    isChild,
    accountId,
    updateAccount,
    selectedAccount,
    navigate,
  ]);

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
    selectedEmoji === initialEmoji
      ? t('constants.back')
      : t('settings.accountComponents.selectProfileImage.saveButton');

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.accountComponents.selectProfileImage.title')}
        />
        <AvatarPreview
          selectedAccount={selectedAccount}
          selectedEmoji={selectedEmoji}
          onClear={handleClear}
        />
        <SearchField
          placeholder={t(
            'settings.accountComponents.selectProfileImage.searchPlaceholder',
          )}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          pill
        />
        <EmojiGrid
          sections={sectionsWithRows}
          onEmojiSelect={handleEmojiSelect}
          selectedEmoji={selectedEmoji}
        />
        <CustomButton
          actionFunction={handleSave}
          textContent={saveLabel}
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  previewContainer: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  previewCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  emojiRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  rowFirst: {
    paddingTop: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  rowLast: {
    paddingBottom: 8,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  emojiButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 26,
    lineHeight: 32,
    includeFontPadding: false,
  },
});
