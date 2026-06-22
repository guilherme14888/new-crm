import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/** Container visual em forma de cartão (fundo branco, cantos arredondados e sombra) que envolve os filhos. */
export function Card({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
});
