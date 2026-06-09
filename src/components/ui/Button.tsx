import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, FONTS } from '../../constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Botão pressionável com variantes (primary/secondary/danger/ghost), estados de loading e disabled, exibindo spinner ou rótulo. */
export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const bg = {
    primary: COLORS.primary,
    secondary: COLORS.gray[200],
    danger: COLORS.danger,
    ghost: 'transparent',
  }[variant];

  const textColor = variant === 'secondary' ? COLORS.gray[800] : variant === 'ghost' ? COLORS.primary : COLORS.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.7 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  label: {
    fontSize: FONTS.base,
    fontWeight: '600',
  },
});
