import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import QrCard from '../../app/functions/CustomElements/redesign/QrCard';
import StyledQRCode from '../../app/functions/CustomElements/StyledQRCode';

jest.mock('../../app/functions/CustomElements/StyledQRCode', () => () => null);
jest.mock(
  '../../app/components/admin/homeComponents/contacts/internalComponents/profileImage',
  () => () => null,
);

jest.mock('../../context-store/imageCache', () => ({
  useImageCache: () => ({ cache: {} }),
}));

jest.mock('../../context-store/theme', () => ({
  useTheme: () => ({
    tokens: require('../../app/constants/themes').MODES.light,
  }),
}));

jest.mock('../../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({
    globalContactsInformation: { myProfile: { uniqueName: 'alice' } },
  }),
}));

const render = element => {
  let r;
  act(() => {
    r = ReactTestRenderer.create(element);
  });
  return r;
};
const rings = (r, width) =>
  r.root.findAll(
    n => n.props.style && StyleSheet.flatten(n.props.style).width === width,
  );

test('badge outer diameter is 25% of the QR and the knockout covers it', () => {
  const r = render(<QrCard value="lnbc1test" size={300} />);
  const qr = r.root.findByType(StyledQRCode);
  expect(qr.props.logoSize).toBe(75);
  expect(qr.props.logoMargin).toBe(0);
  expect(rings(r, 75).length).toBeGreaterThan(0);
});

test('default size 216 gives a 54pt badge', () => {
  const r = render(<QrCard value="x" />);
  expect(r.root.findByType(StyledQRCode).props.logoSize).toBe(54);
  expect(rings(r, 54).length).toBeGreaterThan(0);
});

test('size 250 rounds to 63', () => {
  const r = render(<QrCard value="x" size={250} />);
  expect(r.root.findByType(StyledQRCode).props.logoSize).toBe(63);
});

test('showBadge={false} renders no logo knockout', () => {
  const r = render(<QrCard value="x" size={300} showBadge={false} />);
  expect(r.root.findByType(StyledQRCode).props.logoSize).toBeUndefined();
  expect(rings(r, 75).length).toBe(0);
});
