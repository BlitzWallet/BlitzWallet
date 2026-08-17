import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { CENTER } from '../../../../../../constants';
import GetThemeColors from '../../../../../../hooks/themeColors';

// The SAS pattern: 9 base-36 chars (from computeSAS), each a shape index 0-29.
// index >> 1 picks the base (0-14; order matches the childPairing.js docs / spec
// table); index & 1 picks outline (0) vs filled (1). Shapes are drawn as SVG so
// both phones render them pixel-identically, independent of system fonts. All
// live in a 0-100 viewBox, centered, sized to read clearly at a glance.
//
// Screen-reader fallback: every cell also announces its shape by name (e.g.
// "Filled circle. Row 1 of 3, column 2 of 3.") so a low-vision user can follow
// the same verification over a phone call. The spoken names are
// language-dependent — the shapes themselves stay the language-neutral primary
// channel (see childPairing.js) — but both phones announce in the same
// language, which is all the comparison needs.

const STROKE = 7; // outline weight in viewBox units
const BAR = 15; // cross/plus arm thickness
const CORNER_RADIUS = 6; // rounded-corner radius applied to every vertex

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Every straight-edged shape gets the same rounded border: each vertex is cut
// at CORNER_RADIUS and rejoined with a quadratic arc.
function roundedPolygon(points, radius = CORNER_RADIUS) {
  const n = points.length;
  if (n < 3) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const dPrev = dist(cur, prev);
    const dNext = dist(cur, next);
    const r = Math.min(radius, dPrev / 2, dNext / 2);
    const a = [
      cur[0] + ((prev[0] - cur[0]) * r) / dPrev,
      cur[1] + ((prev[1] - cur[1]) * r) / dPrev,
    ];
    const b = [
      cur[0] + ((next[0] - cur[0]) * r) / dNext,
      cur[1] + ((next[1] - cur[1]) * r) / dNext,
    ];
    d += `${i === 0 ? 'M' : ' L'}${a[0]} ${a[1]} Q${cur[0]} ${cur[1]} ${b[0]} ${
      b[1]
    }`;
  }
  return `${d} Z`;
}

export function Shape({ base, filled, color, bg }) {
  const fill = { fill: color };
  const outline = {
    fill: 'none',
    stroke: color,
    strokeWidth: STROKE,
    strokeLinejoin: 'round',
  };
  const p = filled ? fill : outline;
  switch (base) {
    case 0: // Circle
      return <Circle cx={50} cy={50} r={38} {...p} />;
    case 1: // Square
      return (
        <Path
          d={roundedPolygon([
            [14, 14],
            [86, 14],
            [86, 86],
            [14, 86],
          ])}
          {...p}
        />
      );
    case 2: // Triangle
      return (
        <Path
          d={roundedPolygon([
            [50, 12],
            [88, 84],
            [12, 84],
          ])}
          {...p}
        />
      );
    case 3: // Diamond
      return (
        <Path
          d={roundedPolygon([
            [50, 8],
            [92, 50],
            [50, 92],
            [8, 50],
          ])}
          {...p}
        />
      );
    case 4: // Hexagon (flat-top)
      return (
        <Path
          d={roundedPolygon([
            [30, 12],
            [70, 12],
            [92, 50],
            [70, 88],
            [30, 88],
            [8, 50],
          ])}
          {...p}
        />
      );
    case 5: // Moon (crescent)
      return (
        <Path
          d="M87.5 53.3 A37.5 37.5 0 1 1 46.7 12.5 A29.2 29.2 0 0 0 87.5 53.3 Z"
          {...p}
        />
      );
    case 6: {
      // Cross: outline variant is an X (✕), filled variant a plus (✚).
      const bar = {
        stroke: color,
        strokeWidth: BAR,
        strokeLinecap: 'round',
      };
      return filled ? (
        <>
          <Line x1={50} y1={16} x2={50} y2={84} {...bar} />
          <Line x1={16} y1={50} x2={84} y2={50} {...bar} />
        </>
      ) : (
        <>
          <Line x1={22} y1={22} x2={78} y2={78} {...bar} />
          <Line x1={78} y1={22} x2={22} y2={78} {...bar} />
        </>
      );
    }
    case 7: // Star (5-point)
      return (
        <Path
          d={roundedPolygon([
            [50, 8],
            [60, 38],
            [92, 38],
            [66, 57],
            [76, 88],
            [50, 69],
            [24, 88],
            [34, 57],
            [8, 38],
            [40, 38],
          ])}
          {...p}
        />
      );
    case 8: // Heart
      return (
        <Path
          d="M50 82 C 22 62 8 42 22 26 C 34 12 50 18 50 32 C 50 18 66 12 78 26 C 92 42 78 62 50 82 Z"
          {...p}
        />
      );
    case 9: // Checkmark (closed tick, so fill/outline read the same as the rest)
      return (
        <Path
          d={roundedPolygon([
            [88, 24],
            [40, 72],
            [14, 46],
            [24, 36],
            [40, 52],
            [78, 14],
          ])}
          {...p}
        />
      );
    case 10: // Shield
      return (
        <Path
          d={roundedPolygon([
            [50, 8],
            [86, 20],
            [86, 48],
            [50, 90],
            [14, 48],
            [14, 20],
          ])}
          {...p}
        />
      );
    case 11: {
      // Clock: bezel + hands. On the filled disc the hands are drawn in the
      // cell background so they read as a cutout.
      const hand = {
        stroke: filled ? bg : color,
        strokeWidth: 6,
        strokeLinecap: 'round',
      };
      return (
        <>
          <Circle cx={50} cy={50} r={38} {...p} />
          <Line x1={50} y1={50} x2={50} y2={26} {...hand} />
          <Line x1={50} y1={50} x2={68} y2={56} {...hand} />
        </>
      );
    }
    case 12: // Bell (body + clapper below it, so the clapper stays visible)
      return (
        <>
          <Path
            d="M50 12 C 66 12 74 26 74 42 C 74 62 82 68 82 70 Q 82 76 76 76 L 24 76 Q 18 76 18 70 C 18 68 26 62 26 42 C 26 26 34 12 50 12 Z"
            {...p}
          />
          <Circle cx={50} cy={84} r={7} {...p} />
        </>
      );
    case 13: // House (peaked roof + body)
      return (
        <Path
          d={roundedPolygon([
            [50, 12],
            [90, 46],
            [90, 88],
            [10, 88],
            [10, 46],
          ])}
          {...p}
        />
      );
    case 14: // Apple (body + stem)
      return (
        <>
          <Path
            d="M50 32 C 40 22 20 24 18 46 C 16 68 34 86 50 86 C 66 86 84 68 82 46 C 80 24 60 22 50 32 Z"
            {...p}
          />
          <Line
            x1={50}
            y1={32}
            x2={56}
            y2={16}
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
          />
        </>
      );
    default:
      return null;
  }
}

