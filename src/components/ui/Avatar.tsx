import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

/** Renderiza um avatar circular: usa a imagem (uri) quando disponível ou as iniciais do nome com cor de fundo derivada do nome. */
export function Avatar({ name, uri, size = 36 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const bg = stringToColor(name);

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

/** Helper que gera deterministicamente uma cor da paleta a partir de uma string (hash do nome). */
function stringToColor(str: string): string {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: COLORS.white, fontWeight: '700' },
  image: { resizeMode: 'cover' },
});
