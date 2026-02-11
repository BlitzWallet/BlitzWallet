import emojiDataRaw from '../../assets/emoji.json';

// Convert Unicode code points to native emoji
function unifiedToNative(unified) {
  return unified
    .split('-')
    .map(hex => String.fromCodePoint(parseInt(hex, 16)))
    .join('');
}

// Process raw emoji data and organize by category
function processEmojiData() {
  const categoryMap = {};

  emojiDataRaw.forEach(item => {
    // Skip obsolete emojis
    if (item.obsoleted_by || item.obsoletes) {
      return;
    }

    const category = item.category || 'Other';
    const native = unifiedToNative(item.unified);

    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }

    categoryMap[category].push({
      emoji: native,
      name: item.name || item.short_name?.toUpperCase(),
      category: item.category,
      shortName: item.short_name,
      unified: item.unified,
    });
  });

  // Define category order for better UX
  const categoryOrder = [
    'Suggested',
    'Smileys & Emotion',
    'People & Body',
    'Animals & Nature',
    'Food & Drink',
    'Travel & Places',
    'Activities',
    'Objects',
    'Symbols',
    'Flags',
  ];

  // Create sections in defined order
  const sections = [];

  // Add custom "Suggested" category first
  sections.push({
    title: 'Suggested',
    data: SUGGESTED_EMOJIS.map(emoji => ({
      emoji,
      name: 'Suggested',
      category: 'Suggested',
      shortName: 'suggested',
      unified: '',
    })),
  });

  // Add other categories in order
  categoryOrder.slice(1).forEach(category => {
    if (categoryMap[category] && categoryMap[category].length > 0) {
      sections.push({
        title: category,
        data: categoryMap[category],
      });
    }
  });

  // Add any remaining categories not in the predefined order
  Object.keys(categoryMap).forEach(category => {
    if (!categoryOrder.includes(category)) {
      sections.push({
        title: category,
        data: categoryMap[category],
      });
    }
  });

  return sections;
}

// Suggested emojis for Bitcoin wallet - customize these!
export const SUGGESTED_EMOJIS = [
  '🔥',
  '🔐',
  '🔮',
  '🖼️',
  '💯',
  '🔌',
  '⚒️',
  '🔗',
  '🚀',
  '🌙',
  '💩',
  '👻',
  '👽',
  '👾',
  '🤖',
  '😺',
  '🥶',
  '😶',
  '😏',
  '🤡',
  '💎',
  '🙌',
  '🗣️',
  '💪',
  '💸',
  '💵',
  '🧠',
  '📱',
  '⚫',
  '⚡',
  '💰',
  '🏦',
  '📈',
  '📉',
  '💳',
];

// Export processed emoji categories
export const EMOJI_CATEGORIES = processEmojiData();

// Search helper
export function searchEmojis(query, sections) {
  if (!query.trim()) {
    return sections;
  }

  const lowerQuery = query.toLowerCase();

  return sections
    .map(section => ({
      ...section,
      data: section.data.filter(
        emoji =>
          emoji.name.toLowerCase().includes(lowerQuery) ||
          emoji.shortName.toLowerCase().includes(lowerQuery) ||
          emoji.emoji.includes(query),
      ),
    }))
    .filter(section => section.data.length > 0);
}
