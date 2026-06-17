import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('i18next', () => ({ language: 'en' }));
const i18next = require('i18next');

jest.mock('../app/constants', () => ({
  CONTENT_KEYBOARD_OFFSET: 10,
  SIZES: { large: 20 },
}));

jest.mock('../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#000' }),
}));

jest.mock('../app/functions/CustomElements/textTheme', () => ({
  __esModule: true,
  default: function MockThemeText({ content }) {
    const MockReact = require('react');
    const { Text } = require('react-native');
    return MockReact.createElement(Text, null, content);
  },
}));

const EmojiQuickBar = require('../app/functions/CustomElements/emojiBar')
  .default;

function renderEmojiBar(description) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <EmojiQuickBar description={description} onEmojiSelect={jest.fn()} />,
    );
  });
  return renderer;
}

describe('EmojiQuickBar', () => {
  afterEach(() => {
    i18next.language = 'en';
  });

  // Languages the app supports (see i18n.js) that have no EMOJI_KEYWORDS map.
  test.each(['fr', 'sv', 'ru', 'de', 'pt'])(
    'renders without crashing while typing a word in unsupported-keyword language: %s',
    language => {
      i18next.language = language;
      expect(() => renderEmojiBar('coffee')).not.toThrow();
    },
  );

  test('renders for a language that has a keyword map', () => {
    i18next.language = 'en';
    expect(() => renderEmojiBar('coffee')).not.toThrow();
  });

  test('renders default emojis when description is empty', () => {
    i18next.language = 'fr';
    expect(() => renderEmojiBar('')).not.toThrow();
  });
});
