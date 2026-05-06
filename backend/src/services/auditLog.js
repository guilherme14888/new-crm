/**
 * Audit Log Service
 * Fire-and-forget — never throws, never blocks a request.
 */
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * audit(req, { action, resource, resourceId, oldValue, newValue })
 *
 * action:      'create' | 'update' | 'delete' | 'login' | 'switch_company' | 'view'
 * resource:    'deals' | 'contacts' | 'users' | 'teams' | ...
 * resourceId:  the affected row id
 * oldValue:    plain object (optional)
 * newValue:    plain object (optional)
 */
async function audit(req, { action, resource, resourceId = null, oldValue = null, newValue = null }) {
  try {
    const user      = req.user ?? {};
    const companyId = req.scope?.companyId ?? user.company_id ?? null;
    const ip        = req.ip ?? req.headers['x-forwarded-for'] ?? null;
    const ua        = req.headers['user-agent']?.slice(0, 255) ?? null;

    await db.query(
      `INSERT INTO audit_logs
         (id, company_id, user_id, action, resource, resource_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        companyId,
        user.id ?? null,
        action,
        resource,
        resourceId,
        oldValue  ? JSON.stringify(oldValue)  : null,
        newValue  ? JSON.stringify(newValue)  : null,
        ip,
        ua,
      ]
    );
  } catch {
    // Audit must never crash the main request
  }
}

module.exports = { audit };
