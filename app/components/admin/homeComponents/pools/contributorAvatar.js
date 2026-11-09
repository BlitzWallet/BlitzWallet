import ContactAvatarDisc from '../contacts/internalComponents/contactAvatar';

/**
 * Single contributor avatar — initials on a pastel disc (shared contact avatar).
 *
 * @param {string} contributorName - Display name
 * @param {number} avatarSize - Diameter in px (default 28)
 */
export default function ContributorAvatar({
  contributorName = '',
  avatarSize = 28,
}) {
  return (
    <ContactAvatarDisc
      name={contributorName}
      size={avatarSize}
      fontSize={avatarSize * 0.4}
    />
  );
}
