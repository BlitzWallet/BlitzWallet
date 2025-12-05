export function formatDisplayName(contact) {
  try {
    if (contact.name?.length) {
      return contact.name?.trim();
    } else if (contact.uniqueName?.length) {
      return contact.uniqueName?.trim();
    } else if (contact.isLNURL) {
      const [prefix, suffix] = contact.receiveAddress.split('@');
      console.log(prefix, suffix);
      return prefix;
    }
    return '';
  } catch (err) {
    console.log('error formatting display name', err);
    return '';
  }
}
