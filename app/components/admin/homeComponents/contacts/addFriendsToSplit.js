import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import ContactAvatarDisc from './internalComponents/contactAvatar';
import { useTheme } from '../../../../../context-store/theme';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useImageCache } from '../../../../../context-store/imageCache';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';

const MAX_SPLIT_CONTACTS = 10;

function ContactAvatar({ contact, size }) {
  const { cache } = useImageCache();
  return (
    <ContactAvatarDisc
      name={contact.name || contact.uniqueName}
      seed={contact.uuid}
      uri={cache[contact.uuid]?.localUri}
      updated={cache[contact.uuid]?.updated}
      size={size}
    />
  );
}

export default function AddFriendsToSplit(props) {
  const {
    paymentType,
    selectedContact,
    paymentCurrency = 'BTC',
  } = props.route.params || {};
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { decodedAddedContacts } = useGlobalContacts();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

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
    // LNURL contacts can't be split with, so they never show.
    const selectable = sortedContacts.filter(c => !c.isLNURL);
    if (!searchQuery) return selectable;
    const lower = searchQuery.toLowerCase();
    return selectable.filter(
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

  const selectedCount = selectedContacts.length;

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
      const isSelected = selectedUuids.has(contact.uuid);
      const isLocked = contact.uuid === selectedContact.uuid;
      const atLimit = !isSelected && selectedCount >= MAX_SPLIT_CONTACTS;

      return (
        <ListRow
          minHeight={64}
          paddingVertical={4}
          onPress={isLocked ? undefined : () => toggleContact(contact)}
          lead={<ContactAvatar contact={contact} size={40} />}
          title={
            contact.name || contact.uniqueName || t('contacts.splitBill.noName')
          }
          sub={contact.uniqueName ? `@${contact.uniqueName}` : undefined}
          tone={atLimit ? 'hidden' : 'default'}
          trailing={
            <View
              style={[
                styles.check,
                isSelected
                  ? { backgroundColor: tokens.accent }
                  : { borderWidth: 2, borderColor: tokens.grab },
              ]}
            >
              {isSelected && (
                <ThemeIcon
                  redesign
                  iconName="Check"
                  size={14}
                  strokeWidth={3}
                  colorOverride={tokens.onAccent}
                />
              )}
            </View>
          }
        />
      );
    },
    [selectedUuids, toggleContact, selectedContact, selectedCount, tokens, t],
  );

  const keyExtractor = useCallback(item => item.uuid, []);

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      useStandardWidth={true}
      useTouchableWithoutFeedback
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('contacts.splitBill.addFriendsTitle')} />

        <View style={styles.search}>
          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('contacts.splitBill.searchPlaceholder')}
            pill
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
          />
        </View>

        <View horizontal style={styles.chipsScroll}>
          {selectedContacts.map(contact => {
            const isLocked = contact.uuid === selectedContact.uuid;
            const displayName = contact.name || contact.uniqueName || '';
            return (
              <TouchableOpacity
                key={contact.uuid}
                disabled={isLocked}
                onPress={() => toggleContact(contact)}
                accessibilityRole="button"
                accessibilityLabel={displayName}
                style={[styles.chip, { backgroundColor: tokens.surface }]}
              >
                <ContactAvatar contact={contact} size={32} />
                <ThemeText
                  variant="body"
                  CustomNumberOfLines={1}
                  content={displayName.trim().split(' ')[0]}
                  styles={styles.chipName}
                />
                {!isLocked && (
                  <ThemeIcon
                    redesign
                    iconName="X"
                    size={14}
                    colorOverride={tokens.muted}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionHeader
          title={t('contacts.splitBill.selectedCount', {
            count: selectedCount,
          })}
        />

        {filteredContacts.length ? (
          <ListCard style={styles.card}>
            <FlatList
              style={styles.list}
              data={filteredContacts}
              renderItem={renderContact}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={ListDividerInset}
            />
          </ListCard>
        ) : (
          <EmptyState
            icon="UsersRound"
            title={
              decodedAddedContacts.length > 1
                ? t('contacts.splitBill.noContactsSearch')
                : t('contacts.splitBill.noContactsEmpty')
            }
          />
        )}

        <View style={styles.spacer} />
        <CustomButton
          buttonStyles={[
            styles.nextButton,
            { opacity: selectedCount <= 1 ? 0.5 : 1 },
          ]}
          actionFunction={handleNext}
          textContent={t('contacts.splitBill.nextButton')}
          size="regular"
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

// Divider starts after the 40 avatar + 12 gap (68 from the card edge).
const ListDividerInset = () => <ListDivider inset={68} />;

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  search: { marginTop: 20 },
  chipsScroll: {
    marginTop: 16,
    gap: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    minHeight: 44,
    paddingLeft: 4,
    paddingRight: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipName: { fontSize: 14, lineHeight: 20, maxWidth: 120 },
  card: { flexShrink: 1 },
  list: { flexGrow: 0 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
  nextButton: { marginTop: CONTENT_KEYBOARD_OFFSET },
});
