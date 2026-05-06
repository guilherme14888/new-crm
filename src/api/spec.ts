/**
 * CRM Mobile — REST API Specification
 *
 * Base URL: /api/v1
 * Auth: Bearer token (JWT) in Authorization header
 * Content-Type: application/json
 * Pagination: ?page=1&limit=20 (default limit=20, max=100)
 * Errors: { error: string, code: string, details?: object }
 *
 * HTTP Status Codes:
 *   200 OK           – success with body
 *   201 Created      – resource created
 *   204 No Content   – success, no body
 *   400 Bad Request  – validation error
 *   401 Unauthorized – missing/invalid token
 *   403 Forbidden    – insufficient role
 *   404 Not Found    – resource not found
 *   409 Conflict     – duplicate / constraint violation
 *   422 Unprocessable– business rule violation
 *   500 Server Error – unexpected error
 */

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const AUTH_ENDPOINTS = {
  /**
   * POST /auth/login
   * Body: { email: string, password: string }
   * Response: { accessToken: string, refreshToken: string, user: User }
   */
  LOGIN: 'POST /api/v1/auth/login',

  /**
   * POST /auth/register
   * Body: { email: string, password: string, displayName: string }
   * Response: { accessToken: string, refreshToken: string, user: User }
   */
  REGISTER: 'POST /api/v1/auth/register',

  /**
   * POST /auth/logout
   * Auth: required
   * Response: 204
   */
  LOGOUT: 'POST /api/v1/auth/logout',

  /**
   * POST /auth/refresh
   * Body: { refreshToken: string }
   * Response: { accessToken: string, refreshToken: string }
   */
  REFRESH: 'POST /api/v1/auth/refresh',

  /**
   * POST /auth/forgot-password
   * Body: { email: string }
   * Response: 204
   */
  FORGOT_PASSWORD: 'POST /api/v1/auth/forgot-password',

  /**
   * POST /auth/reset-password
   * Body: { token: string, password: string }
   * Response: 204
   */
  RESET_PASSWORD: 'POST /api/v1/auth/reset-password',

  /**
   * GET /auth/me
   * Auth: required
   * Response: User
   */
  ME: 'GET /api/v1/auth/me',
} as const;

// ─── Users (Admin only) ────────────────────────────────────────────────────────
export const USER_ENDPOINTS = {
  /**
   * GET /users
   * Auth: admin
   * Query: ?page, ?limit, ?search, ?role, ?isActive
   * Response: { data: CRMUser[], total: number, page: number, limit: number }
   */
  LIST: 'GET /api/v1/users',

  /**
   * GET /users/:id
   * Auth: admin | self
   * Response: CRMUser
   */
  GET: 'GET /api/v1/users/:id',

  /**
   * POST /users
   * Auth: admin
   * Body: { email, displayName, role, password?, avatarUrl? }
   * Response: CRMUser  (201)
   */
  CREATE: 'POST /api/v1/users',

  /**
   * PATCH /users/:id
   * Auth: admin | self (limited fields)
   * Body: { displayName?, role?, isActive?, avatarUrl? }
   * Response: CRMUser
   */
  UPDATE: 'PATCH /api/v1/users/:id',

  /**
   * DELETE /users/:id
   * Auth: admin
   * Response: 204
   */
  DELETE: 'DELETE /api/v1/users/:id',

  /**
   * POST /users/:id/reset-password
   * Auth: admin
   * Response: 204
   */
  RESET_PASSWORD: 'POST /api/v1/users/:id/reset-password',
} as const;

