import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {InsetsProvider, useGlobalInsets} from '../../context-store/insetsProvider';

let mockSafeInsets = {top: 47, bottom: 34, left: 0, right: 0};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeInsets,
}));

describe('InsetsProvider', () => {
  let latestInsets;

  function Consumer() {
    latestInsets = useGlobalInsets();
    return null;
  }

  it('propagates all four edges and updates after rotation', () => {
    let renderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <InsetsProvider>
          <Consumer />
        </InsetsProvider>,
      );
    });
    expect(latestInsets).toMatchObject({
      topPadding: 47,
      bottomPadding: 34,
      leftPadding: 0,
      rightPadding: 0,
    });

    mockSafeInsets = {top: 0, bottom: 21, left: 59, right: 59};
    act(() =>
      renderer.update(
        <InsetsProvider>
          <Consumer />
        </InsetsProvider>,
      ),
    );
    expect(latestInsets).toMatchObject({
      bottomPadding: 21,
      leftPadding: 59,
      rightPadding: 59,
    });
    act(() => renderer.unmount());
  });
});
