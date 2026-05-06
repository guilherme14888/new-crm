import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function MetricCard({ label, value, sub, accent = COLORS.primary }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: SPACING.xs },
  label: { fontSize: FONTS.sm, color: COLORS.gray[500], marginBottom: SPACING.xs },
  value: { fontSize: FONTS['2xl'], fontWeight: '700' },
  sub: { fontSize: FONTS.sm, color: COLORS.gray[400], marginTop: 2 },
});