// ─── Funnels ───────────────────────────────────────────────────────────────────
export const FUNNEL_ENDPOINTS = {
  /**
   * GET /funnels
   * Auth: required
   * Response: { data: Funnel[] }
   */
  LIST: 'GET /api/v1/funnels',

  /**
   * GET /funnels/:id
   * Auth: required
   * Response: Funnel (with stages)
   */
  GET: 'GET /api/v1/funnels/:id',

  /**
   * POST /funnels
   * Auth: admin | manager
   * Body: { name, description? }
   * Response: Funnel (201)
   */
  CREATE: 'POST /api/v1/funnels',

  /**
   * PATCH /funnels/:id
   * Auth: admin | manager
   * Body: { name?, description?, isActive? }
   * Response: Funnel
   */
  UPDATE: 'PATCH /api/v1/funnels/:id',

  /**
   * DELETE /funnels/:id
   * Auth: admin
   * Response: 204
   * Note: Cannot delete default funnel; moves deals to default funnel
   */
  DELETE: 'DELETE /api/v1/funnels/:id',

  /**
   * POST /funnels/:id/set-default
   * Auth: admin
   * Response: Funnel
   */
  SET_DEFAULT: 'POST /api/v1/funnels/:id/set-default',

  // ── Stages ──
  /**
   * GET /funnels/:id/stages
   * Response: { data: FunnelStage[] }
   */
  LIST_STAGES: 'GET /api/v1/funnels/:id/stages',

  /**
   * POST /funnels/:id/stages
   * Body: { name, color, probability, type, rottenDays? }
   * Response: FunnelStage (201)
   */
  CREATE_STAGE: 'POST /api/v1/funnels/:id/stages',

  /**
   * PATCH /funnels/:id/stages/:stageId
   * Body: { name?, color?, probability?, type?, rottenDays? }
   * Response: FunnelStage
   */
  UPDATE_STAGE: 'PATCH /api/v1/funnels/:id/stages/:stageId',

  /**
   * DELETE /funnels/:id/stages/:stageId
   * Auth: admin | manager
   * Response: 204
   * Note: Fails if deals exist in stage (422); or pass ?moveTo=stageId
   */
  DELETE_STAGE: 'DELETE /api/v1/funnels/:id/stages/:stageId',

  /**
   * PUT /funnels/:id/stages/reorder
   * Body: { orderedIds: string[] }
   * Response: { data: FunnelStage[] }
   */
  REORDER_STAGES: 'PUT /api/v1/funnels/:id/stages/reorder',

  // ── Rules ──
  /**
   * GET /funnels/:id/rules
   * Response: { data: OpportunityRule[] }
   */
  LIST_RULES: 'GET /api/v1/funnels/:id/rules',

  /**
   * POST /funnels/:id/rules
   * Body: { name, trigger, triggerConfig, action, actionConfig, isActive? }
   * Response: OpportunityRule (201)
   */
  CREATE_RULE: 'POST /api/v1/funnels/:id/rules',

  /**
   * PATCH /funnels/:id/rules/:ruleId
   * Body: { name?, trigger?, triggerConfig?, action?, actionConfig?, isActive? }
   * Response: OpportunityRule
   */
  UPDATE_RULE: 'PATCH /api/v1/funnels/:id/rules/:ruleId',

  /**
   * DELETE /funnels/:id/rules/:ruleId
   * Response: 204
   */
  DELETE_RULE: 'DELETE /api/v1/funnels/:id/rules/:ruleId',
} as const;

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const CONTACT_ENDPOINTS = {
  /**
   * GET /contacts
   * Query: ?page, ?limit, ?search, ?type, ?tag
   * Response: { data: Contact[], total: number, page: number, limit: number }
   */
  LIST: 'GET /api/v1/contacts',

  /**
   * GET /contacts/:id
   * Response: Contact
   */
  GET: 'GET /api/v1/contacts/:id',

  /**
   * POST /contacts
   * Body: { firstName, lastName, email?, phone?, company?, jobTitle?, type?, tags?, notes? }
   * Response: Contact (201)
   */
  CREATE: 'POST /api/v1/contacts',

  /**
   * PATCH /contacts/:id
   * Body: Partial<Contact fields>
   * Response: Contact
   */
  UPDATE: 'PATCH /api/v1/contacts/:id',

  /**
   * DELETE /contacts/:id
   * Response: 204  (soft delete)
   */
  DELETE: 'DELETE /api/v1/contacts/:id',

  /**
   * GET /contacts/:id/deals
   * Response: { data: Deal[] }
   */
  LIST_DEALS: 'GET /api/v1/contacts/:id/deals',

  /**
   * GET /contacts/:id/activities
   * Query: ?limit
   * Response: { data: Activity[] }
   */
  LIST_ACTIVITIES: 'GET /api/v1/contacts/:id/activities',

  /**
   * POST /contacts/import
   * Body: multipart/form-data  { file: CSV }
   * Response: { imported: number, skipped: number, errors: string[] }
   */
  IMPORT: 'POST /api/v1/contacts/import',

  /**
   * GET /contacts/export
   * Query: ?format=csv|xlsx
   * Response: file download
   */
  EXPORT: 'GET /api/v1/contacts/export',
} as const;

