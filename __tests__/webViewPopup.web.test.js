import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import CustomWebView from '../app/functions/CustomElements/webViewPopup.web';
import CustomButton from '../app/functions/CustomElements/button';

jest.mock('../app/functions/CustomElements/globalThemeView', () => {
  const MockReact = require('react');
  return {__esModule: true, default: ({children}) => MockReact.createElement('View', null, children)};
});
jest.mock('../app/functions/CustomElements/redesign/TopBar', () => () => null);
jest.mock('../app/functions/CustomElements/textTheme', () => () => null);
jest.mock('react-i18next', () => ({useTranslation: () => ({t: key => key})}));
jest.mock('../context-store/theme', () => {
  const tokens = require('../app/constants/themes').MODES.light;
  return {
    useGlobalThemeContext: () => ({theme: false, darkModeType: false, tokens}),
    useTheme: () => ({tokens}),
  };
});

test('opens a permitted external page in a new tab from a user click', () => {
  const open = jest.fn();
  window.open = open;
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <CustomWebView route={{params: {webViewURL: 'http://example.com/help', headerText: 'Help'}}} />,
    );
  });
  expect(open).not.toHaveBeenCalled();

  const openLink = renderer.root.findAllByType(CustomButton)[0];
  expect(openLink.props.textContent).toBe('screens.webViewPopup.openLink');
  act(() => openLink.props.actionFunction());
  expect(open).toHaveBeenCalledWith('http://example.com/help', '_blank', 'noopener,noreferrer');
});

test.each(['javascript:alert(1)', 'data:text/html,hi', 'not a URL'])(
  'does not offer an external link for %s', url => {
    let renderer;
    act(() => {
      renderer = ReactTestRenderer.create(<CustomWebView route={{params: {webViewURL: url}}} />);
    });
    expect(renderer.root.findAllByType(CustomButton)).toHaveLength(0);
  },
);
