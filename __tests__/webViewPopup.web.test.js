import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import CustomWebView from '../app/functions/CustomElements/webViewPopup.web';

jest.mock('../app/functions/CustomElements/globalThemeView', () => {
  const MockReact = require('react');
  return {__esModule: true, default: ({children}) => MockReact.createElement('View', null, children)};
});
jest.mock('../app/functions/CustomElements/settingsTopBar', () => () => null);
jest.mock('../app/functions/CustomElements/textTheme', () => () => null);

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
  act(() => renderer.root.findByProps({accessibilityRole: 'link'}).props.onPress());
  expect(open).toHaveBeenCalledWith('http://example.com/help', '_blank', 'noopener,noreferrer');
});

test.each(['javascript:alert(1)', 'data:text/html,hi', 'not a URL'])(
  'does not offer an external link for %s', url => {
    let renderer;
    act(() => {
      renderer = ReactTestRenderer.create(<CustomWebView route={{params: {webViewURL: url}}} />);
    });
    expect(renderer.root.findAllByProps({accessibilityRole: 'link'})).toHaveLength(0);
  },
);
