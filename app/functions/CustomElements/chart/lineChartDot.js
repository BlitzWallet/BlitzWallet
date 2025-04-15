import {Circle} from 'react-native-svg';
import {COLORS} from '../../../constants';

const LineChartDot = ({
  x,
  y,
  data,
  color = COLORS.primary,
  fill = COLORS.darkModeText,
}) => {
  return data.map((value, index) => (
    <Circle
      key={index}
      cx={x(index)}
      cy={y(value)}
      r={3}
      stroke={color}
      strokeWidth={1}
      fill={fill}
    />
  ));
};

export default LineChartDot;