// ─── Deals ────────────────────────────────────────────────────────────────────
export const DEAL_ENDPOINTS = {
  /**
   * GET /deals
   * Query: ?page, ?limit, ?funnelId, ?stageId, ?contactId, ?ownerId,
   *        ?search, ?minValue, ?maxValue, ?closingDateFrom, ?closingDateTo
   * Response: { data: Deal[], total, page, limit }
   */
  LIST: 'GET /api/v1/deals',

  /**
   * GET /deals/:id
   * Response: Deal
   */
  GET: 'GET /api/v1/deals/:id',

  /**
   * POST /deals
   * Body: { funnelId, stageId, contactId, title, value, currency?,
   *         probability?, expectedCloseDate?, notes?, ownerId? }
   * Response: Deal (201)
   */
  CREATE: 'POST /api/v1/deals',

  /**
   * PATCH /deals/:id
   * Body: Partial<Deal fields>
   * Response: Deal
   */
  UPDATE: 'PATCH /api/v1/deals/:id',

  /**
   * DELETE /deals/:id
   * Response: 204  (soft delete)
   */
  DELETE: 'DELETE /api/v1/deals/:id',

  /**
   * POST /deals/:id/move
   * Body: { stageId: string, order?: number }
   * Response: Deal
   * Side-effect: creates stage_change Activity
   */
  MOVE: 'POST /api/v1/deals/:id/move',

  /**
   * POST /deals/:id/close-won
   * Body: { reason?: string, closingDate?: string }
   * Response: Deal
   * Side-effect: moves to won stage, creates activity
   */
  CLOSE_WON: 'POST /api/v1/deals/:id/close-won',

  /**
   * POST /deals/:id/close-lost
   * Body: { reason: string, closingDate?: string }
   * Response: Deal
   * Side-effect: moves to lost stage, creates activity
   */
  CLOSE_LOST: 'POST /api/v1/deals/:id/close-lost',

  /**
   * POST /deals/:id/reopen
   * Body: { stageId: string }
   * Response: Deal
   */
  REOPEN: 'POST /api/v1/deals/:id/reopen',

  /**
   * GET /deals/:id/activities
   * Response: { data: Activity[] }
   */
  LIST_ACTIVITIES: 'GET /api/v1/deals/:id/activities',
} as const;

// ─── Activities ───────────────────────────────────────────────────────────────
export const ACTIVITY_ENDPOINTS = {
  /**
   * GET /activities
   * Query: ?page, ?limit, ?contactId, ?dealId, ?type, ?from, ?to
   * Response: { data: Activity[], total, page, limit }
   */
  LIST: 'GET /api/v1/activities',

  /**
   * GET /activities/:id
   * Response: Activity
   */
  GET: 'GET /api/v1/activities/:id',

  /**
   * POST /activities
   * Body: { contactId, dealId?, type, title, description?, occurredAt, metadata? }
   * Response: Activity (201)
   */
  CREATE: 'POST /api/v1/activities',

  /**
   * PATCH /activities/:id
   * Body: Partial<Activity fields>
   * Response: Activity
   */
  UPDATE: 'PATCH /api/v1/activities/:id',

  /**
   * DELETE /activities/:id
   * Response: 204
   */
  DELETE: 'DELETE /api/v1/activities/:id',
} as const;

// ─── Reports / Analytics ──────────────────────────────────────────────────────
export const REPORT_ENDPOINTS = {
  /**
   * GET /reports/dashboard
   * Query: ?funnelId, ?from, ?to, ?ownerId
   * Response: DashboardMetrics
   */
  DASHBOARD: 'GET /api/v1/reports/dashboard',

  /**
   * GET /reports/pipeline
   * Query: ?funnelId, ?from, ?to
   * Response: { stages: { stageId, stageName, count, value, avgDays }[] }
   */
  PIPELINE: 'GET /api/v1/reports/pipeline',

  /**
   * GET /reports/conversion
   * Query: ?funnelId, ?from, ?to, ?groupBy=week|month
   * Response: { periods: { period, won, lost, conversionRate }[] }
   */
  CONVERSION: 'GET /api/v1/reports/conversion',

  /**
   * GET /reports/activities
   * Query: ?from, ?to, ?ownerId, ?type
   * Response: { byType: { type, count }[], byUser: { userId, displayName, count }[] }
   */
  ACTIVITIES: 'GET /api/v1/reports/activities',

  /**
   * GET /reports/velocity
   * Query: ?funnelId, ?from, ?to
   * Response: { avgDaysToClose, avgDaysPerStage: { stageId, avgDays }[] }
   */
  VELOCITY: 'GET /api/v1/reports/velocity',

  /**
   * GET /reports/win-loss
   * Query: ?funnelId, ?from, ?to
   * Response: { won: { reason, count }[], lost: { reason, count }[] }
   */
  WIN_LOSS: 'GET /api/v1/reports/win-loss',
} as const;

