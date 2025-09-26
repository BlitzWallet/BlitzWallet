import Svg, {G, Line, Path, Text as SvgText, Circle} from 'react-native-svg';
import * as d3 from 'd3-shape';
import * as scale from 'd3-scale';

export default function CustomLineChart({
  data,
  width,
  height,
  min,
  max,
  xLabels,
  strokeColor,
  textColor,
  leftPadding = 30,
}) {
  const padding = {top: 10, bottom: 30, left: leftPadding, right: 20};

  // Scales
  const xScale = scale
    .scaleLinear()
    .domain([0, data.length - 1])
    .range([padding.left, width - padding.right]);

  const yScale = scale
    .scaleLinear()
    .domain([min, max])
    .range([height - padding.bottom, padding.top]);

  // Line generator
  const lineGenerator = d3
    .line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d))
    .curve(d3.curveMonotoneX);

  const linePath = lineGenerator(data) || '';
  const yTicks = yScale.ticks(7);

  return (
    <Svg width={width} height={height}>
      <G>
        {/* Y grid lines + labels */}
        {yTicks.map((tick, i) => (
          <G key={`y-${i}`}>
            <Line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#ccc"
              strokeDasharray="4"
            />
            <SvgText
              x={padding.left - 5}
              y={yScale(tick) + 4}
              fontSize={10}
              fill={textColor}
              textAnchor="end">
              {tick}
            </SvgText>
          </G>
        ))}

        {/* X labels */}
        {xLabels.map((label, i) => (
          <SvgText
            key={`x-${i}`}
            x={xScale(i)}
            y={height - padding.bottom + 15}
            fontSize={10}
            fill={textColor}
            textAnchor="middle">
            {label}
          </SvgText>
        ))}

        {/* Data line */}
        <Path d={linePath} fill="none" stroke={strokeColor} strokeWidth={3} />

        {/* Data dots */}
        {data.map((d, i) => (
          <Circle
            key={`dot-${i}`}
            cx={xScale(i)}
            cy={yScale(d)}
            r={4}
            fill={strokeColor}
          />
        ))}
      </G>
    </Svg>
  );
}
