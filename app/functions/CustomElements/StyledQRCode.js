import React, { useMemo } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Image,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import QRCodeGenerator from 'qrcode';

const DEFAULT_VALUE = 'this is a QR code';

const createMatrix = (value, errorCorrectionLevel) => {
  const modules = QRCodeGenerator.create(value, {
    errorCorrectionLevel,
  }).modules;
  const data = Array.prototype.slice.call(modules.data, 0);
  const size = modules.size || Math.sqrt(data.length);

  return data.reduce((rows, cell, index) => {
    if (index % size === 0) rows.push([]);
    rows[rows.length - 1].push(cell);
    return rows;
  }, []);
};

const isEyeModule = (row, column, matrixSize) => {
  const inTop = row < 7;
  const inLeft = column < 7;
  const inRight = column >= matrixSize - 7;
  const inBottom = row >= matrixSize - 7;

  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
};

const getLogoArea = ({ size, logoSize, logoMargin }) => {
  const logoBackgroundSize = logoSize + logoMargin * 2;
  const logoPosition = (size - logoBackgroundSize) / 2;

  return {
    x: logoPosition,
    y: logoPosition,
    size: logoBackgroundSize,
  };
};

const isInsideLogoArea = ({ row, column, cellSize, logoArea }) => {
  if (!logoArea) return false;

  const centerX = column * cellSize + cellSize / 2;
  const centerY = row * cellSize + cellSize / 2;
  const logoCenterX = logoArea.x + logoArea.size / 2;
  const logoCenterY = logoArea.y + logoArea.size / 2;
  const logoRadius = logoArea.size / 2;
  const logoPadding = cellSize * 0.75;

  const dx = centerX - logoCenterX;
  const dy = centerY - logoCenterY;
  return Math.sqrt(dx * dx + dy * dy) <= logoRadius + logoPadding;
};

const createDotsPath = ({ matrix, cellSize, logoArea, pieceScale }) => {
  const matrixSize = matrix.length;
  const dotRadius = (cellSize * pieceScale) / 2;
  const pathSegments = [];

  matrix.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (
        !cell ||
        isEyeModule(rowIndex, columnIndex, matrixSize) ||
        isInsideLogoArea({
          row: rowIndex,
          column: columnIndex,
          cellSize,
          logoArea,
        })
      ) {
        return;
      }

      const cx = columnIndex * cellSize + cellSize / 2;
      const cy = rowIndex * cellSize + cellSize / 2;

      pathSegments.push(
        [
          `M${cx} ${cy - dotRadius}`,
          `a${dotRadius} ${dotRadius} 0 1 0 0 ${dotRadius * 2}`,
          `a${dotRadius} ${dotRadius} 0 1 0 0 ${-dotRadius * 2}`,
          'z',
        ].join(''),
      );
    });
  });

  return pathSegments.join('');
};

const renderEyes = ({ matrixSize, cellSize, color, backgroundColor }) => {
  const eyeSize = cellSize * 7;
  const positions = [
    [0, 0],
    [(matrixSize - 7) * cellSize, 0],
    [0, (matrixSize - 7) * cellSize],
  ];

  return positions.map(([x, y], index) => {
    const outerRadius = cellSize * 1.2;
    const middleInset = cellSize;
    const middleSize = cellSize * 5;
    const innerSize = cellSize * 3;
    const innerOffset = cellSize * 2;

    return (
      <G key={`eye-${index}`} x={x} y={y}>
        <Rect
          width={eyeSize}
          height={eyeSize}
          rx={outerRadius}
          ry={outerRadius}
          fill={color}
        />
        <Rect
          x={middleInset}
          y={middleInset}
          width={middleSize}
          height={middleSize}
          rx={cellSize * 0.8}
          ry={cellSize * 0.8}
          fill={backgroundColor}
        />
        <Rect
          x={innerOffset}
          y={innerOffset}
          width={innerSize}
          height={innerSize}
          rx={cellSize * 0.35}
          ry={cellSize * 0.35}
          fill={color}
        />
      </G>
    );
  });
};

