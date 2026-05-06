import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Activity, ActivityType } from '../../types/models';
import { formatDateTime } from '../../utils/date';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const ICONS: Record<ActivityType, string> = {
  call: '📞',
  email: '✉️',
  meeting: '📅',
  note: '📝',
  stage_change: '🔄',
};

interface Props {
  activities: Activity[];
}

export function RecentActivityList({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      keyExtractor={(a) => a.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.icon}>{ICONS[item.type]}</Text>
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.time}>{formatDateTime(item.occurredAt)}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    gap: SPACING.sm,
  },
  icon: { fontSize: 18, width: 28, textAlign: 'center' },
  content: { flex: 1 },
  title: { fontSize: FONTS.base, color: COLORS.gray[800] },
  time: { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
  empty: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: FONTS.base, color: COLORS.gray[400] },
});
