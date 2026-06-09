import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
}

/** Renderiza uma etiqueta (pill) arredondada com texto, cor de fundo e cor de texto configuráveis. */
export function Badge({ label, color = COLORS.gray[200], textColor = COLORS.gray[700] }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: FONTS.sm, fontWeight: '500' },
});
