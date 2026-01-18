import Svg, {
  G,
  Line,
  Path,
  Text as SvgText,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import * as d3 from 'd3-shape';
import * as scale from 'd3-scale';

export default function ModernLineChart({
  data,
  width,
  height,
  min,
  max,
  xLabels,
  strokeColor,
  textColor,
  leftPadding = 30,
  showGradient = true,
  showGrid = true,
  showDots = true,
  strokeWidth = 2.5,
}) {
  const padding = { top: 20, bottom: 30, left: leftPadding, right: 15 };

  // Calculate range and add buffer to prevent curve from going below baseline
  const range = max - min;
  const buffer = range * 0.15; // 15% buffer
  const adjustedMin = min - buffer;
  const adjustedMax = max + buffer;

  // Scales - use adjusted min/max for actual scaling
  const xScale = scale
    .scaleLinear()
    .domain([0, data.length - 1])
    .range([padding.left, width - padding.right]);

  const yScale = scale
    .scaleLinear()
    .domain([adjustedMin, adjustedMax])
    .range([height - padding.bottom, padding.top]);

  // Line generator with smooth curve
  const lineGenerator = d3
    .line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d))
    .curve(d3.curveCatmullRom.alpha(1)); // Smoother curve

  const linePath = lineGenerator(data) || '';

  // Area generator for gradient fill
  const areaGenerator = d3
    .area()
    .x((_, i) => xScale(i))
    .y0(height - padding.bottom)
    .y1(d => yScale(d))
    .curve(d3.curveCatmullRom.alpha(1));

  const areaPath = areaGenerator(data) || '';

  // Calculate Y ticks based on original min/max (not adjusted)
  // Create manual ticks to ensure consistent display
  const tickCount = 5;
  const tickStep = (max - min) / (tickCount - 1);
  const yTicks = Array.from(
    { length: tickCount },
    (_, i) => min + tickStep * i,
  );

  // Format large numbers
  const formatNumber = num => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Svg width={width} height={height}>
      <Defs>
        {/* Gradient for area fill */}
        <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>

      <G>
        {/* Y grid lines - minimal and subtle */}
        {showGrid &&
          yTicks.map((tick, i) => (
            <G key={`y-${i}`}>
              <Line
                x1={padding.left}
                x2={width - padding.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke={textColor}
                strokeOpacity="0.1"
                strokeWidth={1}
              />
            </G>
          ))}

        {/* Y axis labels - positioned on left */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`y-label-${i}`}
            x={padding.left - 8}
            y={yScale(tick) + 3}
            fontSize={10}
            fill={textColor}
            opacity={0.6}
            textAnchor="end"
          >
            {formatNumber(tick)}
          </SvgText>
        ))}

        {/* Gradient area fill */}
        {showGradient && (
          <Path d={areaPath} fill="url(#areaGradient)" opacity={1} />
        )}

        {/* Main data line */}
        <Path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data dots - only show last point for cleaner look */}
        {showDots && (
          <>
            {/* Outer glow circle */}
            <Circle
              cx={xScale(data.length - 1)}
              cy={yScale(data[data.length - 1])}
              r={6}
              fill={strokeColor}
              opacity={0.2}
            />
            {/* Inner dot */}
            <Circle
              cx={xScale(data.length - 1)}
              cy={yScale(data[data.length - 1])}
              r={3.5}
              fill={strokeColor}
            />
          </>
        )}

        {/* X labels - positioned at bottom */}
        {xLabels.map((label, i) => (
          <SvgText
            key={`x-${i}`}
            x={xScale(i)}
            y={height - padding.bottom + 18}
            fontSize={10}
            fill={textColor}
            opacity={0.6}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
}
