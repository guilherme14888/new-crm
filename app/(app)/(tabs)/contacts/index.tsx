import React, { useEffect } from 'react';
import { View, FlatList, Text, Pressable, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { useContacts } from '../../../../src/hooks/useContacts';
import { ContactListItem } from '../../../../src/components/contacts/ContactListItem';
import { ContactSearch } from '../../../../src/components/contacts/ContactSearch';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { COLORS, FONTS, SPACING } from '../../../../src/constants/theme';

/** Tela de listagem de contatos: exibe busca, skeleton de carregamento, estado vazio e a lista de contatos navegável. */
export default function ContactsScreen() {
  const { contacts, isLoading, searchQuery, loadContacts, setSearch } = useContacts();

  useEffect(() => { loadContacts(); }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Contacts', headerRight: () => (
        <Pressable onPress={() => router.push('/(app)/(tabs)/contacts/new')} style={{ marginRight: SPACING.md }}>
          <Text style={{ color: COLORS.primary, fontSize: FONTS.lg, fontWeight: '600' }}>+</Text>
        </Pressable>
      )}} />
      <View style={styles.screen}>
        <ContactSearch value={searchQuery} onChangeText={setSearch} />
        {isLoading ? (
          <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
            {[1,2,3,4,5].map((i) => <Skeleton key={i} height={56} />)}
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>{searchQuery ? 'No results' : 'No contacts yet'}</Text>
            <Text style={styles.emptyText}>{searchQuery ? 'Try a different search' : 'Tap + to add your first contact'}</Text>
          </View>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <ContactListItem
                contact={item}
                onPress={() => router.push(`/(app)/(tabs)/contacts/${item.id}`)}
              />
            )}
            getItemLayout={(_, index) => ({ length: 68, offset: 68 * index, index })}
            windowSize={10}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONTS.xl, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  emptyText: { fontSize: FONTS.base, color: COLORS.gray[400], textAlign: 'center' },
});
