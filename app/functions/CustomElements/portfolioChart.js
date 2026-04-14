import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import * as d3 from 'd3-shape';
import * as scale from 'd3-scale';

export default function PortfolioChart({ data, width, height, strokeColor }) {
  const gradientId = `portfolioGradient-${data ? data.length : 0}`;

  if (!data || data.length < 2) {
    // Flat line for 0 or 1 data points
    const y = height / 2;
    return (
      <Svg width={width} height={height}>
        <Path
          d={`M 0 ${y} L ${width} ${y}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeOpacity={0.4}
        />
      </Svg>
    );
  }

  const padding = { top: 8, bottom: 8, left: 0, right: 0 };

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  // Add small buffer so curve doesn't clip at edges
  const range = maxVal - minVal || 1;
  const buffer = range * 0.15;

  const xScale = scale
    .scaleLinear()
    .domain([0, data.length - 1])
    .range([padding.left, width - padding.right]);

  const yScale = scale
    .scaleLinear()
    .domain([minVal - buffer, maxVal + buffer])
    .range([height - padding.bottom, padding.top]);

  const lineGenerator = d3
    .line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const areaGenerator = d3
    .area()
    .x((_, i) => xScale(i))
    .y0(height - padding.bottom)
    .y1(d => yScale(d))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const linePath = lineGenerator(data) || '';
  const areaPath = areaGenerator(data) || '';

  const lastX = xScale(data.length - 1);
  const lastY = yScale(data[data.length - 1]);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>

      {/* Gradient fill */}
      <Path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <Path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot at current (last) point */}
      <Circle cx={lastX} cy={lastY} r={6} fill={strokeColor} opacity={0.2} />
      <Circle cx={lastX} cy={lastY} r={3.5} fill={strokeColor} />
    </Svg>
  );
}
