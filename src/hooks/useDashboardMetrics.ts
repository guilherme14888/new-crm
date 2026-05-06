import { useMemo } from 'react';
import { useDealStore } from '../stores/dealStore';
import { useContactStore } from '../stores/contactStore';

export function useDashboardMetrics() {
  const deals = useDealStore((s) => s.deals);
  const getMetrics = useDealStore((s) => s.metrics);
  const totalContacts = useContactStore((s) => s.contacts.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const metrics = useMemo(() => getMetrics(), [deals]);
  return { ...metrics, totalContacts };
}
