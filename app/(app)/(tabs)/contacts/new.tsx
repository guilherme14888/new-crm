import React from 'react';
import { router, Stack } from 'expo-router';
import { useContactStore } from '../../../../src/stores/contactStore';
import { ContactForm } from '../../../../src/components/contacts/ContactForm';

export default function NewContactScreen() {
  const createContact = useContactStore((s) => s.createContact);

  const handleSubmit = async (data: {
    firstName: string; lastName: string; email: string; phone: string;
    company: string; jobTitle: string; notes: string; type: import('../../../../src/types/models').ContactType;
  }) => {
    await createContact({
      ...data,
      avatarUrl: null,
      tags: [],
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'New Contact' }} />
      <ContactForm onSubmit={handleSubmit} submitLabel="Create Contact" />
    </>
  );
}
