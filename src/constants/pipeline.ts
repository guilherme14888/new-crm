import { StageConfig } from '../types/models';

export const PIPELINE_STAGES: StageConfig[] = [
  { key: 'qualification', label: 'Qualification', color: '#94a3b8', defaultProbability: 10 },
  { key: 'discovery',     label: 'Discovery',     color: '#3b82f6', defaultProbability: 25 },
  { key: 'proposal',      label: 'Proposal',      color: '#f59e0b', defaultProbability: 50 },
  { key: 'negotiation',   label: 'Negotiation',   color: '#f97316', defaultProbability: 75 },
  { key: 'closed_won',    label: 'Won',           color: '#16a34a', defaultProbability: 100 },
  { key: 'closed_lost',   label: 'Lost',          color: '#ef4444', defaultProbability: 0 },
];

export const ACTIVE_STAGES = PIPELINE_STAGES.filter(
  (s) => s.key !== 'closed_won' && s.key !== 'closed_lost'
);

export const STAGE_MAP = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.key, s])
) as Record<string, StageConfig>;
