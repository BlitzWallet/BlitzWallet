import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('react-i18next', () => {
  const enTranslations = require('../../../../../../../locales/en/translation.json');
  return {
    useTranslation: () => ({
      t: (key, opts = {}) => {
        let value =
          key.split('.').reduce((node, part) => node?.[part], enTranslations) ??
          key;
        return Object.entries(opts).reduce(
          (s, [k, v]) => s.split(`{{${k}}}`).join(String(v)),
          value,
        );
      },
    }),
  };
});

jest.mock('../../../../../../../app/hooks/themeColors', () => () => ({
  textColor: '#000000',
  backgroundOffset: '#ffffff',
}));

jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const createSvgElement = name => props =>
    mockReact.createElement(name, props);
  return {
    __esModule: true,
    default: createSvgElement('svg'),
    Svg: createSvgElement('svg'),
    Circle: createSvgElement('circle'),
    Line: createSvgElement('line'),
    Path: createSvgElement('path'),
  };
});

const SasPatternGrid =
  require('../../../../../../../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/SasPatternGrid').default;

function renderGrid(sas) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<SasPatternGrid sas={sas} />);
  });
  return renderer;
}

function cellsOf(renderer) {
  // The RN jest preset surfaces every View twice (composite + host instance);
  // keep the first (outer) instance of each distinct cell label.
  const seen = new Set();
  return renderer.root.findAll(n => {
    if (!(n.props && n.props.accessible === true)) return false;
    if (seen.has(n.props.accessibilityLabel)) return false;
    seen.add(n.props.accessibilityLabel);
    return true;
  });
}

describe('SasPatternGrid accessibility', () => {
  test('every cell is a separate accessible element with a spoken description', () => {
    // idx per char: 0 circle, 1 circle, 2 square, 3 square, 4 triangle,
    // c (12) = cross X, d (13) = cross plus, 8 hexagon, u = invalid (blank).
    const renderer = renderGrid('01234cd8u');
    const cells = cellsOf(renderer);

    expect(cells).toHaveLength(9);
    expect(cells.map(c => c.props.accessibilityLabel)).toEqual([
      'Circle, Outline, Row 1 of 3, column 1 of 3.',
      'Circle, Filled, Row 1 of 3, column 2 of 3.',
      'Square, Outline, Row 1 of 3, column 3 of 3.',
      'Square, Filled, Row 2 of 3, column 1 of 3.',
      'Triangle, Outline, Row 2 of 3, column 2 of 3.',
      'X, Row 2 of 3, column 3 of 3.',
      'Plus, Row 3 of 3, column 1 of 3.',
      'Hexagon, Outline, Row 3 of 3, column 2 of 3.',
      'Blank, Row 3 of 3, column 3 of 3.',
    ]);
  });

  test('even indices announce outline, odd indices announce filled', () => {
    const renderer = renderGrid('012345678');
    const cells = cellsOf(renderer);
    expect(cells).toHaveLength(9);

    for (let i = 0; i < 9; i++) {
      expect(cells[i].props.accessibilityLabel).toContain(
        i % 2 === 0 ? 'Outline' : 'Filled',
      );
    }
  });

  test('base-6 cross announces X or Plus instead of a variant word', () => {
    const renderer = renderGrid('cd0uuuuuu');
    const cells = cellsOf(renderer);

    expect(cells[0].props.accessibilityLabel).toBe(
      'X, Row 1 of 3, column 1 of 3.',
    );
    expect(cells[1].props.accessibilityLabel).toBe(
      'Plus, Row 1 of 3, column 2 of 3.',
    );
  });

  test('a missing sas renders no accessible cells', () => {
    const renderer = renderGrid(null);
    expect(cellsOf(renderer)).toHaveLength(0);
  });
});
