import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Contact, ContactType } from '../../types/models';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SPACING } from '../../constants/theme';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  notes: string;
  type: ContactType;
};

interface Props {
  initial?: Partial<Contact>;
  onSubmit: (data: FormData) => Promise<void>;
  submitLabel?: string;
}

function validate(data: FormData): Partial<Record<keyof FormData, string>> {
  const errors: Partial<Record<keyof FormData, string>> = {};
  if (!data.firstName.trim()) errors.firstName = 'First name is required';
  if (!data.lastName.trim()) errors.lastName = 'Last name is required';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address';
  }
  return errors;
}

export function ContactForm({ initial, onSubmit, submitLabel = 'Save' }: Props) {
  const [form, setForm] = useState<FormData>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    company: initial?.company ?? '',
    jobTitle: initial?.jobTitle ?? '',
    notes: initial?.notes ?? '',
    type: initial?.type ?? 'lead',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try { await onSubmit(form); } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Input label="First Name *" value={form.firstName} onChangeText={set('firstName')} error={errors.firstName} />
      <Input label="Last Name *" value={form.lastName} onChangeText={set('lastName')} error={errors.lastName} />
      <Input label="Email" value={form.email} onChangeText={set('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Input label="Company" value={form.company} onChangeText={set('company')} />
      <Input label="Job Title" value={form.jobTitle} onChangeText={set('jobTitle')} />
      <Input label="Notes" value={form.notes} onChangeText={set('notes')} multiline numberOfLines={3} />
      <Button label={submitLabel} onPress={handleSubmit} loading={loading} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingBottom: SPACING['2xl'] },
  submit: { marginTop: SPACING.md },
});
