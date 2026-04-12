import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../functions/CustomElements/button';
import ContactProfileImage from './internalComponents/profileImage';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useImageCache } from '../../../../../context-store/imageCache';
import {
  COLORS,
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import ProfileImageRow from './internalComponents/profileImageRow';

const MAX_SPLIT_CONTACTS = 10;

export default function AddFriendsToSplit(props) {
  const {
    paymentType,
    selectedContact,
    paymentCurrency = 'BTC',
  } = props.route.params || {};
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { decodedAddedContacts } = useGlobalContacts();
  const { cache } = useImageCache();

  const [selectedContacts, setSelectedContacts] = useState([selectedContact]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  const sortedContacts = useMemo(() => {
    return [...decodedAddedContacts].sort((a, b) => {
      const nameA = a?.name || a?.uniqueName || '';
      const nameB = b?.name || b?.uniqueName || '';
      return nameA.localeCompare(nameB);
    });
  }, [decodedAddedContacts]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return sortedContacts;
    const lower = searchQuery.toLowerCase();
    return sortedContacts.filter(
      c =>
        c.name?.toLowerCase().startsWith(lower) ||
        c.uniqueName?.toLowerCase().startsWith(lower),
    );
  }, [sortedContacts, searchQuery]);

  const selectedUuids = useMemo(
    () => new Set(selectedContacts.map(c => c.uuid)),
    [selectedContacts],
  );

  const toggleContact = useCallback(
    contact => {
      if (selectedUuids.has(contact.uuid)) {
        setSelectedContacts(prev => prev.filter(c => c.uuid !== contact.uuid));
      } else if (selectedContacts.length >= MAX_SPLIT_CONTACTS) {
        // max reached — no-op (could show toast, but keep it simple)
      } else {
        setSelectedContacts(prev => [...prev, contact]);
      }
    },
    [selectedContacts.length, selectedUuids],
  );

  const handleNext = useCallback(() => {
    if (selectedCount <= 1) {
      navigation.navigate('ErrorScreen', {
        errorMessage: t('contacts.splitBill.errors.noContactsSelected'),
      });
      return;
    }
    navigation.navigate('CreateSplitBill', {
      selectedContacts,
      paymentType,
      paymentCurrency,
    });
  }, [navigation, selectedContacts, paymentType, selectedCount]);

  const renderContact = useCallback(
    ({ item: contact }) => {
      console.log(contact);
      // Skip contacts without a Spark address or LNURL contacts
      const isSelectable = !contact.isLNURL;
      const isSelected = selectedUuids.has(contact.uuid);
      const uniqueName = contact.uniqueName || '';
      const contactName = contact.name || t('contacts.splitBill.noName') || '';

      return (
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() =>
            isSelectable &&
            contact.uuid !== selectedContact.uuid &&
            toggleContact(contact)
          }
          activeOpacity={
            isSelectable && contact.uuid !== selectedContact.uuid ? 0.7 : 1
          }
        >
          <View
            style={[
              styles.contactAvatar,
              {
                backgroundColor: backgroundOffset,
                opacity: isSelectable ? 1 : 0.4,
              },
            ]}
          >
            <ContactProfileImage
              updated={cache[contact.uuid]?.updated}
              uri={cache[contact.uuid]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemeText
              styles={styles.contactUniqueName}
              content={uniqueName}
              CustomNumberOfLines={1}
            />
            <ThemeText
              styles={styles.contactName}
              content={contactName}
              CustomNumberOfLines={1}
            />
          </View>
          {isSelectable ? (
            <CheckMarkCircle containerSize={24} isActive={isSelected} />
          ) : (
            <View style={{ opacity: 0.4 }}>
              <CheckMarkCircle containerSize={24} />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [
      selectedUuids,
      toggleContact,
      backgroundOffset,
      darkModeType,
      theme,
      cache,
      t,
      selectedContact,
    ],
  );

  const keyExtractor = useCallback(item => item.uuid, []);

  const selectedCount = selectedContacts.length;

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar label={t('contacts.splitBill.addFriendsTitle')} />

      {/* Selected avatars stack */}
      <View
        style={[
          styles.selectedSection,
          {
            borderColor: theme ? backgroundOffset : COLORS.offsetBackground,
          },
        ]}
      >
        <ProfileImageRow contacts={selectedContacts} />
        <ThemeText
          styles={{
            marginBottom: CONTENT_KEYBOARD_OFFSET,
            textAlign: 'center',
            opacity: HIDDEN_OPACITY,
            fontSize: SIZES.smedium,
          }}
          content={`${selectedCount} of 10 selected`}
        />
      </View>

      {/* Search */}
      <CustomSearchInput
        inputText={searchQuery}
        setInputText={setSearchQuery}
        placeholderText={t('contacts.splitBill.searchPlaceholder')}
        containerStyles={styles.searchContainer}
        onBlurFunction={() => setIsKeyboardActive(false)}
        onFocusFunction={() => setIsKeyboardActive(true)}
      />

      {/* Contact list */}
      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <ThemeText
            styles={[styles.emptyText, { color: COLORS.opaicityGray }]}
            content={
              decodedAddedContacts.length > 1
                ? t('contacts.splitBill.noContactsSearch')
                : t('contacts.splitBill.noContactsEmpty')
            }
          />
        }
      />

      {/* Next button */}
      <CustomButton
        buttonStyles={[
          styles.nextButton,
          {
            opacity: selectedCount <= 1 ? 0.5 : 1,
            marginTop: CONTENT_KEYBOARD_OFFSET,
          },
        ]}
        textStyles={styles.nextButtonText}
        actionFunction={handleNext}
        textContent={t('contacts.splitBill.nextButton')}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  selectedSection: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  searchContainer: {
    marginTop: 8,
    marginBottom: 8,
    width: INSET_WINDOW_WIDTH,
  },
  listContent: {
    width: INSET_WINDOW_WIDTH,
    paddingBottom: 16,
    ...CENTER,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactUniqueName: {
    includeFontPadding: false,
    flexShrink: 1,
  },
  contactName: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    flexShrink: 1,
  },
  nextButton: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  nextButtonText: {
    includeFontPadding: false,
  },
  emptyText: {
    textAlign: 'center',
    // marginTop: 40,
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Regular,
    includeFontPadding: false,
  },
});
