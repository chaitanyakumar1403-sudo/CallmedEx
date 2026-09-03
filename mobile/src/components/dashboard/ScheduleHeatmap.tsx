import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_BLOCKS = [
  { label: 'Morning (08:00 - 12:00)', key: 'morning' },
  { label: 'Afternoon (12:00 - 16:00)', key: 'afternoon' },
  { label: 'Evening (16:00 - 20:00)', key: 'evening' },
];

interface ScheduleHeatmapProps {
  scheduleData?: Record<string, boolean[]>; // dayIndex -> [morningActive, afternoonActive, eveningActive]
  onSlotClick?: (dayIndex: number, timeBlockIndex: number) => void;
}

export const ScheduleHeatmap: React.FC<ScheduleHeatmapProps> = ({
  scheduleData = {
    '0': [true, true, true],
    '1': [true, true, true],
    '2': [true, false, true],
    '3': [true, true, true],
    '4': [true, true, false],
    '5': [true, false, false],
    '6': [false, false, false],
  },
  onSlotClick,
}) => {
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📅</Text>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          7-Day Clinical Schedule Heatmap
        </Text>
      </View>

      {/* Heatmap Grid */}
      <View style={styles.grid}>
        {/* Days Header */}
        <View style={styles.daysRow}>
          <View style={styles.blockLabelCol} />
          {DAYS.map((d, idx) => (
            <View key={idx} style={styles.dayCol}>
              <Text style={[styles.dayText, { color: themeColors.textSecondary }]}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Time Blocks Rows */}
        {TIME_BLOCKS.map((block, blockIdx) => (
          <View key={block.key} style={styles.row}>
            <View style={styles.blockLabelCol}>
              <Text style={[styles.blockLabelText, { color: themeColors.textSecondary }]}>
                {block.label.split(' ')[0]}
              </Text>
            </View>

            {DAYS.map((_, dayIdx) => {
              const isActive = scheduleData[String(dayIdx)]?.[blockIdx] ?? false;

              return (
                <TouchableOpacity
                  key={dayIdx}
                  activeOpacity={0.7}
                  onPress={() => onSlotClick && onSlotClick(dayIdx, blockIdx)}
                  style={[
                    styles.slotCell,
                    {
                      backgroundColor: isActive ? '#0284c7' : (themeColors.surface2 || '#f1f5f9'),
                      borderColor: isActive ? '#0369a1' : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.cellText, { color: isActive ? '#ffffff' : themeColors.textMuted }]}>
                    {isActive ? '✓' : '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284c7' }]} />
          <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Active Slot</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#e2e8f0' }]} />
          <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Unavailable</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  grid: {
    marginVertical: spacing.xs,
  },
  daysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  blockLabelCol: {
    width: 60,
    justifyContent: 'center',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
  },
  dayText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  blockLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  slotCell: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  cellText: {
    fontSize: 10,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: typography.fontSize.tiny,
  },
});
