import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Contact } from '../../types/models';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  lead:     { bg: '#dbeafe', text: '#1d4ed8' },
  prospect: { bg: '#fef9c3', text: '#854d0e' },
  customer: { bg: '#dcfce7', text: '#15803d' },
  churned:  { bg: '#fee2e2', text: '#b91c1c' },
};

interface Props {
  contact: Contact;
  onPress: () => void;
}

export function ContactListItem({ contact, onPress }: Props) {
  const colors = TYPE_COLORS[contact.type] ?? TYPE_COLORS.lead;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar name={`${contact.firstName} ${contact.lastName}`} uri={contact.avatarUrl} size={40} />
      <View style={styles.info}>
        <Text style={styles.name}>{contact.firstName} {contact.lastName}</Text>
        {contact.company && <Text style={styles.sub}>{contact.company}</Text>}
      </View>
      <Badge label={contact.type} color={colors.bg} textColor={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    gap: SPACING.md,
  },
  pressed: { backgroundColor: COLORS.gray[50] },
  info: { flex: 1 },
  name: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[900] },
  sub: { fontSize: FONTS.sm, color: COLORS.gray[500], marginTop: 2 },
});
