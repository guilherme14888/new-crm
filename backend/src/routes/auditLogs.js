/**
 * GET /api/audit — query audit logs (admin + manager only)
 * Supports: ?resource=deals&userId=x&from=2024-01-01&to=2024-12-31&limit=50&offset=0
 */
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, requireRole } = require('../middleware/acl');

router.get('/', auth, resolveScope, requireRole('admin', 'manager'), async (req, res) => {
  const { resource, userId, from, to, limit = 50, offset = 0 } = req.query;
  const { scope } = req;

  const conds  = ['1=1'];
  const params = [];

  // Always scope audit logs to active company (admins can see all if no company)
  if (!scope.isAdmin || scope.companyId) {
    conds.push('company_id = ?');
    params.push(scope.companyId);
  }

  if (resource) { conds.push('resource = ?');  params.push(resource); }
  if (userId)   { conds.push('user_id = ?');   params.push(userId); }
  if (from)     { conds.push('created_at >= ?'); params.push(from); }
  if (to)       { conds.push('created_at <= ?'); params.push(to); }

  params.push(Math.min(Number(limit), 200));
  params.push(Number(offset));

  try {
    const [rows] = await db.query(
      `SELECT al.*, u.display_name AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${conds.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE ${conds.slice(0, -2).join(' AND ')}`,
      params.slice(0, -2)
    );
    res.json({
      data: rows.map((r) => ({
        id:         r.id,
        companyId:  r.company_id,
        userId:     r.user_id,
        userName:   r.user_name ?? null,
        action:     r.action,
        resource:   r.resource,
        resourceId: r.resource_id,
        oldValue:   r.old_value,
        newValue:   r.new_value,
        ipAddress:  r.ip_address,
        createdAt:  r.created_at,
      })),
      total:  countRows[0].total,
      limit:  Number(limit),
      offset: Number(offset),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
