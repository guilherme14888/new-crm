import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

/** Campo de texto com rótulo opcional e exibição de mensagem de erro, repassando demais props ao TextInput. */
export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={COLORS.gray[400]}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.md },
  label: { fontSize: FONTS.sm, color: COLORS.gray[600], marginBottom: SPACING.xs, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.base,
    color: COLORS.gray[900],
    backgroundColor: COLORS.white,
    minHeight: 44,
  },
  inputError: { borderColor: COLORS.danger },
  error: { fontSize: FONTS.sm, color: COLORS.danger, marginTop: SPACING.xs },
});
