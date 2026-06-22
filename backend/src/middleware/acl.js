/**
 * Middleware de Controle de Acesso (ACL) — Multi-tenant com controle de linha por função
 *
 * Hierarquia de funções:
 *   master     → empresa Default (00..01) — acesso global a TODAS as empresas e dados
 *   admin      → todas as empresas, todos os dados
 *   manager    → empresa própria, todos os dados
 *   supervisor → empresa própria, apenas sua equipe
 *   consultant → empresa própria, apenas seus registros
 *   agent      → alias para consultant (legacy)
 */

const db = require('../db');

const ROLES = ['admin', 'manager', 'supervisor', 'consultant', 'agent'];

/** Empresa master — tem acesso global a todos os dados de todas as empresas */
const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Factory de guardiões de função.
 * @example
 * requireRole('manager') — bloqueia qualquer um abaixo de manager
 * requireRole(['admin','manager']) — permite qualquer uma das funções listadas
 */
function requireRole(...allowed) {
  const flat = allowed.flat();
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const role = req.user.role;
    if (!flat.includes(role) && role !== 'admin') {
      return res.status(403).json({ error: 'Permissão insuficiente', required: flat });
    }
    next();
  };
}

/**
 * Guardião por PERMISSÃO do perfil ACL (enforcement das permissões da UI).
 *
 * Fail-safe (nunca afrouxa, só pode restringir):
 *   - admin (operador) → sempre passa;
 *   - usuário SEM perfil ACL → passa (mantém o controle por função/role da rota);
 *   - usuário COM perfil → negado APENAS se a permissão estiver explicitamente
 *     desligada (false) no perfil; true/ausente → passa.
 *   - erro técnico ao carregar → fail-open (não tranca por falha de infra).
 *
 * Use SEMPRE em conjunto com o requireRole existente (camadas): a permissão só
 * restringe ainda mais quem o role já deixaria passar.
 *
 * @example router.post('/', auth, requireRole('manager'), requirePermission('teams_manage'), handler)
 */
/** Carrega (e cacheia em req) as permissões do perfil ACL do usuário; null se sem perfil. */
async function _loadPerms(req) {
  if (req._aclPerms !== undefined) return req._aclPerms;
  try {
    const [r] = await db.query(
      'SELECT p.permissions FROM users u JOIN acl_profiles p ON p.id = u.acl_profile_id WHERE u.id = ?',
      [req.user.id]
    );
    req._aclPerms = r.length
      ? (typeof r[0].permissions === 'string' ? JSON.parse(r[0].permissions) : (r[0].permissions || null))
      : null;
  } catch { req._aclPerms = null; }
  return req._aclPerms;
}

/** GRANT: admin → true; perfil concede a chave (===true) → true; senão false (sem perfil = não concedido). */
async function hasPermission(req, key) {
  if (!req || !req.user) return false;
  if (req.user.role === 'admin') return true;
  const p = await _loadPerms(req);
  return !!(p && p[key] === true);
}

/** RESTRICT: true se o perfil DESLIGA explicitamente a chave (===false). Admin/sem-perfil → false (não bloqueia). */
async function permissionDenied(req, key) {
  if (!req || !req.user || req.user.role === 'admin') return false;
  const p = await _loadPerms(req);
  return !!(p && p[key] === false);
}

// Restrict-only (camada com requireRole): nega só se a permissão estiver explicitamente off.
function requirePermission(...keys) {
  const need = keys.flat();
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user.role === 'admin') return next();
    try {
      const perms = await _loadPerms(req);
      if (!perms) return next(); // sem perfil → não restringe
      for (const k of need) {
        if (perms[k] === false) {
          return res.status(403).json({ error: 'Permissão insuficiente para esta ação.', required: k });
        }
      }
      return next();
    } catch {
      return next(); // fail-open
    }
  };
}

/**
 * Grant-only para funções de OPERADOR (empresa Default): admin → passa; senão
 * exige estar na empresa Default E ter TODAS as permissões concedidas. Não afrouxa
 * para tenants-cliente (continuam barrados como no requireAdmin original).
 */
function requireMasterPermission(...keys) {
  const need = keys.flat();
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user.role === 'admin') return next();
    if (req.user.company_id !== MASTER_COMPANY_ID) {
      return res.status(403).json({ error: 'Disponível apenas para administradores da empresa Default.' });
    }
    try {
      const perms = await _loadPerms(req);
      for (const k of need) {
        if (!(perms && perms[k] === true)) {
          return res.status(403).json({ error: 'Permissão insuficiente para esta ação.', required: k });
        }
      }
      return next();
    } catch {
      return res.status(403).json({ error: 'Permissão insuficiente para esta ação.' });
    }
  };
}

/**
 * Resolvedor de escopo da empresa e equipe.
 * Atribui req.scope com { companyId, teamId?, userId, role, isAdmin }
 *
 * Admin pode passar ?company=<id> ou X-Company-Id header para trocar de contexto.
 * Outras funções ficam limitadas à sua própria empresa.
 */
