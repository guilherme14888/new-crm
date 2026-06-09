import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { signUp } from '../../src/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { COLORS, FONTS, SPACING } from '../../src/constants/theme';

/** Tela de cadastro: renderiza o formulário de criação de conta (nome, e-mail, senha e confirmação) e registra um novo usuário. */
export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const { isLoading, error } = useAuthStore();

  // Valida a confirmação e o tamanho da senha, cria a conta e redireciona para o dashboard
  const handleRegister = async () => {
    setLocalError('');
    if (password !== confirm) { setLocalError('Passwords do not match'); return; }
    if (password.length < 8) { setLocalError('Password must be at least 8 characters'); return; }
    try {
      await signUp(email, password, name);
      router.replace('/(app)/(tabs)/dashboard');
    } catch {}
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create account</Text>
        {(localError || error) && (
          <Text style={styles.error}>{localError || error}</Text>
        )}
        <Input label="Full Name" value={name} onChangeText={setName} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Input label="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <Button label="Create Account" onPress={handleRegister} loading={isLoading} style={styles.btn} />
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: SPACING.xl, justifyContent: 'center', backgroundColor: COLORS.white },
  title: { fontSize: FONTS['3xl'], fontWeight: '700', color: COLORS.gray[900], textAlign: 'center', marginBottom: SPACING.xl },
  error: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.md, fontSize: FONTS.sm },
  btn: { marginTop: SPACING.sm, marginBottom: SPACING.lg },
  link: { textAlign: 'center', color: COLORS.gray[500], fontSize: FONTS.base },
  linkBold: { color: COLORS.primary, fontWeight: '600' },
});
