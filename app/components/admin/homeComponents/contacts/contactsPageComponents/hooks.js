import {useEffect, useMemo, useState} from 'react';

export const useProcessedContacts = (
  decodedAddedContacts,
  contactsMessags,
  cache,
) => {
  const [contactInfoList, setContactInfoList] = useState([]);

  useEffect(() => {
    const processedContacts = decodedAddedContacts.map(contact => {
      const info = contactsMessags[contact.uuid] || {};
      return {
        contact,
        hasUnlookedTransaction: !!info.messages?.some(m => !m.message.wasSeen),
        lastUpdated: info.lastUpdated,
        firstMessage: info.messages?.[0],
      };
    });
    setContactInfoList(processedContacts);
  }, [decodedAddedContacts, contactsMessags, cache]);

  return contactInfoList;
};

export const useFilteredContacts = (
  contactInfoList,
  inputText,
  hideUnknownContacts,
) => {
  return useMemo(() => {
    const searchTerm = inputText.toLowerCase();
    return contactInfoList
      .filter(item => {
        const matchesSearch =
          item.contact.name?.toLowerCase().startsWith(searchTerm) ||
          item.contact.uniqueName?.toLowerCase().startsWith(searchTerm);
        const isNotFavorite = !item.contact.isFavorite;
        const shouldShow = !hideUnknownContacts || item.contact.isAdded;

        return matchesSearch && isNotFavorite && shouldShow;
      })
      .sort((a, b) => {
        const timeDiff = (b.lastUpdated || 0) - (a.lastUpdated || 0);
        if (timeDiff !== 0) return timeDiff;

        const nameA = a.contact.name || a.contact.uniqueName || '';
        const nameB = b.contact.name || b.contact.uniqueName || '';
        return nameA.localeCompare(nameB);
      });
  }, [contactInfoList, inputText, hideUnknownContacts]);
};