const renderLogo = ({
  size,
  logo,
  logoSVG,
  logoSize,
  logoBackgroundColor,
  logoColor,
  logoMargin,
  backgroundColor,
}) => {
  const LogoSvg = typeof logoSVG === 'function' ? logoSVG : null;
  const imageLogo =
    typeof logoSVG === 'string' && logoSVG.trim().startsWith('<svg')
      ? `data:image/svg+xml;utf8,${encodeURIComponent(logoSVG)}`
      : logo || logoSVG;
  const logoBackgroundSize = logoSize + logoMargin * 2;
  const logoPosition = (size - logoBackgroundSize) / 2;

  return (
    <G x={logoPosition} y={logoPosition}>
      <Circle
        cx={logoBackgroundSize / 2}
        cy={logoBackgroundSize / 2}
        r={logoBackgroundSize / 2}
        fill={logoBackgroundColor || backgroundColor}
      />
      <G x={logoMargin} y={logoMargin}>
        {LogoSvg ? (
          <LogoSvg width={logoSize} height={logoSize} fill={logoColor} />
        ) : imageLogo ? (
          <Image
            width={logoSize}
            height={logoSize}
            preserveAspectRatio="xMidYMid slice"
            href={imageLogo}
          />
        ) : null}
      </G>
    </G>
  );
};

export default function StyledQRCode({
  value = DEFAULT_VALUE,
  size = 100,
  color = 'black',
  backgroundColor = 'white',
  logo,
  logoSVG,
  logoSize = size * 0.2,
  logoBackgroundColor,
  logoColor,
  logoMargin = 2,
  logoBorderRadius = 0,
  quietZone = 0,
  enableLinearGradient = false,
  gradientDirection = ['0%', '0%', '100%', '100%'],
  linearGradient = ['rgb(255,0,0)', 'rgb(0,255,255)'],
  ecl = 'M',
  getRef,
  onError,
  testID,
  pieceScale = 0.9,
  ...svgProps
}) {
  const matrix = useMemo(() => {
    try {
      return createMatrix(value, ecl);
    } catch (error) {
      if (typeof onError === 'function') {
        onError(error);
        return null;
      }
      throw error;
    }
  }, [value, ecl, onError]);

  const displayLogo = logo || logoSVG;
  const logoArea = useMemo(
    () => (displayLogo ? getLogoArea({ size, logoSize, logoMargin }) : null),
    [displayLogo, logoMargin, logoSize, size],
  );
  const matrixSize = matrix?.length || 0;
  const cellSize = matrixSize ? size / matrixSize : 0;
  const dotColor = enableLinearGradient ? 'url(#qr-gradient)' : color;
  const dotsPath = useMemo(
    () =>
      matrix ? createDotsPath({ matrix, cellSize, logoArea, pieceScale }) : '',
    [matrix, cellSize, logoArea, pieceScale],
  );

  if (!matrix) return null;

  return (
    <Svg
      testID={testID}
      ref={getRef}
      viewBox={[
        -quietZone,
        -quietZone,
        size + quietZone * 2,
        size + quietZone * 2,
      ].join(' ')}
      width={size}
      height={size}
      {...svgProps}
    >
      <Defs>
        <LinearGradient
          id="qr-gradient"
          x1={gradientDirection[0]}
          y1={gradientDirection[1]}
          x2={gradientDirection[2]}
          y2={gradientDirection[3]}
        >
          <Stop offset="0" stopColor={linearGradient[0]} stopOpacity="1" />
          <Stop offset="1" stopColor={linearGradient[1]} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect
        x={-quietZone}
        y={-quietZone}
        width={size + quietZone * 2}
        height={size + quietZone * 2}
        fill={backgroundColor}
      />
      <Path
        d={dotsPath}
        fill={dotColor}
      />
      {renderEyes({ matrixSize, cellSize, color: dotColor, backgroundColor })}
      {displayLogo &&
        renderLogo({
          size,
          logo,
          logoSVG,
          logoSize,
          logoBackgroundColor,
          logoColor,
          logoMargin,
          logoBorderRadius,
          backgroundColor,
        })}
    </Svg>
  );
}
