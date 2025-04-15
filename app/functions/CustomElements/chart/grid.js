import React from 'react';
import PropTypes from 'prop-types';
import {G, Line} from 'react-native-svg';
import {COLORS} from '../../../constants';

const Horizontal = ({ticks = [], y, svg = {}, fill = COLORS.opaicityGray}) => {
  return (
    <G>
      {ticks.map(tick => (
        <Line
          key={tick}
          x1={'0%'}
          x2={'100%'}
          y1={y(tick)}
          y2={y(tick)}
          strokeWidth={1}
          stroke={fill}
          {...svg}
        />
      ))}
    </G>
  );
};

const Vertical = ({ticks = [], x, svg = {}, fill = COLORS.opaicityGray}) => {
  return (
    <G>
      {ticks.map((tick, index) => (
        <Line
          key={index}
          y1={'0%'}
          y2={'100%'}
          x1={x(tick)}
          x2={x(tick)}
          strokeWidth={1}
          stroke={fill}
          {...svg}
        />
      ))}
    </G>
  );
};

const Both = props => {
  return (
    <G>
      <Horizontal {...props} />
      <Vertical {...props} />
    </G>
  );
};

Vertical.propTypes = {
  x: PropTypes.func,
  ticks: PropTypes.array,
  svg: PropTypes.object,
};

Horizontal.propTypes = {
  y: PropTypes.func,
  ticks: PropTypes.array,
  svg: PropTypes.object,
};

Both.propTypes = {
  ...Vertical.propTypes,
  ...Horizontal.propTypes,
};

const Direction = {
  VERTICAL: 'VERTICAL',
  HORIZONTAL: 'HORIZONTAL',
  BOTH: 'BOTH',
};

const Grid = ({
  direction = Direction.HORIZONTAL,
  belowChart = true,
  ...props
}) => {
  if (direction === Direction.VERTICAL) {
    return <Vertical {...props} />;
  } else if (direction === Direction.HORIZONTAL) {
    return <Horizontal {...props} />;
  } else if (direction === Direction.BOTH) {
    return <Both {...props} />;
  }

  return null;
};

Grid.Direction = Direction;

Grid.propTypes = {
  direction: PropTypes.oneOf(Object.values(Direction)),
  belowChart: PropTypes.bool,
  svg: PropTypes.object,
};

export default Grid;
