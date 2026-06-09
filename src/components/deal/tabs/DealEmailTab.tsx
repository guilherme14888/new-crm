import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Contact } from '../../../types/models';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

interface Props { contact: Contact | undefined; }

/** Aba de e-mail da negociação: mostra o e-mail do contato e abre o cliente de e-mail; placeholder para integração futura. */
export function DealEmailTab({ contact }: Props) {
  const email = contact?.email;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✉️</Text>
      <Text style={styles.title}>Envio de E-mail</Text>
      {email ? (
        <>
          <Text style={styles.sub}>Órgão: <Text style={styles.email}>{email}</Text></Text>
          <Pressable style={styles.btn} onPress={() => Linking.openURL(`mailto:${email}`)}>
            <Text style={styles.btnText}>Abrir cliente de e-mail</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.sub}>Nenhum e-mail cadastrado para este órgão.</Text>
      )}
      <Text style={styles.hint}>Integração de e-mail direta será disponibilizada em breve.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48, marginBottom: SPACING.md },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[800], marginBottom: SPACING.sm },
  sub: { fontSize: FONTS.base, color: COLORS.gray[600], marginBottom: SPACING.md },
  email: { color: COLORS.primary, fontWeight: '600' },
  btn: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, marginBottom: SPACING.xl },
  btnText: { color: COLORS.white, fontSize: FONTS.base, fontWeight: '700' },
  hint: { fontSize: FONTS.sm, color: COLORS.gray[400], textAlign: 'center', maxWidth: 300 },
});
