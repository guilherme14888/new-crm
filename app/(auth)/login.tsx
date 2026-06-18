import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, TextInput, ScrollView, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { signIn } from '../../src/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');
const isWide = Platform.OS === 'web' && width >= 768;

/** Tela de login: renderiza o formulário de e-mail/senha (layout amplo com painel de marca na web ou layout mobile) e autentica o usuário. */
export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { isLoading, error }    = useAuthStore();

  // Faz login com e-mail/senha e, em caso de sucesso, redireciona para o dashboard
  const handleLogin = async () => {
    try {
      await signIn(email, password);
      router.replace('/(app)/(tabs)/dashboard');
    } catch {}
  };

  const form = (
    <View style={s.card}>
      {/* Logo mark */}
      <View style={s.logoWrap}>
        <View style={s.logoCircle}>
          <Text style={s.logoMark}>C</Text>
        </View>
        <Text style={s.logoText}>CRM</Text>
      </View>

      <Text style={s.heading}>Bem-vindo de volta</Text>
      <Text style={s.sub}>Entre na sua conta para continuar</Text>

      {error ? (
        error.toLowerCase().includes('cobrança em aberto') ? (
          <View style={s.blockBox}>
            <Text style={s.blockIcon}>⛔</Text>
            <Text style={s.blockTitle}>Cobrança em aberto</Text>
            <Text style={s.blockTxt}>{error}</Text>
          </View>
        ) : error.toLowerCase().includes('período de teste') ? (
          <View style={s.blockBox}>
            <Text style={s.blockIcon}>⛔</Text>
            <Text style={s.blockTitle}>Período de teste encerrado</Text>
            <Text style={s.blockTxt}>{error}</Text>
          </View>
        ) : (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>⚠  {error}</Text>
          </View>
        )
      ) : null}

      {/* Email */}
      <Text style={s.label}>E-mail</Text>
      <View style={s.inputWrap}>
        <Text style={s.inputIcon}>✉</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          placeholderTextColor={COLORS.gray[400]}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
      </View>

      {/* Password */}
      <Text style={s.label}>Senha</Text>
      <View style={s.inputWrap}>
        <Text style={s.inputIcon}>🔒</Text>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={COLORS.gray[400]}
          secureTextEntry={!showPass}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
        <Pressable onPress={() => setShowPass((v) => !v)} style={s.eyeBtn}>
          <Text style={s.eyeTxt}>{showPass ? '🙈' : '👁'}</Text>
        </Pressable>
      </View>

      {/* Submit */}
      <Pressable
        style={[s.btn, isLoading && s.btnDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={s.btnTxt}>{isLoading ? 'Entrando...' : 'Entrar'}</Text>
      </Pressable>

      {/* Register link */}
      <Pressable onPress={() => router.push('/(auth)/register')} style={s.registerRow}>
        <Text style={s.registerTxt}>Não tem uma conta? </Text>
        <Text style={s.registerLink}>Criar conta</Text>
      </Pressable>
    </View>
  );

  if (isWide) {
    // Wide layout: left branding panel + right form
    return (
      <View style={s.wideContainer}>
        {/* Left branding panel */}
        <View style={s.brandPanel}>
          <View style={s.brandContent}>
            <View style={s.brandLogoWrap}>
              <Text style={s.brandLogoMark}>C</Text>
            </View>
            <Text style={s.brandTitle}>CRM</Text>
            <Text style={s.brandTagline}>Gerencie seus leads e negociações com eficiência</Text>
            <View style={s.brandFeatures}>
              {['Pipeline de vendas visual', 'Histórico completo de atividades', 'Relatórios em tempo real', 'Gestão de equipes'].map((f) => (
                <View key={f} style={s.featureRow}>
                  <View style={s.featureDot} />
                  <Text style={s.featureTxt}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* Decorative circles */}
          <View style={[s.decCircle, { width: 300, height: 300, bottom: -80, right: -80, opacity: 0.07 }]} />
          <View style={[s.decCircle, { width: 180, height: 180, top: 60, right: 40, opacity: 0.06 }]} />
          <View style={[s.decCircle, { width: 100, height: 100, top: 180, left: 40, opacity: 0.05 }]} />
        </View>

        {/* Right form panel */}
        <View style={s.formPanel}>
          <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
            {form}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile layout
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.gray[50] }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.mobileScroll} keyboardShouldPersistTaps="handled">
        {/* Top gradient bar */}
        <View style={s.mobileTopBar} />
        {form}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  /* ── Wide layout ── */
  wideContainer: { flex: 1, flexDirection: 'row' },

  brandPanel: {
    width: 420, backgroundColor: COLORS.primary,
    justifyContent: 'center', overflow: 'hidden' as any,
  },
  brandContent: { padding: 56, zIndex: 1 },
  brandLogoWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  brandLogoMark: { fontSize: 36, fontWeight: '900', color: COLORS.white },
  brandTitle:   { fontSize: 40, fontWeight: '900', color: COLORS.white, marginBottom: 12 },
  brandTagline: { fontSize: FONTS.base, color: 'rgba(255,255,255,0.75)', marginBottom: 40, lineHeight: 24 },
  brandFeatures:{ gap: 14 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  featureTxt:   { color: 'rgba(255,255,255,0.85)', fontSize: FONTS.base },
  decCircle:    { position: 'absolute' as any, borderRadius: 9999, backgroundColor: COLORS.white },

  formPanel:  { flex: 1, backgroundColor: COLORS.gray[50] },
  formScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },

  /* ── Mobile layout ── */
  mobileScroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
  mobileTopBar: { width: '100%' as any, height: 6, backgroundColor: COLORS.primary, marginBottom: 0 },

  /* ── Card (shared) ── */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 36,
    width: '100%' as any,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginTop: Platform.OS === 'web' ? 0 : 32,
    marginHorizontal: 20,
  },

  logoWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoMark:   { fontSize: 22, fontWeight: '900', color: COLORS.white },
  logoText:   { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },

  heading: { fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.gray[900], marginBottom: 6 },
  sub:     { fontSize: FONTS.sm, color: COLORS.gray[500], marginBottom: 28 },

  errorBox: { backgroundColor: '#fef2f2', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: '#fecaca' },
  errorTxt: { color: '#dc2626', fontSize: FONTS.sm, fontWeight: '500' },

  blockBox: {
    backgroundColor: '#fef2f2', borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    borderWidth: 2, borderColor: '#dc2626', alignItems: 'center',
  },
  blockIcon:   { fontSize: 28, marginBottom: 6 },
  blockTitle:  { color: '#dc2626', fontSize: FONTS.lg, fontWeight: '800', marginBottom: 4 },
  blockTxt:    { color: '#b91c1c', fontSize: FONTS.sm, fontWeight: '600', textAlign: 'center' as any, lineHeight: 20 },

  label:     { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.gray[200],
    borderRadius: RADIUS.lg, backgroundColor: COLORS.gray[50],
    paddingHorizontal: SPACING.md, marginBottom: 20,
    height: 50,
  },
  inputIcon: { fontSize: 15, marginRight: 10, opacity: 0.5 },
  input:     { flex: 1, fontSize: FONTS.base, color: COLORS.gray[900], outlineStyle: 'none' } as any,
  eyeBtn:    { padding: 4 },
  eyeTxt:    { fontSize: 16 },

  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginBottom: 20,
    shadowColor: COLORS.primary, shadowOpacity: 0.35,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btnDisabled: { opacity: 0.65 },
  btnTxt:      { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base, letterSpacing: 0.3 },

  registerRow: { flexDirection: 'row', justifyContent: 'center' },
  registerTxt: { color: COLORS.gray[500], fontSize: FONTS.sm },
  registerLink:{ color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sm },
});
