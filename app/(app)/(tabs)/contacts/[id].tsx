import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContactStore } from '../../../../src/stores/contactStore';
import { useActivityStore } from '../../../../src/stores/activityStore';
import { useDealStore } from '../../../../src/stores/dealStore';
import { useUIStore } from '../../../../src/stores/uiStore';
import { ContactForm } from '../../../../src/components/contacts/ContactForm';
import { RecentActivityList } from '../../../../src/components/dashboard/RecentActivityList';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { Avatar } from '../../../../src/components/ui/Avatar';
import { Button } from '../../../../src/components/ui/Button';
import { formatCurrency } from '../../../../src/utils/currency';
import { Contact, Activity } from '../../../../src/types/models';
import { COLORS, FONTS, SPACING } from '../../../../src/constants/theme';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contacts = useContactStore((s) => s.contacts);
  const updateContact = useContactStore((s) => s.updateContact);
  const deleteContact = useContactStore((s) => s.deleteContact);
  const deals = useDealStore((s) => s.deals).filter((d) => d.contactId === id && !d.deletedAt);
  const { getByContact } = useActivityStore();
  const openDeal = useUIStore((s) => s.openDeal);
  const [editing, setEditing] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);

  const contact = contacts.find((c) => c.id === id);

  useEffect(() => {
    if (id) getByContact(id).then(setActivities);
  }, [id]);

  if (!contact) return null;

  const handleUpdate = async (data: Omit<Contact, 'id'|'createdAt'|'updatedAt'|'syncStatus'|'deletedAt'|'avatarUrl'|'tags'>) => {
    await updateContact(id!, data);
    setEditing(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Contact', `Delete ${contact.firstName} ${contact.lastName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteContact(id!);
        router.back();
      }},
    ]);
  };

  if (editing) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit Contact', headerRight: () => (
          <Pressable onPress={() => setEditing(false)} style={{ marginRight: SPACING.md }}>
            <Text style={{ color: COLORS.gray[500] }}>Cancel</Text>
          </Pressable>
        )}} />
        <ContactForm initial={contact} onSubmit={handleUpdate} submitLabel="Save Changes" />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${contact.firstName} ${contact.lastName}`, headerRight: () => (
        <Pressable onPress={() => setEditing(true)} style={{ marginRight: SPACING.md }}>
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      )}} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar name={`${contact.firstName} ${contact.lastName}`} uri={contact.avatarUrl} size={64} />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{contact.firstName} {contact.lastName}</Text>
            {contact.company && <Text style={styles.company}>{contact.company}</Text>}
            <Badge label={contact.type} />
          </View>
        </View>
        {deals.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Deals ({deals.length})</Text>
            {deals.map((d) => (
              <Pressable key={d.id} onPress={() => openDeal(d.id)} style={styles.dealRow}>
                <Text style={styles.dealTitle} numberOfLines={1}>{d.title}</Text>
                <Text style={styles.dealValue}>{formatCurrency(d.value)}</Text>
              </Pressable>
            ))}
          </Card>
        )}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <RecentActivityList activities={activities.slice(0, 10)} />
        </Card>
        <Button label="Delete Contact" onPress={handleDelete} variant="danger" style={{ marginTop: SPACING.md }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  content: { padding: SPACING.lg, paddingBottom: SPACING['2xl'] },
  header: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg, alignItems: 'center' },
  headerInfo: { flex: 1, gap: SPACING.xs },
  name: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.gray[900] },
  company: { fontSize: FONTS.base, color: COLORS.gray[500] },
  card: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.gray[800], marginBottom: SPACING.md },
  dealRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  dealTitle: { flex: 1, fontSize: FONTS.base, color: COLORS.gray[800] },
  dealValue: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.primary },
});