const SAS_LABEL_NS = 'settings.childAccounts.sasGrid';

// Base index (0-14) -> i18n key, mirroring the switch cases in Shape.
const SHAPE_KEYS = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hexagon',
  'moon',
  'cross',
  'star',
  'heart',
  'checkmark',
  'shield',
  'clock',
  'bell',
  'house',
  'apple',
];

// Spoken description of one cell: shape name + outline/filled state + grid
// position, so the two people can walk the grid row by row over a call.
function sasCellLabel(t, idx, row, column) {
  if (idx === null) {
    return [
      t(`${SAS_LABEL_NS}.blank`),
      t(`${SAS_LABEL_NS}.position`, { row, column }),
    ].join(', ');
  }
  const base = idx >> 1;
  const filled = (idx & 1) === 1;
  // Base 6 is drawn as an X when outlined and a plus when filled, so the
  // variant word would be redundant — the shape name carries it.
  const shapeKey =
    base === 6 ? (filled ? 'plus' : 'x') : `shapes.${SHAPE_KEYS[base]}`;
  const label = [t(`${SAS_LABEL_NS}.${shapeKey}`)];
  if (base !== 6) {
    label.push(t(`${SAS_LABEL_NS}.${filled ? 'filled' : 'outline'}`));
  }
  label.push(t(`${SAS_LABEL_NS}.position`, { row, column }));
  return label.join(', ');
}

export default function SasPatternGrid({ sas, cellSize = 74 }) {
  const { t } = useTranslation();
  const { backgroundOffset, textColor } = GetThemeColors();
  const chars = String(sas || '').split('');
  const shapeSize = Math.round(cellSize * 0.6);

  return (
    <View style={styles.grid}>
      {[0, 3, 6].map((rowStart, row) => (
        <View key={rowStart} style={styles.row}>
          {chars.slice(rowStart, rowStart + 3).map((char, i) => {
            // Fail closed: only 0-t are valid shape indices. Anything else
            // renders a blank cell — visibly wrong — instead of defaulting to
            // a plausible-looking shape that could mask a derivation bug.
            const idx = /^[0-9a-t]$/.test(char) ? parseInt(char, 36) : null;
            return (
              <View
                key={rowStart + i}
                accessible
                accessibilityLabel={sasCellLabel(t, idx, row + 1, i + 1)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: backgroundOffset,
                  },
                ]}
              >
                <Svg width={shapeSize} height={shapeSize} viewBox="0 0 100 100">
                  {idx !== null && (
                    <Shape
                      base={idx >> 1}
                      filled={(idx & 1) === 1}
                      color={textColor}
                      bg={backgroundOffset}
                    />
                  )}
                </Svg>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
    marginVertical: 30,
    ...CENTER,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