// ─── Win/Loss Reasons ─────────────────────────────────────────────────────────
export const WIN_LOSS_ENDPOINTS = {
  /**
   * GET /win-loss-reasons
   * Query: ?type=won|lost
   * Response: { data: WinLossReason[] }
   */
  LIST: 'GET /api/v1/win-loss-reasons',

  /**
   * POST /win-loss-reasons
   * Auth: admin | manager
   * Body: { type, label }
   * Response: WinLossReason (201)
   */
  CREATE: 'POST /api/v1/win-loss-reasons',

  /**
   * DELETE /win-loss-reasons/:id
   * Auth: admin
   * Response: 204
   */
  DELETE: 'DELETE /api/v1/win-loss-reasons/:id',
} as const;

// ─── Sync (offline-first mobile) ──────────────────────────────────────────────
export const SYNC_ENDPOINTS = {
  /**
   * POST /sync/pull
   * Body: { tables: string[], lastPulledAt: Record<string, string> }
   * Response: { contacts: Contact[], deals: Deal[], activities: Activity[], timestamp: string }
   */
  PULL: 'POST /api/v1/sync/pull',

  /**
   * POST /sync/push
   * Body: { contacts?: Contact[], deals?: Deal[], activities?: Activity[] }
   * Response: { synced: number, conflicts: { id, table, serverVersion }[] }
   */
  PUSH: 'POST /api/v1/sync/push',
} as const;

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const WEBHOOK_ENDPOINTS = {
  /**
   * GET /webhooks
   * Auth: admin
   * Response: { data: Webhook[] }
   */
  LIST: 'GET /api/v1/webhooks',

  /**
   * POST /webhooks
   * Auth: admin
   * Body: { url, events: WebhookEvent[], secret? }
   * Response: Webhook (201)
   *
   * Events: deal.created | deal.updated | deal.moved | deal.won | deal.lost
   *         contact.created | contact.updated | activity.created
   */
  CREATE: 'POST /api/v1/webhooks',

  /**
   * DELETE /webhooks/:id
   * Auth: admin
   * Response: 204
   */
  DELETE: 'DELETE /api/v1/webhooks/:id',
} as const;

// ─── All endpoints ─────────────────────────────────────────────────────────────
export const API = {
  auth: AUTH_ENDPOINTS,
  users: USER_ENDPOINTS,
  funnels: FUNNEL_ENDPOINTS,
  contacts: CONTACT_ENDPOINTS,
  deals: DEAL_ENDPOINTS,
  activities: ACTIVITY_ENDPOINTS,
  reports: REPORT_ENDPOINTS,
  winLoss: WIN_LOSS_ENDPOINTS,
  sync: SYNC_ENDPOINTS,
  webhooks: WEBHOOK_ENDPOINTS,
} as const;

export type ApiEndpoint =
  | (typeof AUTH_ENDPOINTS)[keyof typeof AUTH_ENDPOINTS]
  | (typeof USER_ENDPOINTS)[keyof typeof USER_ENDPOINTS]
  | (typeof FUNNEL_ENDPOINTS)[keyof typeof FUNNEL_ENDPOINTS]
  | (typeof CONTACT_ENDPOINTS)[keyof typeof CONTACT_ENDPOINTS]
  | (typeof DEAL_ENDPOINTS)[keyof typeof DEAL_ENDPOINTS]
  | (typeof ACTIVITY_ENDPOINTS)[keyof typeof ACTIVITY_ENDPOINTS]
  | (typeof REPORT_ENDPOINTS)[keyof typeof REPORT_ENDPOINTS]
  | (typeof WIN_LOSS_ENDPOINTS)[keyof typeof WIN_LOSS_ENDPOINTS]
  | (typeof SYNC_ENDPOINTS)[keyof typeof SYNC_ENDPOINTS]
  | (typeof WEBHOOK_ENDPOINTS)[keyof typeof WEBHOOK_ENDPOINTS];
