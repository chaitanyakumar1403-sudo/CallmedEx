// mobile/src/components/widgets/kit/TrendSpark.tsx
// Micro-sparkline trend chart for longitudinal biomarker visualization.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.5

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

export interface TrendSparkProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  showEndDot?: boolean;
}

export const TrendSpark: React.FC<TrendSparkProps> = ({
  data,
  width = 120,
  height = 36,
  strokeColor = '#38bdf8',
  strokeWidth = 2,
  showEndDot = true,
}) => {
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 8) + 4;
      const y = height - ((val - minVal) / range) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(' ');

  const lastPoint = points.split(' ').pop()?.split(',') || ['0', '0'];
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showEndDot && (
          <Circle
            cx={lastX}
            cy={lastY}
            r={3.5}
            fill={strokeColor}
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