function resolveScope(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

  const { id: userId, company_id, team_id, role } = req.user;
  const isAdmin = role === 'admin';

  let activeCompanyId = company_id;

  if (isAdmin) {
    // Admin pode trocar via header ou parâmetro de query. ATENÇÃO: "all" NÃO é uma
    // empresa — é o valor "Todas" de filtros (ex.: Histórico de Mineração que manda
    // ?company=all). Sem isto, activeCompanyId virava a string 'all', quebrava o
    // isMaster e filtrava por company_id='all' → tudo aparecia como "sem execução".
    const headerCompany = req.headers['x-company-id'];
    const queryCompany  = req.query.company === 'all' ? undefined : req.query.company;
    activeCompanyId = headerCompany || queryCompany || company_id;
  }

  const isMaster = activeCompanyId === MASTER_COMPANY_ID;

  req.scope = {
    companyId: activeCompanyId,
    teamId:    team_id ?? null,
    userId,
    role,
    isAdmin,
    isMaster,
  };

  next();
}

/**
 * Construtor de filtros SQL para escopo de acesso.
 * Retorna { where: string, params: any[] } para appendar a uma query.
 *
 * tableAlias: opcional — e.g. 'd' para `d.company_id`
 *
 * @example
 * const { where, params } = buildScopeFilter(req.scope, 'd');
 * db.query(`SELECT * FROM deals d WHERE ${where} ...`, params);
 */
function buildScopeFilter(scope, tableAlias = '') {
  const col = (name) => tableAlias ? `${tableAlias}.${name}` : name;
  const { role, companyId, teamId, userId, isAdmin, isMaster } = scope;

  // Empresa master vê todos os dados de todas as empresas
  if (isMaster) {
    return { where: '1=1', params: [] };
  }

  if (isAdmin) {
    // Admin vê tudo dentro da empresa ativa (ou tudo se nenhuma empresa selecionada)
    if (companyId) {
      return { where: `${col('company_id')} = ?`, params: [companyId] };
    }
    return { where: '1=1', params: [] };
  }

  switch (role) {
    case 'manager':
      return {
        where:  `${col('company_id')} = ?`,
        params: [companyId],
      };

    case 'supervisor':
      if (!teamId) {
        // Supervisor sem equipe → vê apenas seus registros
        return {
          where:  `${col('company_id')} = ? AND ${col('owner_id')} = ?`,
          params: [companyId, userId],
        };
      }
      return {
        // Supervisor vê registros de qualquer pessoa em sua equipe
        // Usa subquery com IN para filtrar por membros da equipe
        where:  `${col('company_id')} = ? AND ${col('owner_id')} IN (SELECT user_id FROM team_members WHERE team_id = ?)`,
        params: [companyId, teamId],
      };

    case 'consultant':
    case 'agent':
    default:
      return {
        where:  `${col('company_id')} = ? AND ${col('owner_id')} = ?`,
        params: [companyId, userId],
      };
  }
}

/**
 * Variante do buildScopeFilter para tabelas sem owner_id (ex: contatos compartilhados na empresa).
 * Usa apenas company_id como filtro de escopo.
 */
function buildCompanyFilter(scope, tableAlias = '') {
  const col = (name) => tableAlias ? `${tableAlias}.${name}` : name;
  const { role, companyId, teamId, userId, isAdmin, isMaster } = scope;

  // Empresa master vê todos os dados de todas as empresas
  if (isMaster) {
    return { where: '1=1', params: [] };
  }

  if (isAdmin) {
    if (companyId) return { where: `${col('company_id')} = ?`, params: [companyId] };
    return { where: '1=1', params: [] };
  }

  // Todas as funções não-admin veem contatos de sua empresa
  // Contatos são recursos compartilhados dentro de uma empresa
  return {
    where:  `${col('company_id')} = ?`,
    params: [companyId],
  };
}

/**
 * Verifica se um usuário tem permissão para acessar um registro específico.
 * Chamar após buscar a linha do banco de dados.
 *
 * @returns true se permitido, false se negado
 */
function canAccess(scope, record) {
  const { role, companyId, teamId, userId, isAdmin, isMaster } = scope;

  // Empresa master tem acesso a qualquer registro
  if (isMaster) return true;

  if (isAdmin) return true;

  // Deve pertencer à mesma empresa
  if (record.company_id && record.company_id !== companyId) return false;

  switch (role) {
    case 'manager':   return true;
    case 'supervisor':
      if (!teamId) return record.owner_id === userId;
      // Verificação de membro da equipe — tratada ao nível de route com query de DB
      return true; // otimista; a route deve verificar pertencimento à equipe
    case 'consultant':
    case 'agent':
      return record.owner_id === userId;
    default:
      return false;
  }
}

/**
 * Middleware que permite apenas administradores.
 * Usado para ações sensíveis como trocar de empresa ou atribuições de função.
 */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem trocar de empresa' });
  next();
}

/**
 * Previne escalação de privilégio horizontal:
 * Um usuário não pode atribuir uma função mais alta que a sua.
 *
 * @param assignerRole Função de quem está atribuindo
 * @param targetRole Função que será atribuída
 * @returns true se permitido, false se negado
 */
function canAssignRole(assignerRole, targetRole) {
  const hierarchy = { admin: 4, manager: 3, supervisor: 2, consultant: 1, agent: 1 };
  return (hierarchy[assignerRole] ?? 0) >= (hierarchy[targetRole] ?? 99);
}

module.exports = {
  requireRole,
  requirePermission,
  requireMasterPermission,
  hasPermission,
  permissionDenied,
  resolveScope,
  buildScopeFilter,
  buildCompanyFilter,
  canAccess,
  requireAdmin,
  canAssignRole,
  ROLES,
  MASTER_COMPANY_ID,
};
