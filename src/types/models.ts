// ─── Base enums ───────────────────────────────────────────────────────────────
export type ContactType = 'lead' | 'prospect' | 'customer' | 'churned';
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'stage_change';
export type SyncStatus = 'synced' | 'pending_push' | 'conflict';
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'consultant' | 'agent';

/** Stage outcome type — drives win/loss/active business logic */
export type StageType = 'active' | 'won' | 'lost';

// Legacy DealStage kept for backward compatibility with existing data
export type DealStage =
  | 'qualification'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

// ─── Funnel / Stage models ─────────────────────────────────────────────────────
export interface FunnelStage {
  id: string;
  funnelId: string;
  name: string;
  color: string;
  order: number;
  probability: number;   // 0–100
  type: StageType;       // determines win/loss/active
  rottenDays: number | null; // days before deal is marked "rotten"
  createdAt: string;
  updatedAt: string;
}

export interface Funnel {
  id: string;
  name: string;
  companyId?: string | null;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  stages: FunnelStage[];
  createdAt: string;
  updatedAt: string;
}

// ─── Opportunity rules ─────────────────────────────────────────────────────────
export type RuleTrigger = 'stage_enter' | 'stage_time' | 'deal_value' | 'inactivity' | 'close_date_passed';
export type RuleAction  = 'move_stage' | 'notify' | 'close_won' | 'close_lost' | 'assign_user' | 'add_activity';

export interface OpportunityRule {
  id: string;
  funnelId: string;
  name: string;
  trigger: RuleTrigger;
  triggerConfig: Record<string, unknown>;  // e.g. { stageId, days }
  action: RuleAction;
  actionConfig: Record<string, unknown>;   // e.g. { targetStageId, userId }
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Win / loss reasons ────────────────────────────────────────────────────────
export interface WinLossReason {
  id: string;
  type: 'won' | 'lost';
  label: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Core CRM models ───────────────────────────────────────────────────────────
export interface Contact {
  id: string;
  type: ContactType;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt: string | null;
}

export interface Deal {
  id: string;
  funnelId: string;
  stageId: string;
  stage: DealStage;
  contactId: string;
  ownerId: string | null;
  title: string;
  value: number;
  currency: string;
  stageOrder: number;
  probability: number;
  expectedCloseDate: string | null;
  closingReason: string | null;
  notes: string | null;
  produto?: string | null;     // produto(s) da oportunidade (extraído das notes)
  stageChangedAt: string | null;
  locked?: boolean;            // oportunidade bloqueada até "Participar"
  miControle?: string | null;  // licitação de origem (pncp_controle)
  companyId?: string;
  companyName?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt: string | null;
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────
export type TaskType = 'to_do' | 'call' | 'email' | 'meeting' | 'visit';

export interface Task {
  id: string;
  dealId: string;
  assignedTo: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Custom Fields ─────────────────────────────────────────────────────────────
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect';

export interface CustomField {
  id: string;
  entityType: string;
  name: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  fieldOrder: number;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealCustomValue {
  id: string;
  dealId: string;
  fieldId: string;
  value: string | null;
}

// ─── Products ──────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealProduct {
  id: string;
  dealId: string;
  productId: string;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  createdAt: string;
}

// ─── Files ─────────────────────────────────────────────────────────────────────
export interface DealFile {
  id: string;
  dealId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

// ─── App Settings ──────────────────────────────────────────────────────────────
export interface CoolingThresholds {
  warningDays: number;
  dangerDays: number;
}

export interface Activity {
  id: string;
  dealId: string | null;
  contactId: string;
  type: ActivityType;
  title: string;
  description: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  syncStatus: SyncStatus;
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  aclProfileId: string | null;
  companyId: string;
  companyName: string | null;
  isMasterCompany?: boolean;          // empresa ativa é a Default/master
  isDefaultTenantUser?: boolean;      // usuário foi criado na tenant Default (home) — habilita troca de empresa
  canMiningHistory?: boolean;         // pode ver o Histórico de Mineração (operador Default ou grant ACL)
  companyLogo?: string | null;        // logo da empresa ativa (url ou data URL)
  masterLogo?: string | null;         // logo da Default (miniatura sobreposta nas filhas)
  teamId: string | null;
  // Período de teste do tenant ativo (preenchido por /auth/me e login)
  onTrial?: boolean;
  trialDaysLeft?: number | null;
  trialEndsAt?: string | null;
  // Permissões do perfil ACL (null = sem restrição / admin). Usado p/ filtrar menus.
  permissions?: Record<string, boolean> | null;
}

export interface CRMUser extends User {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  // companyId and teamId are inherited from User
}

// ─── Metrics ───────────────────────────────────────────────────────────────────
export interface DashboardMetrics {
  totalLeads: number;
  totalDeals: number;
  totalPipelineValue: number;
  wonThisMonth: number;
  lostThisMonth: number;
  conversionRate: number;
  dealsByStage: Record<string, { count: number; value: number }>;
}

/** Legacy static stage config (still used for seeded default funnel) */
export interface StageConfig {
  key: DealStage;
  label: string;
  color: string;
  defaultProbability: number;
}
